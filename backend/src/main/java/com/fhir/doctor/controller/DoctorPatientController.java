package com.fhir.doctor.controller;

import com.fhir.auth.dto.RegisterRequest;
import com.fhir.auth.model.AppUser;
import com.fhir.auth.model.UserRole;
import com.fhir.auth.service.AuthService;
import com.fhir.doctor.dto.DoctorPatientRequestDTO;
import com.fhir.hospitalA.model.HospitalAPatient;
import com.fhir.hospitalA.repository.HospitalAPatientRepository;
import com.fhir.hospitalB.model.HospitalBPatient;
import com.fhir.hospitalB.repository.HospitalBPatientRepository;
import com.fhir.shared.security.SecurityContextHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
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
    private HospitalBPatientRepository hospitalBPatientRepository;

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
        registerRequest.setAbhaId(request.getAbhaId() != null ? request.getAbhaId() : generatedPatientId);
        registerRequest.setHospitalId(doctorHospitalId); // associate patient with doctor's hospital
        registerRequest.setFullName(request.getFirstName() + " " + request.getLastName());
        registerRequest.setEmail(request.getEmail());
        registerRequest.setPhone(request.getPhone());
        
        // This will throw if username is taken, a robust app would loop or add random digits
        AppUser savedUser = authService.register(registerRequest);

        // 2. Save clinical record based on Hospital
        if ("HOSP-A".equals(doctorHospitalId)) {
            HospitalAPatient clinicalRecord = new HospitalAPatient();
            clinicalRecord.setPatientId(generatedPatientId);
            clinicalRecord.setAbhaId(request.getAbhaId());
            clinicalRecord.setName(request.getFirstName() + " " + request.getLastName());
            clinicalRecord.setDob(request.getDateOfBirth());
            clinicalRecord.setGender(request.getGender());
            hospitalAPatientRepository.save(clinicalRecord);
        } else if ("HOSP-B".equals(doctorHospitalId)) {
            HospitalBPatient clinicalRecord = new HospitalBPatient();
            clinicalRecord.setPatientId(generatedPatientId);
            clinicalRecord.setAbhaId(request.getAbhaId());
            clinicalRecord.setFullName(request.getFirstName() + " " + request.getLastName());
            clinicalRecord.setDateOfBirth(request.getDateOfBirth());
            clinicalRecord.setGender(request.getGender());
            hospitalBPatientRepository.save(clinicalRecord);
        }

        // 3. Return credentials to doctor to hand to patient
        return Map.of(
            "message", "Patient created successfully",
            "patientId", generatedPatientId,
            "username", tempUsername,
            "tempPassword", tempPassword,
            "hospitalId", doctorHospitalId != null ? doctorHospitalId : "N/A"
        );
    }

    @PostMapping("/link/{abhaId}")
    public Map<String, String> linkPatientByAbhaId(@PathVariable String abhaId) {
        String doctorHospitalId = securityContextHelper.extractHospitalId();
        if (doctorHospitalId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Doctor is not associated with a hospital");
        }

        AppUser user = authService.findByAbhaId(abhaId);
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Patient with ABHA-ID not found");
        }

        String generatedPatientId = "P-" + (int)(Math.random() * 9000 + 1000);

        if ("HOSP-A".equals(doctorHospitalId)) {
            HospitalAPatient clinicalRecord = new HospitalAPatient();
            clinicalRecord.setPatientId(generatedPatientId);
            clinicalRecord.setAbhaId(abhaId);
            clinicalRecord.setName(user.getFullName());
            clinicalRecord.setDob(user.getDateOfBirth());
            clinicalRecord.setGender(user.getGender());
            hospitalAPatientRepository.save(clinicalRecord);
        } else if ("HOSP-B".equals(doctorHospitalId)) {
            HospitalBPatient clinicalRecord = new HospitalBPatient();
            clinicalRecord.setPatientId(generatedPatientId);
            clinicalRecord.setAbhaId(abhaId);
            clinicalRecord.setFullName(user.getFullName());
            clinicalRecord.setDateOfBirth(user.getDateOfBirth());
            clinicalRecord.setGender(user.getGender());
            hospitalBPatientRepository.save(clinicalRecord);
        }

        return Map.of(
            "message", "Patient linked to hospital successfully",
            "abhaId", abhaId,
            "localPatientId", generatedPatientId,
            "hospitalId", doctorHospitalId
        );
    }
}
