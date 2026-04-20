package com.fhir.hospitalB.controller;

import com.fhir.hospitalB.dto.HospitalBOPConsultRecordDTO;
import com.fhir.hospitalB.model.HospitalBPatient;
import com.fhir.hospitalB.service.HospitalBService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

/**
 * HTTP adapter for Hospital B endpoints.
 * <p>
 * Responsibilities: accept HTTP requests and delegate to
 * {@link HospitalBService}.  No parsing or mapping logic lives here.
 */
@RestController
@RequestMapping("/hospitalB")
public class HospitalBController {

    @Autowired
    private HospitalBService hospitalBService;

    // ── Receive a FHIR Patient ───────────────────────────────────────────────

    @PostMapping("/patient/receive-fhir")
    public HospitalBPatient receiveFHIR(@RequestBody String fhirJson) {
        return hospitalBService.receiveFhirPatient(fhirJson);
    }

    // ── Receive a FHIR Bundle (OP Consult) ───────────────────────────────────

    @PostMapping("/op-consult")
    public HospitalBOPConsultRecordDTO receiveFhirBundle(@RequestBody String fhirJson) {
        return hospitalBService.receiveFhirBundle(fhirJson);
    }
}
