package com.fhir.doctor.controller;

import com.fhir.auth.dto.RegisterRequest;
import com.fhir.auth.model.AppUser;
import com.fhir.auth.model.UserRole;
import com.fhir.auth.service.AuthService;
import com.fhir.doctor.dto.DoctorPatientLookupResponseDTO;
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
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@RestController
@RequestMapping("/doctor/patients")
public class DoctorPatientController {

    private static final String HOSPITAL_A_PATIENT_PREFIX = "HA-P-";
    private static final String HOSPITAL_B_PATIENT_PREFIX = "HB-P-";

    @Autowired
    private AuthService authService;

    @Autowired
    private HospitalAPatientRepository hospitalAPatientRepository;

    @Autowired
    private HospitalBPatientRepository hospitalBPatientRepository;

    @Autowired
    private SecurityContextHelper securityContextHelper;

    @GetMapping("/lookup/{identifier}")
    public DoctorPatientLookupResponseDTO lookupPatient(@PathVariable String identifier) {
        String doctorHospitalId = securityContextHelper.extractHospitalId();
        if (doctorHospitalId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Doctor is not associated with a hospital");
        }

        DoctorPatientLookupResponseDTO localMatch = findLocalPatient(identifier, doctorHospitalId);
        if (localMatch != null) {
            return localMatch;
        }

        AppUser globalUser = authService.findByAbhaId(identifier);
        if (globalUser != null && globalUser.getRole() == UserRole.PATIENT) {
            return new DoctorPatientLookupResponseDTO(
                    null,
                    globalUser.getAbhaId(),
                    globalUser.getFullName(),
                    globalUser.getDateOfBirth(),
                    globalUser.getGender(),
                    "GLOBAL"
            );
        }

        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Patient not found for identifier: " + identifier);
    }

    @PostMapping
    public Map<String, String> createPatient(@RequestBody DoctorPatientRequestDTO request) {
        String doctorHospitalId = securityContextHelper.extractHospitalId();
        String generatedPatientId = generateLocalPatientId(doctorHospitalId);
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

        DoctorPatientLookupResponseDTO existingLocalPatient = findLocalPatient(abhaId, doctorHospitalId);
        if (existingLocalPatient != null && "LOCAL".equals(existingLocalPatient.getSource())) {
            return Map.of(
                    "message", "Patient already linked to hospital",
                    "abhaId", abhaId,
                    "localPatientId", existingLocalPatient.getPatientId(),
                    "hospitalId", doctorHospitalId,
                    "fullName", existingLocalPatient.getFullName() != null ? existingLocalPatient.getFullName() : ""
            );
        }

        AppUser user = authService.findByAbhaId(abhaId);
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Patient with ABHA-ID not found");
        }

        String generatedPatientId = generateLocalPatientId(doctorHospitalId);

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
            "hospitalId", doctorHospitalId,
            "fullName", user.getFullName() != null ? user.getFullName() : ""
        );
    }

    private String generateLocalPatientId(String hospitalId) {
        String prefix = switch (hospitalId) {
            case "HOSP-A" -> HOSPITAL_A_PATIENT_PREFIX;
            case "HOSP-B" -> HOSPITAL_B_PATIENT_PREFIX;
            default -> "PX-P-";
        };
        int sequence = ThreadLocalRandom.current().nextInt(1000, 10000);
        return prefix + sequence;
    }

    private DoctorPatientLookupResponseDTO findLocalPatient(String identifier, String doctorHospitalId) {
        if ("HOSP-A".equals(doctorHospitalId)) {
            Optional<HospitalAPatient> patient = hospitalAPatientRepository.findById(identifier);
            if (patient.isEmpty()) {
                patient = hospitalAPatientRepository.findByAbhaId(identifier);
            }
            return patient
                    .map(value -> new DoctorPatientLookupResponseDTO(
                            value.getPatientId(),
                            value.getAbhaId(),
                            value.getName(),
                            value.getDob(),
                            value.getGender(),
                            "LOCAL"
                    ))
                    .orElse(null);
        }

        if ("HOSP-B".equals(doctorHospitalId)) {
            Optional<HospitalBPatient> patient = hospitalBPatientRepository.findByPatientId(identifier);
            if (patient.isEmpty()) {
                patient = hospitalBPatientRepository.findByAbhaId(identifier);
            }
            return patient
                    .map(value -> new DoctorPatientLookupResponseDTO(
                            value.getPatientId(),
                            value.getAbhaId(),
                            value.getFullName(),
                            value.getDateOfBirth(),
                            value.getGender(),
                            "LOCAL"
                    ))
                    .orElse(null);
        }

        return null;
    }
}
