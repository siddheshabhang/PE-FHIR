package com.fhir.hospitalB.mapper;

import com.fhir.hospitalB.dto.HospitalBOPConsultRecordDTO;
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
                dto.setAbhaId(patient.getId());
                dto.setPatientId("B-" + patient.getId());
                if (!patient.getName().isEmpty()) {
                    HumanName name = patient.getNameFirstRep();
                    dto.setPatientName(
                            name.getGivenAsSingleString() + " " + name.getFamily()
                    );
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
                if (encounter.getPeriod() != null
                        && encounter.getPeriod().getStart() != null) {
                    SimpleDateFormat sdf = new SimpleDateFormat("dd MMM yyyy");
                    dto.setConsultDate(sdf.format(encounter.getPeriod().getStart()));
                }
            }

            // ── Observations ─────────────────────────────────────────────────
            if (resource instanceof Observation obs) {
                if (obs.getCode() != null && !obs.getCode().getCoding().isEmpty()) {
                    String code = obs.getCode().getCodingFirstRep().getCode();

                    // Temperature
                    if ("8310-5".equals(code)) {
                        if (obs.getValue() instanceof Quantity q) {
                            vitals.setTemp(q.getValue() + " " + q.getUnit());
                        }
                    }
                    if ("85354-9".equals(code)) {
                        StringBuilder bp = new StringBuilder();
                        for (Observation.ObservationComponentComponent component
                                : obs.getComponent()) {

                            String compCode = component.getCode()
                                    .getCodingFirstRep().getCode();

                            if ("8480-6".equals(compCode)
                                    && component.getValue() instanceof Quantity q) {
                                bp.append(q.getValue().intValue()); // systolic first
                            }
                            if ("8462-4".equals(compCode)
                                    && component.getValue() instanceof Quantity q) {
                                bp.append("/").append(q.getValue().intValue());
                            }
                        }
                        vitals.setBp(bp.toString());
                    }

                    // Symptoms
                    if ("75325-1".equals(code)) {
                        if (obs.getValue() instanceof StringType s) {
                            dto.setClinicalNotes(s.getValue());
                        }
                    }
                }
            }

            // ── DocumentReference — PDF extraction ───────────────────────────
            if (resource instanceof DocumentReference docRef) {
                if (docRef.getContentFirstRep() != null
                        && docRef.getContentFirstRep().getAttachment() != null) {
                    byte[] pdfBytes = docRef.getContentFirstRep()
                            .getAttachment().getData();
                    if (pdfBytes != null) {
                        dto.setPrescriptionPdfBase64(
                                Base64.getEncoder().encodeToString(pdfBytes)
                        );
                    }
                }
            }

            // ── Consent verification ─────────────────────────────────────────
            // Hospital B independently verifies that a valid Consent exists
            // inside the received Bundle before trusting the data.
            // If consent is missing or not ACTIVE + PERMIT, we flag it.
            if (resource instanceof Consent consent) {
                boolean isActive = Consent.ConsentState.ACTIVE
                        .equals(consent.getStatus());
                boolean isPermit = consent.getProvision() != null
                        && Consent.ConsentProvisionType.PERMIT
                        .equals(consent.getProvision().getType());

                if (isActive && isPermit) {
                    dto.setConsentVerified(true);
                } else {
                    dto.setConsentVerified(false);
                }
            }
        }
        dto.setVitals(vitals);
        return dto;
    }
}