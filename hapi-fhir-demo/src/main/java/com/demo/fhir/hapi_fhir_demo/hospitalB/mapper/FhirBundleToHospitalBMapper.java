package com.demo.fhir.hapi_fhir_demo.hospitalB.mapper;

import com.demo.fhir.hapi_fhir_demo.hospitalB.Dto.HospitalBOPConsultRecordDTO;
import org.hl7.fhir.r4.model.*;

import java.text.SimpleDateFormat;

public class FhirBundleToHospitalBMapper {
    public static HospitalBOPConsultRecordDTO map(Bundle bundle) {
        HospitalBOPConsultRecordDTO dto = new HospitalBOPConsultRecordDTO();
        HospitalBOPConsultRecordDTO.Vitals vitals = new HospitalBOPConsultRecordDTO.Vitals();

        for(Bundle.BundleEntryComponent entry : bundle.getEntry()) {
            Resource resource = entry.getResource();

            if (resource instanceof Patient patient) {
                dto.setUhid("B-" + patient.getId());
                if (!patient.getName().isEmpty()) {
                    HumanName name = patient.getNameFirstRep();
                    String firstName = name.getGivenAsSingleString();
                    String lastName = name.getFamily();
                    dto.setPatientName(firstName + " " + lastName);
                }
            }
            if (resource instanceof Practitioner practitioner) {

                if (!practitioner.getName().isEmpty()) {
                    dto.setDoctor(
                            practitioner.getNameFirstRep().getText()
                    );
                }
            }
            if (resource instanceof Encounter encounter) {
                if (encounter.getPeriod() != null &&
                        encounter.getPeriod().getStart() != null) {
                    SimpleDateFormat sdf =
                            new SimpleDateFormat("dd MMM yyyy");
                    dto.setConsultDate(
                            sdf.format(encounter.getPeriod().getStart()));
                }
            }
            if (resource instanceof Observation obs) {

                if (obs.getCode() != null &&
                        obs.getCode().getCoding().size() > 0) {

                    String code = obs.getCode().getCodingFirstRep().getCode();

                    if ("8310-5".equals(code)) { // temperature
                        if (obs.getValue() instanceof Quantity q) {
                            vitals.setTemp(q.getValue() + " " + q.getUnit());
                        }
                    }

                    if ("85354-9".equals(code)) { // BP
                        if (obs.getValue() instanceof StringType s) {
                            vitals.setBp(s.getValue());
                        }
                    }

                    if ("75325-1".equals(code)) { // Symptoms
                        if (obs.getValue() instanceof StringType s) {
                            dto.setClinicalNotes(s.getValue());
                        }
                    }
                }
            }
        }
        dto.setVitals(vitals);
        return dto;
    }
}
