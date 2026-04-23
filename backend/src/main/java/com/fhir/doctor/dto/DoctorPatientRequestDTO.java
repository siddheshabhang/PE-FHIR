package com.fhir.doctor.dto;

import lombok.Data;

@Data
public class DoctorPatientRequestDTO {
    private String abhaId;
    private String firstName;
    private String lastName;
    private String dateOfBirth; // dd/MM/yyyy
    private String gender; // M / F
    private String phone;
    private String email;
}
