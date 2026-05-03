package com.fhir.hospitalB.service;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.parser.IParser;
import com.fhir.hospitalB.dto.HospitalBOPConsultRecordDTO;
import com.fhir.hospitalB.mapper.FHIRToHospitalBMapper;
import com.fhir.hospitalB.mapper.FhirBundleToHospitalBMapper;
import com.fhir.hospitalB.model.HospitalBPatient;
import com.fhir.hospitalB.model.HospitalBOPConsultEntity;
import com.fhir.hospitalB.repository.HospitalBOPConsultRepository;
import com.fhir.hospitalB.repository.HospitalBPatientRepository;
import com.fhir.shared.validation.FHIRValidatorBundle;
import org.hl7.fhir.r4.model.Bundle;
import org.hl7.fhir.r4.model.Patient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Service layer for Hospital B.
 * <p>
 * Owns all business logic: FHIR JSON parsing and domain model mapping.
 * The controller is kept as a thin HTTP adapter that only delegates here.
 */
@Service
public class HospitalBService {

    private final FhirContext fhirContext = FhirContext.forR4();

    @Autowired
    private FHIRValidatorBundle bundleValidator;

    @Autowired
    private HospitalBOPConsultRepository consultRepository;

    @Autowired
    private HospitalBPatientRepository patientRepository;

    /**
     * Parses a FHIR Patient JSON string and maps it to the Hospital B domain
     * model.
     *
     * @param fhirJson raw FHIR-compliant Patient JSON
     * @return the mapped {@link HospitalBPatient}
     */
    public HospitalBPatient receiveFhirPatient(String fhirJson) {
        Patient patient = fhirContext.newJsonParser().parseResource(Patient.class, fhirJson);
        return FHIRToHospitalBMapper.mapToHospitalB(patient);
    }

    /**
     * Parses and validates a FHIR Bundle from another hospital, maps it into
     * Hospital B's local schema, and persists it with provenance metadata.
     *
     * <p>Pipeline:
     * <ol>
     *   <li>Parse FHIR JSON → {@link Bundle}</li>
     *   <li>Validate bundle against FHIR R4 base profiles (HTTP 422 on failure)</li>
     *   <li>Map bundle → Hospital B DTO (yyyy-MM-dd date, plain numeric temp)</li>
     *   <li>Persist entity with sourceHospital / receivedViaFhir provenance fields</li>
     * </ol>
     *
     * @param fhirJson raw FHIR-compliant Bundle JSON
     * @return the mapped {@link HospitalBOPConsultRecordDTO}
     */
    public HospitalBOPConsultRecordDTO receiveFhirBundle(String fhirJson) {
        IParser parser = fhirContext.newJsonParser();
        Bundle bundle = parser.parseResource(Bundle.class, fhirJson);

        // Validate BEFORE mapping — reject invalid FHIR bundles (HTTP 422) immediately
        bundleValidator.validate(bundle);

        HospitalBOPConsultRecordDTO dto = FhirBundleToHospitalBMapper.map(bundle);

        // Persist to hospital_b_db with provenance stamps
        HospitalBOPConsultEntity entity = new HospitalBOPConsultEntity();
        entity.setAbhaId(dto.getAbhaId());
        entity.setPatientId(dto.getPatientId());
        entity.setPatientName(dto.getPatientName());
        entity.setConsultDate(dto.getConsultDate());         // yyyy-MM-dd (Hospital B native)
        entity.setDoctor(dto.getDoctor());
        entity.setClinicalNotes(dto.getClinicalNotes());
        entity.setConsentVerified(dto.isConsentVerified());
        if (dto.getVitals() != null) {
            entity.setBloodPressure(dto.getVitals().getBp());
            entity.setTemperature(dto.getVitals().getTemp()); // plain decimal e.g. "40.0"
        }
        if (dto.getPrescriptionPdfBase64() != null) {
            entity.setPrescriptionPdfBase64(dto.getPrescriptionPdfBase64());
        }
        // Provenance fields — make the interoperability story explicit in the DB row
        entity.setReceivedViaFhir(true);
        entity.setSourceHospital("HOSP-A");
        entity.setSourceRecordId(dto.getAbhaId()); // best available cross-hospital key
        consultRepository.save(entity);

        return dto;
    }

    public String processNativeConsult(HospitalBOPConsultRecordDTO dto) {
        resolvePatientIdentity(dto);

        HospitalBOPConsultEntity entity = new HospitalBOPConsultEntity();
        entity.setAbhaId(dto.getAbhaId());
        entity.setPatientId(dto.getPatientId());
        entity.setPatientName(dto.getPatientName());
        entity.setConsultDate(dto.getConsultDate());
        entity.setDoctor(dto.getDoctor());
        entity.setClinicalNotes(dto.getClinicalNotes());
        entity.setConsentVerified(true);
        if (dto.getVitals() != null) {
            entity.setBloodPressure(dto.getVitals().getBp());
            entity.setTemperature(dto.getVitals().getTemp());
        }
        entity.setPrescriptionPdfBase64(dto.getPrescriptionPdfBase64());
        consultRepository.save(entity);
        return "OP Consult record stored in Hospital B database successfully.";
    }

    public java.util.List<HospitalBOPConsultEntity> getAllConsults() {
        return consultRepository.findAll();
    }

    public List<HospitalBOPConsultEntity> getConsultsByAbhaId(String abhaId) {
        return consultRepository.findByAbhaIdOrderByReceivedAtDesc(abhaId);
    }

    /**
     * Called by HIPFhirClient when HIE requests data from Hospital B.
     * The assembled bundle is validated before being serialised — invalid
     * outbound FHIR never leaves Hospital B.
     */
    public String pullFhirBundle(String abhaId, String consentToken, java.util.Set<String> scope) {
        HospitalBOPConsultEntity consult = consultRepository
            .findFirstByAbhaIdOrderByIdDesc(abhaId)
            .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.NOT_FOUND,
                "No consult record found for patient with ABHA-ID: " + abhaId));

        HospitalBOPConsultRecordDTO dto = new HospitalBOPConsultRecordDTO();
        dto.setAbhaId(consult.getAbhaId());
        dto.setPatientId(consult.getPatientId());
        dto.setPatientName(consult.getPatientName());
        dto.setConsultDate(consult.getConsultDate());
        dto.setDoctor(consult.getDoctor());
        dto.setClinicalNotes(consult.getClinicalNotes());

        HospitalBOPConsultRecordDTO.Vitals vitals = new HospitalBOPConsultRecordDTO.Vitals();
        vitals.setBp(consult.getBloodPressure());
        vitals.setTemp(consult.getTemperature());
        dto.setVitals(vitals);

        dto.setPrescriptionPdfBase64(consult.getPrescriptionPdfBase64());

        Bundle bundle = com.fhir.hospitalB.mapper.HospitalBOPConsultToFhirMapper.mapToBundle(dto);

        // Validate outbound bundle — never serialise invalid FHIR
        bundleValidator.validate(bundle);

        return fhirContext.newJsonParser()
            .setPrettyPrint(true)
            .encodeResourceToString(bundle);
    }

    private void resolvePatientIdentity(HospitalBOPConsultRecordDTO dto) {
        if (isBlank(dto.getAbhaId()) && !isBlank(dto.getPatientId()) && dto.getPatientId().startsWith("ABHA-")) {
            dto.setAbhaId(dto.getPatientId());
        }

        if (isBlank(dto.getAbhaId()) && !isBlank(dto.getPatientId())) {
            patientRepository.findByPatientId(dto.getPatientId())
                .map(HospitalBPatient::getAbhaId)
                .filter(abhaId -> !isBlank(abhaId))
                .ifPresent(dto::setAbhaId);
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
