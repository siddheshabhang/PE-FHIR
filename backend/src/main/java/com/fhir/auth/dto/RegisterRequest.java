package com.fhir.auth.dto;

import com.fhir.auth.model.UserRole;
import lombok.Data;

@Data
public class RegisterRequest {
    private String username;
    private String password;
    private UserRole role;
    /** Only required when role = PATIENT */
    private String patientId;
    
    private String email;
    private String phone;
}
