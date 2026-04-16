package com.demo.fhir.hospitalA.controller;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.parser.IParser;
import com.demo.fhir.consent.model.ConsentStatus;
import com.demo.fhir.consent.service.ConsentStore;
import com.demo.fhir.hospitalA.dto.HospitalAOPConsultRecordDTO;
import com.demo.fhir.hospitalA.dto.PatientPushRequestDTO;
import com.demo.fhir.hospitalA.mapper.HospitalAOPConsultToFhirMapper;
import com.demo.fhir.hospitalA.mapper.HospitalAToFHIRMapper;
import com.demo.fhir.hospitalA.model.HospitalAOPConsultEntity;
import com.demo.fhir.hospitalA.model.HospitalAPatient;
import com.demo.fhir.hospitalA.repository.HospitalAOPConsultRepository;
import com.demo.fhir.hospitalA.repository.HospitalAPatientRepository;
import com.demo.fhir.shared.validation.FHIRValidatorBundle;
import com.demo.fhir.shared.validation.FHIRValidatorUtil;
import org.hl7.fhir.r4.model.Bundle;
import org.hl7.fhir.r4.model.Patient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/hospitalA")
public class HospitalAController {

    private final FhirContext fhirContext = FhirContext.forR4();

    @Autowired
    private FHIRValidatorBundle bundleValidator;

    // TODO Phase 3: replace with ConsentService interface
    @Autowired
    private ConsentStore consentStore;

    @Autowired
    private HospitalAPatientRepository patientRepository;

    @Autowired
    private HospitalAOPConsultRepository consultRepository;

    @Autowired
    private com.demo.fhir.shared.audit.AuditService auditService;

    // ── Patient to FHIR ──────────────────────────────────────────────────────
    @PostMapping("/patient/to-fhir")
    public String convertToFHIR(@RequestBody HospitalAPatient patient) {
        // Persist local copy before sending out
        patientRepository.save(patient);
        
        Patient fhirPatient = HospitalAToFHIRMapper.mapToFHIRPatient(patient);
        FHIRValidatorUtil.validate(fhirPatient);
        return fhirContext
                .newJsonParser()
                .setPrettyPrint(true)
                .encodeResourceToString(fhirPatient);
    }

    // ── OP Consult with consent guard ────────────────────────────────────────
    @PostMapping("/op-consult")
    public String receiveOPConsult(@RequestBody HospitalAOPConsultRecordDTO consultRecord) {
        
        // 1. Persist the OPD visit locally immediately
        HospitalAOPConsultEntity entity = new HospitalAOPConsultEntity();
        entity.setPatientId(consultRecord.getPatientId());
        entity.setPatientFirstName(consultRecord.getPatientFirstName());
        entity.setPatientLastName(consultRecord.getPatientLastName());
        entity.setDoctorName(consultRecord.getDoctorName());
        entity.setVisitDate(consultRecord.getVisitDate());
        entity.setSymptoms(consultRecord.getSymptoms());
        entity.setTemperature(consultRecord.getTemperature());
        entity.setBloodPressure(consultRecord.getBloodPressure());
        entity.setPrescriptionPdfBase64(consultRecord.getPrescriptionPdfBase64());
        consultRepository.save(entity);

        // 2. Consent check prior to generating FHIR payload
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String requesterId = (auth != null && auth.getName() != null) ? auth.getName() : "system";

        // CONSENT GUARD — must be the very first check before Data Transfer
        java.util.Set<String> grantedTypes = consentStore.getActiveGrantedDataTypes(consultRecord.getPatientId(), requesterId);
        
        if (grantedTypes.isEmpty()) {
            String reason = "No active GRANTED consent request found for patient: "
                    + consultRecord.getPatientId()
                    + " and requester: " + requesterId
                    + ". Call POST /consent/initiate first and wait for patient approval.";

            // 403 FORBIDDEN — not 500, because this is an intentional business rule
            // Note: the record was saved locally, but outward transfer was aborted.
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, reason);
        }

        // Consent is GRANTED — proceed with mapping and transfer
        Bundle bundle = HospitalAOPConsultToFhirMapper.mapToBundle(consultRecord);
        
        // Apply Fine-Grained Data Privacy Stripping
        filterBundleByConsent(bundle, grantedTypes);

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

    // ── Patient-Initiated Push Flow ──────────────────────────────────────────
    @PostMapping("/op-consult/push")
    public String pushOPConsult(@RequestBody PatientPushRequestDTO pushRequest) {
        // 1. Get Patient ID from Authentication Context
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthenticated request");
        }
        String patientId = auth.getName();
        if (auth.getDetails() instanceof io.jsonwebtoken.Claims claims) {
            String claimPatientId = claims.get("patientId", String.class);
            if (claimPatientId != null) {
                patientId = claimPatientId;
            }
        }

        // 2. Fetch the latest consult record for this patient
        HospitalAOPConsultEntity latestConsult = consultRepository.findFirstByPatientIdOrderByIdDesc(patientId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No recent OP consult record found for patient: " + patientId));

        // 3. Automatically grant and record consent for this data transfer
        consentStore.autoGrantForPatientPush(patientId, pushRequest.getTargetRequesterId(), pushRequest.getDataTypes());

        // 4. Transform Entity -> DTO -> Bundle
        HospitalAOPConsultRecordDTO dto = new HospitalAOPConsultRecordDTO();
        dto.setPatientId(latestConsult.getPatientId());
        dto.setPatientFirstName(latestConsult.getPatientFirstName());
        dto.setPatientLastName(latestConsult.getPatientLastName());
        dto.setDoctorName(latestConsult.getDoctorName());
        dto.setVisitDate(latestConsult.getVisitDate());
        dto.setSymptoms(latestConsult.getSymptoms());
        dto.setTemperature(latestConsult.getTemperature());
        dto.setBloodPressure(latestConsult.getBloodPressure());
        dto.setPrescriptionPdfBase64(latestConsult.getPrescriptionPdfBase64());

        Bundle bundle = HospitalAOPConsultToFhirMapper.mapToBundle(dto);

        // 5. Apply Fine-Grained Data Privacy Stripping based on requested data types
        filterBundleByConsent(bundle, pushRequest.getDataTypes());

        Long auditId = auditService.logPending(
                patientId, 
                "HospitalA", 
                pushRequest.getTargetRequesterId(), 
                bundle.getEntry().size(), 
                pushRequest.getDataTypes() != null ? pushRequest.getDataTypes().toString() : "[]"
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

    // ── Granular Data Stripping Helper ───────────────────────────────────────
    private void filterBundleByConsent(Bundle bundle, java.util.Set<String> grantedDataTypes) {
        java.util.Set<String> allowedResourceTypes = new java.util.HashSet<>();
        
        // Base critical objects are usually shared by default in summary packets
        allowedResourceTypes.add("Patient");
        allowedResourceTypes.add("Encounter");
        allowedResourceTypes.add("Practitioner");
        allowedResourceTypes.add("DocumentReference");
        allowedResourceTypes.add("Consent");

        if (grantedDataTypes.contains("Medications")) {
            allowedResourceTypes.add("Medication");
            allowedResourceTypes.add("MedicationRequest");
            allowedResourceTypes.add("MedicationStatement");
        }
        if (grantedDataTypes.contains("Diagnostics")) {
            allowedResourceTypes.add("DiagnosticReport");
            allowedResourceTypes.add("Observation");
        }
        if (grantedDataTypes.contains("LabResults")) {
            allowedResourceTypes.add("Observation"); 
        }
        if (grantedDataTypes.contains("SurgicalHistory")) {
            allowedResourceTypes.add("Procedure");
        }
        if (grantedDataTypes.contains("Allergies")) {
            allowedResourceTypes.add("AllergyIntolerance");
        }

        // Safely iterate and remove unauthorized elements
        java.util.Iterator<Bundle.BundleEntryComponent> iterator = bundle.getEntry().iterator();
        while (iterator.hasNext()) {
            Bundle.BundleEntryComponent entry = iterator.next();
            if (entry.getResource() != null) {
                String resourceType = entry.getResource().getResourceType().name();
                if (!allowedResourceTypes.contains(resourceType)) {
                    iterator.remove(); // Strip it off
                }
            }
        }
    }
}