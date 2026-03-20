package com.demo.fhir.hapi_fhir_demo.hospitalA;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.parser.IParser;
import com.demo.fhir.hapi_fhir_demo.consent.ConsentRequestDTO;
import com.demo.fhir.hapi_fhir_demo.consent.ConsentStatus;
import com.demo.fhir.hapi_fhir_demo.consent.ConsentStore;
import com.demo.fhir.hapi_fhir_demo.hospitalA.Dto.HospitalAOPConsultRecordDTO;
import com.demo.fhir.hapi_fhir_demo.hospitalA.mapper.HospitalAOPConsultToFhirMapper;
import com.demo.fhir.hapi_fhir_demo.hospitalA.mapper.HospitalAToFHIRMapper;
import com.demo.fhir.hapi_fhir_demo.hospitalA.model.HospitalAPatient;
import com.demo.fhir.hapi_fhir_demo.validation.FHIRValidatorBundle;
import com.demo.fhir.hapi_fhir_demo.validation.FHIRValidatorUtil;
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

    @Autowired
    private ConsentStore consentStore;

    // ── Consent endpoint ─────────────────────────────────────────────────────
    @PostMapping("/consent")
    public String giveConsent(@RequestBody ConsentRequestDTO consentRequest) {
        ConsentStatus status = consentRequest.isConsentGranted()
                ? ConsentStatus.GRANTED
                : ConsentStatus.DENIED;
        consentStore.store(consentRequest.getPatientId(), status);
        return "Consent " + status.name()
                + " for patient: " + consentRequest.getPatientId();
    }

    // ── Consent revoke endpoint ──────────────────────────────────────────────
    @PostMapping("/consent/revoke/{patientId}")
    public String revokeConsent(@PathVariable String patientId) {
        consentStore.revoke(patientId);
        return "Consent REVOKED for patient: " + patientId;
    }

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
        if (!consentStore.hasConsent(consultRecord.getPatientId())) {

            ConsentStatus currentStatus =
                    consentStore.getStatus(consultRecord.getPatientId());

            String reason = (currentStatus == null)
                    ? "No consent record found for patient: "
                    + consultRecord.getPatientId()
                    + ". Call POST /hospitalA/consent first."
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