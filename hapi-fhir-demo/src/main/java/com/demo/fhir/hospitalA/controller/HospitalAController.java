package com.demo.fhir.hospitalA.controller;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.parser.IParser;
import com.demo.fhir.consent.model.ConsentStatus;
import com.demo.fhir.consent.service.ConsentStore;
import com.demo.fhir.hospitalA.dto.HospitalAOPConsultRecordDTO;
import com.demo.fhir.hospitalA.mapper.HospitalAOPConsultToFhirMapper;
import com.demo.fhir.hospitalA.mapper.HospitalAToFHIRMapper;
import com.demo.fhir.hospitalA.model.HospitalAPatient;
import com.demo.fhir.shared.validation.FHIRValidatorBundle;
import com.demo.fhir.shared.validation.FHIRValidatorUtil;
import org.hl7.fhir.r4.model.Bundle;
import org.hl7.fhir.r4.model.Patient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
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

    // ── Patient to FHIR ──────────────────────────────────────────────────────
    @PostMapping("/patient/to-fhir")
    public String convertToFHIR(@RequestBody HospitalAPatient patient) {
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

        // CONSENT GUARD — must be the very first check
        // TODO Phase 3: replace with ConsentService interface
        if (!consentStore.hasConsent(consultRecord.getPatientId())) {

            ConsentStatus currentStatus =
                    consentStore.getStatus(consultRecord.getPatientId());

            String reason = (currentStatus == null)
                    ? "No consent record found for patient: "
                    + consultRecord.getPatientId()
                    + ". Call POST /consent first."
                    : "Consent was explicitly DENIED for patient: "
                    + consultRecord.getPatientId()
                    + ". Data transfer is blocked.";

            // 403 FORBIDDEN — not 500, because this is an intentional business rule
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, reason);
        }

        // Consent is GRANTED — proceed with mapping and transfer
        Bundle bundle = HospitalAOPConsultToFhirMapper.mapToBundle(consultRecord);
        bundleValidator.validate(bundle);

        IParser parser = fhirContext.newJsonParser().setPrettyPrint(true);
        return parser.encodeResourceToString(bundle);
    }
}