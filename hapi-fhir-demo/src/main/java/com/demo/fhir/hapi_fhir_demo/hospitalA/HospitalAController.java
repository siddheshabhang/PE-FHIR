package com.demo.fhir.hapi_fhir_demo.hospitalA;

import ca.uhn.fhir.context.FhirContext;
import com.demo.fhir.hapi_fhir_demo.hospitalA.mapper.HospitalAToFHIRMapper;
import com.demo.fhir.hapi_fhir_demo.hospitalA.model.HospitalAPatient;
import com.demo.fhir.hapi_fhir_demo.validation.FHIRValidatorUtil;
import org.hl7.fhir.r4.model.Patient;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/hospitalA")
public class HospitalAController {
    @PostMapping("/patient")
    public HospitalAPatient receivePatient(@RequestBody HospitalAPatient patient) {
        return patient;
    }

    private final FhirContext fhirContext = FhirContext.forR4();

    @PostMapping("/patient/to-fhir")
    public String convertToFHIR(@RequestBody HospitalAPatient patient) {
        // 1. Map to FHIR
        Patient fhirPatient = HospitalAToFHIRMapper.mapToFHIRPatient(patient);

        // 2. Validate
        FHIRValidatorUtil.validate(fhirPatient);

        // 3. Return FHIR JSON
        return fhirContext
                .newJsonParser()
                .setPrettyPrint(true)
                .encodeResourceToString(fhirPatient);
    }
}
