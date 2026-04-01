package com.demo.fhir.auth.dto;

import com.demo.fhir.auth.model.UserRole;
import lombok.Data;

@Data
public class RegisterRequest {
    private String username;
    private String password;
    private UserRole role;
    /** Only required when role = PATIENT */
    private String patientId;
}
