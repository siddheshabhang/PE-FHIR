package com.fhir.hospitalA.dto;

import lombok.Data;
import java.util.Set;

@Data
public class PatientPushRequestDTO {
    private String targetRequesterId;
    private Set<String> dataTypes;
}
