package com.demo.fhir.hapi_fhir_demo.hospitalB;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HospitalBController {

    @GetMapping("/hospitalB/ping")
    public String pingHospitalB() {
        return "Hospital B system is up";
    }
}
