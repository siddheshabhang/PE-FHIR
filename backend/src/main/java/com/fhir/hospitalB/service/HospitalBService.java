package com.fhir.hospitalB.service;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.parser.IParser;
import com.fhir.hospitalB.dto.HospitalBOPConsultRecordDTO;
import com.fhir.hospitalB.mapper.FHIRToHospitalBMapper;
import com.fhir.hospitalB.mapper.FhirBundleToHospitalBMapper;
import com.fhir.hospitalB.model.HospitalBPatient;
import com.fhir.hospitalB.model.HospitalBOPConsultEntity;
import com.fhir.hospitalB.repository.HospitalBOPConsultRepository;
import org.hl7.fhir.r4.model.Bundle;
import org.hl7.fhir.r4.model.Patient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

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
    private HospitalBOPConsultRepository consultRepository;

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
     * Parses a FHIR Bundle JSON string and maps it to the Hospital B OP
     * Consult DTO.
     *
     * @param fhirJson raw FHIR-compliant Bundle JSON
     * @return the mapped {@link HospitalBOPConsultRecordDTO}
     */
    public HospitalBOPConsultRecordDTO receiveFhirBundle(String fhirJson) {
        IParser parser = fhirContext.newJsonParser();
        Bundle bundle = parser.parseResource(Bundle.class, fhirJson);
        HospitalBOPConsultRecordDTO dto = FhirBundleToHospitalBMapper.map(bundle);

        // Persist to hospital_b_db
        HospitalBOPConsultEntity entity = new HospitalBOPConsultEntity();
        entity.setUhid(dto.getUhid());
        entity.setPatientName(dto.getPatientName());
        entity.setConsultDate(dto.getConsultDate());
        entity.setDoctor(dto.getDoctor());
        entity.setClinicalNotes(dto.getClinicalNotes());
        entity.setConsentVerified(dto.isConsentVerified());
        if (dto.getVitals() != null) {
            entity.setBloodPressure(dto.getVitals().getBp());
            entity.setTemperature(dto.getVitals().getTemp());
        }
        if (dto.getPrescriptionPdfBase64() != null) {
            entity.setPrescriptionPdfBase64(dto.getPrescriptionPdfBase64());
        }
        consultRepository.save(entity);

        return dto;
    }

    public java.util.List<HospitalBOPConsultEntity> getAllConsults() {
        return consultRepository.findAll();
    }
}
