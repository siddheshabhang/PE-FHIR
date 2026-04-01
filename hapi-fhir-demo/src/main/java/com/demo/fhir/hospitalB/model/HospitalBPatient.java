package com.demo.fhir.hospitalB.model;

import lombok.Data;

@Data
public class HospitalBPatient {
    private String uhid;
    private String fullName;
    private String dateOfBirth;
    private String gender;
}