package com.fhir.hospitalA.service;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.parser.IParser;
import com.fhir.consent.service.ConsentStore;
import com.fhir.hospitalA.dto.HospitalAOPConsultRecordDTO;
import com.fhir.hospitalA.dto.PatientPushRequestDTO;
import com.fhir.hospitalA.mapper.HospitalAOPConsultToFhirMapper;
import com.fhir.hospitalA.mapper.HospitalAToFHIRMapper;
import com.fhir.hospitalA.model.HospitalAOPConsultEntity;
import com.fhir.hospitalA.model.HospitalAPatient;
import com.fhir.hospitalA.repository.HospitalAOPConsultRepository;
import com.fhir.hospitalA.repository.HospitalAPatientRepository;
import com.fhir.shared.audit.AuditService;
import com.fhir.shared.validation.FHIRValidatorBundle;
import com.fhir.shared.validation.FHIRValidatorUtil;
import org.hl7.fhir.r4.model.Bundle;
import org.hl7.fhir.r4.model.Patient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;

/**
 * Service layer for Hospital A.
 * <p>
 * Owns all business logic: entity persistence, consent gate, FHIR bundle
 * assembly, granular privacy filtering, and audit logging.  Controllers
 * are kept as thin HTTP adapters that only delegate here.
 */
@Service
public class HospitalAService {

    private final FhirContext fhirContext = FhirContext.forR4();

    @Autowired
    private FHIRValidatorBundle bundleValidator;

    @Autowired
    private ConsentStore consentStore;

    @Autowired
    private HospitalAPatientRepository patientRepository;

    @Autowired
    private HospitalAOPConsultRepository consultRepository;

    @Autowired
    private AuditService auditService;

    // ── Patient to FHIR ──────────────────────────────────────────────────────

    /**
     * Persists the patient locally, maps to a FHIR Patient resource, validates
     * it, and returns the pretty-printed JSON string.
     */
    @Transactional
    public String convertPatientToFhir(HospitalAPatient patient) {
        patientRepository.save(patient);
        Patient fhirPatient = HospitalAToFHIRMapper.mapToFHIRPatient(patient);
        FHIRValidatorUtil.validate(fhirPatient);
        return fhirContext
                .newJsonParser()
                .setPrettyPrint(true)
                .encodeResourceToString(fhirPatient);
    }

    // ── Doctor-Initiated OP Consult ──────────────────────────────────────────

    /**
     * Handles the full doctor-initiated OP Consult pipeline:
     * <ol>
     *   <li>Persist the visit record locally.</li>
     *   <li>Enforce the consent gate — 403 if no active GRANTED consent.</li>
     *   <li>Build &amp; filter the FHIR bundle according to granted data types.</li>
     *   <li>Log a pending audit entry, validate, encode, mark success/failure.</li>
     * </ol>
     *
     * @param consultRecord the inbound OP consult DTO
     * @param requesterId   the authenticated requester identity (from JWT subject)
     * @return pretty-printed FHIR Bundle JSON
     */
    @Transactional
    public String processOPConsult(HospitalAOPConsultRecordDTO consultRecord, String requesterId) {

        // 1. Persist the OPD visit locally immediately
        persistOPConsult(consultRecord);

        // 2. Consent gate — must be checked before any outward data transfer
        Set<String> grantedTypes = consentStore.getActiveGrantedDataTypes(
                consultRecord.getPatientId(), requesterId);

        if (grantedTypes.isEmpty()) {
            String reason = "No active GRANTED consent request found for patient: "
                    + consultRecord.getPatientId()
                    + " and requester: " + requesterId
                    + ". Call POST /consent/initiate first and wait for patient approval.";
            // 403 FORBIDDEN — intentional business rule; local record was saved but outward transfer aborted
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, reason);
        }

        // 3. Build FHIR bundle and apply fine-grained privacy stripping
        Bundle bundle = HospitalAOPConsultToFhirMapper.mapToBundle(consultRecord);
        filterBundleByConsent(bundle, grantedTypes);

        // 4. Audit → validate → encode
        Long auditId = auditService.logPending(
                consultRecord.getPatientId(),
                "HospitalA",
                requesterId,
                bundle.getEntry().size(),
                grantedTypes.toString()
        );

        try {
            bundleValidator.validate(bundle);
            IParser parser = fhirContext.newJsonParser().setPrettyPrint(true);
            String payload = parser.encodeResourceToString(bundle);
            auditService.markSuccess(auditId);
            return payload;
        } catch (Exception e) {
            auditService.markFailed(auditId, e.getMessage());
            throw e;
        }
    }

    // ── Patient-Initiated Push ───────────────────────────────────────────────

    /**
     * Handles the patient-initiated push pipeline:
     * <ol>
     *   <li>Fetch the latest consult record for the authenticated patient.</li>
     *   <li>Auto-grant consent for the requested data types.</li>
     *   <li>Build &amp; filter the FHIR bundle.</li>
     *   <li>Log a pending audit entry, validate, encode, mark success/failure.</li>
     * </ol>
     *
     * @param pushRequest inbound push request DTO (target requester + data types)
     * @param patientId   the authenticated patient's ID (extracted from JWT by the controller)
     * @return pretty-printed FHIR Bundle JSON
     */
    @Transactional
    public String pushOPConsult(PatientPushRequestDTO pushRequest, String patientId) {

        // 1. Fetch the latest consult record for this patient
        HospitalAOPConsultEntity latestConsult = consultRepository
                .findFirstByPatientIdOrderByIdDesc(patientId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "No recent OP consult record found for patient: " + patientId));

        // 2. Auto-grant and record consent for this patient-initiated transfer
        consentStore.autoGrantForPatientPush(
                patientId,
                pushRequest.getTargetRequesterId(),
                pushRequest.getDataTypes());

        // 3. Map entity → DTO → FHIR bundle
        HospitalAOPConsultRecordDTO dto = entityToDTO(latestConsult);
        Bundle bundle = HospitalAOPConsultToFhirMapper.mapToBundle(dto);

        // 4. Apply fine-grained privacy stripping based on patient-selected data types
        filterBundleByConsent(bundle, pushRequest.getDataTypes());

        // 5. Audit → validate → encode
        String dataTypesStr = pushRequest.getDataTypes() != null
                ? pushRequest.getDataTypes().toString() : "[]";

        Long auditId = auditService.logPending(
                patientId,
                "HospitalA",
                pushRequest.getTargetRequesterId(),
                bundle.getEntry().size(),
                dataTypesStr
        );

        try {
            bundleValidator.validate(bundle);
            IParser parser = fhirContext.newJsonParser().setPrettyPrint(true);
            String payload = parser.encodeResourceToString(bundle);
            auditService.markSuccess(auditId);
            return payload;
        } catch (Exception e) {
            auditService.markFailed(auditId, e.getMessage());
            throw e;
        }
    }

    // ── Private Helpers ──────────────────────────────────────────────────────

    /**
     * Maps a DTO to a new {@link HospitalAOPConsultEntity} and saves it.
     */
    private void persistOPConsult(HospitalAOPConsultRecordDTO dto) {
        HospitalAOPConsultEntity entity = new HospitalAOPConsultEntity();
        entity.setPatientId(dto.getPatientId());
        entity.setPatientFirstName(dto.getPatientFirstName());
        entity.setPatientLastName(dto.getPatientLastName());
        entity.setDoctorName(dto.getDoctorName());
        entity.setVisitDate(dto.getVisitDate());
        entity.setSymptoms(dto.getSymptoms());
        entity.setTemperature(dto.getTemperature());
        entity.setBloodPressure(dto.getBloodPressure());
        entity.setPrescriptionPdfBase64(dto.getPrescriptionPdfBase64());
        consultRepository.save(entity);
    }

    /**
     * Maps a persisted {@link HospitalAOPConsultEntity} back to a DTO so it
     * can be converted to a FHIR bundle.
     */
    private HospitalAOPConsultRecordDTO entityToDTO(HospitalAOPConsultEntity entity) {
        HospitalAOPConsultRecordDTO dto = new HospitalAOPConsultRecordDTO();
        dto.setPatientId(entity.getPatientId());
        dto.setPatientFirstName(entity.getPatientFirstName());
        dto.setPatientLastName(entity.getPatientLastName());
        dto.setDoctorName(entity.getDoctorName());
        dto.setVisitDate(entity.getVisitDate());
        dto.setSymptoms(entity.getSymptoms());
        dto.setTemperature(entity.getTemperature());
        dto.setBloodPressure(entity.getBloodPressure());
        dto.setPrescriptionPdfBase64(entity.getPrescriptionPdfBase64());
        return dto;
    }

    /**
     * Removes bundle entries whose FHIR resource type is not covered by the
     * set of granted data types.
     *
     * <p>Base resources (Patient, Encounter, Practitioner, DocumentReference,
     * Consent) are always included as they form the structural summary envelope.
     * Optional clinical resources are included only when explicitly granted.
     *
     * @param bundle           the FHIR bundle to mutate in-place
     * @param grantedDataTypes the set of logical data-type grants (e.g. "Medications")
     */
    private void filterBundleByConsent(Bundle bundle, Set<String> grantedDataTypes) {
        Set<String> allowed = new HashSet<>();

        // Structural / summary types always shared
        allowed.add("Patient");
        allowed.add("Encounter");
        allowed.add("Practitioner");
        allowed.add("DocumentReference");
        allowed.add("Consent");

        // Optional clinical types gated by consent grants
        if (grantedDataTypes != null) {
            if (grantedDataTypes.contains("Medications")) {
                allowed.add("Medication");
                allowed.add("MedicationRequest");
                allowed.add("MedicationStatement");
            }
            if (grantedDataTypes.contains("Diagnostics")) {
                allowed.add("DiagnosticReport");
                allowed.add("Observation");
            }
            if (grantedDataTypes.contains("LabResults")) {
                allowed.add("Observation");
            }
            if (grantedDataTypes.contains("SurgicalHistory")) {
                allowed.add("Procedure");
            }
            if (grantedDataTypes.contains("Allergies")) {
                allowed.add("AllergyIntolerance");
            }
        }

        Iterator<Bundle.BundleEntryComponent> iterator = bundle.getEntry().iterator();
        while (iterator.hasNext()) {
            Bundle.BundleEntryComponent entry = iterator.next();
            if (entry.getResource() != null) {
                String resourceType = entry.getResource().getResourceType().name();
                if (!allowed.contains(resourceType)) {
                    iterator.remove();
                }
            }
        }
    }
}
