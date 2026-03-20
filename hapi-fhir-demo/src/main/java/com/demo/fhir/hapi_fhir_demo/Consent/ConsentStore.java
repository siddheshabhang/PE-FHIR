package com.demo.fhir.hapi_fhir_demo.consent;

import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
public class ConsentStore {

    private final Map<String, ConsentStatus> consentMap = new HashMap<>();

    public void store(String patientId, ConsentStatus status) {
        consentMap.put(patientId, status);
    }

    public boolean hasConsent(String patientId) {
        return ConsentStatus.GRANTED.equals(consentMap.get(patientId));
    }

    public ConsentStatus getStatus(String patientId) {
        return consentMap.get(patientId);
    }

    public void revoke(String patientId) {
        consentMap.put(patientId, ConsentStatus.DENIED);
    }
}