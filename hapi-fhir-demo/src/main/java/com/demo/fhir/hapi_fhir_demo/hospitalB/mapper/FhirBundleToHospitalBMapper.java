package com.demo.fhir.hapi_fhir_demo.hospitalB.mapper;

import com.demo.fhir.hapi_fhir_demo.hospitalB.Dto.HospitalBOPConsultRecordDTO;
import org.hl7.fhir.r4.model.*;

import java.text.SimpleDateFormat;
import java.util.Base64;

public class FhirBundleToHospitalBMapper {
    public static HospitalBOPConsultRecordDTO map(Bundle bundle) {
        HospitalBOPConsultRecordDTO dto = new HospitalBOPConsultRecordDTO();
        HospitalBOPConsultRecordDTO.Vitals vitals = new HospitalBOPConsultRecordDTO.Vitals();
        for (Bundle.BundleEntryComponent entry : bundle.getEntry()) {
            Resource resource = entry.getResource();

            // ── Patient ──────────────────────────────────────────────────────
            if (resource instanceof Patient patient) {
                dto.setUhid("B-" + patient.getId());
                if (!patient.getName().isEmpty()) {
                    HumanName name = patient.getNameFirstRep();
                    String firstName = name.getGivenAsSingleString();
                    String lastName = name.getFamily();
                    dto.setPatientName(firstName + " " + lastName);
                }
            }

            // ── Practitioner ─────────────────────────────────────────────────
            if (resource instanceof Practitioner practitioner) {
                if (!practitioner.getName().isEmpty()) {
                    dto.setDoctor(practitioner.getNameFirstRep().getText());
                }
            }

            // ── Encounter ────────────────────────────────────────────────────
            if (resource instanceof Encounter encounter) {
                if (encounter.getPeriod() != null && encounter.getPeriod().getStart() != null) {
                    SimpleDateFormat sdf = new SimpleDateFormat("dd MMM yyyy");
                    dto.setConsultDate(sdf.format(encounter.getPeriod().getStart()));
                }
            }

            // ── Observations (vitals + symptoms) ─────────────────────────────
            if (resource instanceof Observation obs) {
                if (obs.getCode() != null && !obs.getCode().getCoding().isEmpty()) {
                    String code = obs.getCode().getCodingFirstRep().getCode();

                    if ("8310-5".equals(code)) {                    // Temperature
                        if (obs.getValue() instanceof Quantity q) {
                            vitals.setTemp(q.getValue() + " " + q.getUnit());
                        }
                    }
                    if ("85354-9".equals(code)) {                   // Blood Pressure
                        if (obs.getValue() instanceof StringType s) {
                            vitals.setBp(s.getValue());
                        }
                    }
                    if ("75325-1".equals(code)) {                   // Symptoms
                        if (obs.getValue() instanceof StringType s) {
                            dto.setClinicalNotes(s.getValue());
                        }
                    }
                }
            }

            // ── DocumentReference (PDF extraction) ───────────────────────────
            // Hospital B checks every Bundle entry for a DocumentReference.
            // If found, it reads the raw byte[] from the attachment and
            // re-encodes it to Base64 so Hospital B's DTO can carry it.
            // Hospital B can then decode this string to reconstruct the PDF file.
            if (resource instanceof DocumentReference docRef) {
                if (docRef.getContentFirstRep() != null
                        && docRef.getContentFirstRep().getAttachment() != null) {

                    byte[] pdfBytes = docRef.getContentFirstRep()
                            .getAttachment()
                            .getData();

                    if (pdfBytes != null) {
                        // byte[] → Base64 String (so DTO can carry it as JSON)
                        String base64Pdf = Base64.getEncoder().encodeToString(pdfBytes);
                        dto.setPrescriptionPdfBase64(base64Pdf);
                    }
                }
            }
        }

        dto.setVitals(vitals);
        return dto;
    }
}