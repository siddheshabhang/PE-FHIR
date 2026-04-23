package com.fhir.doctor.controller;

import com.fhir.auth.dto.RegisterRequest;
import com.fhir.auth.model.AppUser;
import com.fhir.auth.model.UserRole;
import com.fhir.auth.service.AuthService;
import com.fhir.doctor.dto.DoctorPatientRequestDTO;
import com.fhir.hospitalA.model.HospitalAPatient;
import com.fhir.hospitalA.repository.HospitalAPatientRepository;
import com.fhir.shared.security.SecurityContextHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/doctor/patients")
public class DoctorPatientController {

    @Autowired
    private AuthService authService;

    @Autowired
    private HospitalAPatientRepository hospitalAPatientRepository;

    @Autowired
    private SecurityContextHelper securityContextHelper;

    @PostMapping
    public Map<String, String> createPatient(@RequestBody DoctorPatientRequestDTO request) {
        String doctorHospitalId = securityContextHelper.extractHospitalId();
        String generatedPatientId = "P-" + (int)(Math.random() * 9000 + 1000);
        String tempUsername = request.getFirstName().toLowerCase() + "." + request.getLastName().toLowerCase();
        String tempPassword = UUID.randomUUID().toString().substring(0, 8); // simple temp password

        // 1. Create AppUser so patient can login
        RegisterRequest registerRequest = new RegisterRequest();
        registerRequest.setUsername(tempUsername);
        registerRequest.setPassword(tempPassword);
        registerRequest.setRole(UserRole.PATIENT);
        registerRequest.setPatientId(generatedPatientId);
        registerRequest.setHospitalId(doctorHospitalId); // associate patient with doctor's hospital
        registerRequest.setFullName(request.getFirstName() + " " + request.getLastName());
        registerRequest.setEmail(request.getEmail());
        registerRequest.setPhone(request.getPhone());
        
        // This will throw if username is taken, a robust app would loop or add random digits
        AppUser savedUser = authService.register(registerRequest);

        // 2. Save clinical record (For demo, just mapping to HospitalA's patient table)
        HospitalAPatient clinicalRecord = new HospitalAPatient();
        clinicalRecord.setPatientId(generatedPatientId);
        clinicalRecord.setName(request.getFirstName() + " " + request.getLastName());
        clinicalRecord.setDob(request.getDateOfBirth());
        clinicalRecord.setGender(request.getGender());
        hospitalAPatientRepository.save(clinicalRecord);

        // 3. Return credentials to doctor to hand to patient
        return Map.of(
            "message", "Patient created successfully",
            "patientId", generatedPatientId,
            "username", tempUsername,
            "tempPassword", tempPassword,
            "hospitalId", doctorHospitalId != null ? doctorHospitalId : "N/A"
        );
    }
}
