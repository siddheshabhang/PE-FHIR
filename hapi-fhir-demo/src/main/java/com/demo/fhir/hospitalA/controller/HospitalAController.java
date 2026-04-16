package com.demo.fhir.hospitalA.controller;

import com.demo.fhir.hospitalA.dto.HospitalAOPConsultRecordDTO;
import com.demo.fhir.hospitalA.dto.PatientPushRequestDTO;
import com.demo.fhir.hospitalA.model.HospitalAPatient;
import com.demo.fhir.hospitalA.service.HospitalAService;
import com.demo.fhir.shared.security.SecurityContextHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * HTTP adapter for Hospital A endpoints.
 * <p>
 * Responsibilities: parse HTTP requests, extract authentication context, and
 * delegate to {@link HospitalAService}.  No business logic lives here.
 */
@RestController
@RequestMapping("/hospitalA")
public class HospitalAController {

    @Autowired
    private HospitalAService hospitalAService;

    @Autowired
    private SecurityContextHelper securityContextHelper;

    // ── Patient to FHIR ──────────────────────────────────────────────────────

    @PostMapping("/patient/to-fhir")
    public String convertToFHIR(@RequestBody HospitalAPatient patient) {
        return hospitalAService.convertPatientToFhir(patient);
    }

    // ── Doctor-Initiated OP Consult ──────────────────────────────────────────

    @PostMapping("/op-consult")
    public String receiveOPConsult(@RequestBody HospitalAOPConsultRecordDTO consultRecord) {
        String requesterId = securityContextHelper.getCurrentUsername();
        return hospitalAService.processOPConsult(consultRecord, requesterId);
    }

    // ── Patient-Initiated Push Flow ──────────────────────────────────────────

    @PostMapping("/op-consult/push")
    public String pushOPConsult(@RequestBody PatientPushRequestDTO pushRequest) {
        if (!securityContextHelper.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthenticated request");
        }
        // Extract patientId from the JWT claim — the service needs the actual patient ID,
        // not just the username, so we use extractPatientId() which reads the JWT claim.
        String patientId = securityContextHelper.extractPatientId();
        return hospitalAService.pushOPConsult(pushRequest, patientId);
    }
}