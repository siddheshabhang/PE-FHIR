package com.demo.fhir.hapi_fhir_demo.hospitalB.model;

import lombok.Data;

@Data
public class HospitalBPatient {
    private String uhid;
    private String fullName;
    private String dateOfBirth;
    private String gender;
}