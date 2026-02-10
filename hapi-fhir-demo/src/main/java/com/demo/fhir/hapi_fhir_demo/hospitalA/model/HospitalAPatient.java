package com.demo.fhir.hapi_fhir_demo.hospitalA.model;

import lombok.Data;

@Data
public class HospitalAPatient {
    private String patientId;   // Local hospital ID
    private String name;        // Full name
    private String dob;         // dd/MM/yyyy (NON-FHIR)
    private String gender;      // M / F
}
