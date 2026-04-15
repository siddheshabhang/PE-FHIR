package com.demo.fhir.consent.dto;

import lombok.Data;
import java.util.Set;

@Data
public class InitiateConsentDTO {
    private String patientId;
    private String purpose;
    private Set<String> requestedDataTypes;
}
