package com.demo.fhir.consent.controller;

import com.demo.fhir.consent.dto.ConsentDecisionDTO;
import com.demo.fhir.consent.dto.ConsentRequestViewDTO;
import com.demo.fhir.consent.dto.InitiateConsentDTO;
import com.demo.fhir.consent.service.ConsentStore;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/consent")
public class ConsentController {

    @Autowired
    private ConsentStore consentStore;

    private String getCurrentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getName() != null) {
            return auth.getName();
        }
        return "system";
    }

    // ── Initiate consent request (Requester) ─────────────────────────────────
    @PostMapping("/initiate")
    public ConsentRequestViewDTO initiateConsent(@RequestBody InitiateConsentDTO initiateDTO) {
        String requesterId = getCurrentUsername();
        return consentStore.initiateRequest(initiateDTO, requesterId);
    }

    // ── View pending requests (Patient) ──────────────────────────────────────
    @GetMapping("/pending/{patientId}")
    public List<ConsentRequestViewDTO> getPendingRequests(@PathVariable String patientId) {
        // Optionally validate patientId against getCurrentUsername()
        return consentStore.getPendingRequests(patientId);
    }

    // ── Respond to request (Patient) ─────────────────────────────────────────
    @PostMapping("/respond/{requestId}")
    public ConsentRequestViewDTO respondToRequest(
            @PathVariable Long requestId,
            @RequestBody ConsentDecisionDTO decisionDTO) {
        String patientId = getCurrentUsername(); // Deriving patient identity from auth context
        return consentStore.processDecision(requestId, patientId, decisionDTO);
    }

    // ── Revoke consent (Patient) ─────────────────────────────────────────────
    // Breaking Change: Replacing POST /consent/revoke/{patientId} with POST /consent/revoke/{requestId}
    @PostMapping("/revoke/{requestId}")
    public String revokeConsent(@PathVariable Long requestId) {
        String patientId = getCurrentUsername();
        consentStore.revoke(requestId, patientId);
        return "Consent REVOKED for request ID: " + requestId;
    }
}
