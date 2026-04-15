package com.demo.fhir.consent.dto;

import lombok.Data;

@Data
public class InitiateConsentDTO {
    private String patientId;
    private String purpose;
}
