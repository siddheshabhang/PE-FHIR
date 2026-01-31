package com.demo.fhir.hapi_fhir_demo.hospitalA;

import com.demo.fhir.hapi_fhir_demo.hospitalA.model.HospitalAPatient;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/hospitalA")
public class HospitalAController {
    @PostMapping("/patient")
    public HospitalAPatient receivePatient(@RequestBody HospitalAPatient patient) {
        return patient;
    }
}
