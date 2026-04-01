package com.demo.fhir.consent.controller;

import com.demo.fhir.consent.dto.ConsentRequestDTO;
import com.demo.fhir.consent.model.ConsentStatus;
import com.demo.fhir.consent.service.ConsentStore;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/consent")
public class ConsentController {

    @Autowired
    private ConsentStore consentStore;

    // ── Give consent ─────────────────────────────────────────────────────────
    @PostMapping
    public String giveConsent(@RequestBody ConsentRequestDTO consentRequest) {
        ConsentStatus status = consentRequest.isConsentGranted()
                ? ConsentStatus.GRANTED
                : ConsentStatus.DENIED;
        consentStore.store(consentRequest.getPatientId(), status);
        return "Consent " + status.name()
                + " for patient: " + consentRequest.getPatientId();
    }

    // ── Revoke consent ───────────────────────────────────────────────────────
    @PostMapping("/revoke/{patientId}")
    public String revokeConsent(@PathVariable String patientId) {
        consentStore.revoke(patientId);
        return "Consent REVOKED for patient: " + patientId;
    }
}
