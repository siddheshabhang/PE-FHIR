package com.fhir.identity.dto;

import lombok.Data;

@Data
public class RegisterPatientDTO {
    private String hospitalAId;
    private String hospitalBId;
    private String name;
}
