package com.fhir.hie.client;

import com.fhir.hospitalA.service.HospitalAService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * MVP implementation: direct in-JVM call to HospitalAService.
 * In production this becomes a REST call to Hospital A's FHIR endpoint.
 * The interface stays identical — swap only this class.
 */
@Component
public class HIPFhirClientImpl implements HIPFhirClient {

    @Autowired
    private HospitalAService hospitalAService;

    @Override
    public String pullBundle(String patientId, String consentToken, Set<String> scope) {
        return hospitalAService.pullFhirBundle(patientId, consentToken, scope);
    }
}
