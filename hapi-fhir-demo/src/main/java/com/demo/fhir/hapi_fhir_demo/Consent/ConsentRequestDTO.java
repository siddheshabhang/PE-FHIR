package com.demo.fhir.hapi_fhir_demo.consent;

import lombok.Data;

@Data
public class ConsentRequestDTO {
    private String patientId;
    private boolean consentGranted;
}