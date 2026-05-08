package com.fhir.auth.service;

import com.fhir.auth.dto.RegisterRequest;
import com.fhir.auth.model.AppUser;
import com.fhir.auth.model.UserRole;
import com.fhir.auth.repository.AuthUserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class PatientRegistrationService {

    private static final SecureRandom RANDOM = new SecureRandom();

    @Autowired
    private AuthService authService;

    @Autowired
    private AuthUserRepository authUserRepository;

    @Transactional
    public Map<String, Object> registerPatient(RegisterRequest request) {
        String generatedAbhaId = generateUniqueAbhaId();

        request.setAbhaId(generatedAbhaId);
        request.setRole(UserRole.PATIENT);

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

    @Transactional(readOnly = true)
    public Map<String, Object> getPatientByAbhaId(String abhaId) {
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
        return patient;
    }

    private String generateUniqueAbhaId() {
        String abhaId;
        do {
            abhaId = String.format(
                    "ABHA-%04d-%04d-%04d-%02d",
                    nextNumber(1000, 9999),
                    nextNumber(1000, 9999),
                    nextNumber(1000, 9999),
                    nextNumber(10, 99)
            );
        } while (authUserRepository.findByAbhaId(abhaId).isPresent());
        return abhaId;
    }

    private int nextNumber(int minInclusive, int maxInclusive) {
        return RANDOM.nextInt(maxInclusive - minInclusive + 1) + minInclusive;
    }
}
