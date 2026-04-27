package com.fhir.auth.controller;

import com.fhir.auth.dto.RegisterRequest;
import com.fhir.auth.model.AppUser;
import com.fhir.auth.model.UserRole;
import com.fhir.auth.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import com.fhir.auth.repository.AuthUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/auth/register/patient")
public class PatientRegistrationController {

    @Autowired
    private AuthService authService;

    @Autowired
    private AuthUserRepository authUserRepository;

    @PostMapping
    public Map<String, Object> registerPatient(@RequestBody RegisterRequest request) {
        // Generate a 14-digit ABHA-ID format (e.g. ABHA-1234-5678-9012-34)
        String generatedAbhaId = "ABHA-" + 
            (int)(Math.random() * 9000 + 1000) + "-" + 
            (int)(Math.random() * 9000 + 1000) + "-" + 
            (int)(Math.random() * 9000 + 1000) + "-" + 
            (int)(Math.random() * 90 + 10);

        request.setAbhaId(generatedAbhaId);
        request.setRole(UserRole.PATIENT);
        
        // Use email or phone as username if username is not provided
        if (request.getUsername() == null || request.getUsername().isEmpty()) {
            request.setUsername(request.getEmail() != null ? request.getEmail() : generatedAbhaId);
        }

        AppUser savedUser = authService.register(request);

        return Map.of(
            "message", "Patient registered successfully",
            "abhaId", generatedAbhaId,
            "username", savedUser.getUsername()
        );
    }

    @GetMapping("/{abhaId}")
    public Map<String, Object> getPatientByAbhaId(@PathVariable String abhaId) {
        AppUser user = authUserRepository.findByAbhaId(abhaId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Patient not found"));

        Map<String, Object> patient = new LinkedHashMap<>();
        patient.put("abhaId", user.getAbhaId());
        patient.put("username", user.getUsername());
        patient.put("fullName", user.getFullName());
        patient.put("email", user.getEmail());
        patient.put("phone", user.getPhone());
        patient.put("gender", user.getGender());
        patient.put("dateOfBirth", user.getDateOfBirth());
        patient.put("bloodGroup", user.getBloodGroup());
        patient.put("hospitalId", user.getHospitalId());
        patient.put("role", user.getRole());
        return patient;
    }
}
