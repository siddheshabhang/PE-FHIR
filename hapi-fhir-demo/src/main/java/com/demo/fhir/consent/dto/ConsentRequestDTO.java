package com.demo.fhir.consent.dto;

import lombok.Data;

@Data
public class ConsentRequestDTO {
    private String patientId;
    private boolean consentGranted;
}