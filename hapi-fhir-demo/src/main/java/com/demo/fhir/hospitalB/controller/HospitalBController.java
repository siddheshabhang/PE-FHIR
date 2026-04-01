package com.demo.fhir.hospitalB.controller;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.parser.IParser;
import com.demo.fhir.hospitalB.dto.HospitalBOPConsultRecordDTO;
import com.demo.fhir.hospitalB.mapper.FHIRToHospitalBMapper;
import com.demo.fhir.hospitalB.mapper.FhirBundleToHospitalBMapper;
import com.demo.fhir.hospitalB.model.HospitalBPatient;
import org.hl7.fhir.r4.model.Bundle;
import org.hl7.fhir.r4.model.Patient;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/hospitalB")
public class HospitalBController {

    private final FhirContext ctx = FhirContext.forR4();

    @PostMapping("/patient/receive-fhir")
    public HospitalBPatient receiveFHIR(@RequestBody String fhirJson) {
        //Parse FHIR JSON
        Patient patient = ctx.newJsonParser().parseResource(Patient.class, fhirJson);

        // Convert to Hospital-B format
        return FHIRToHospitalBMapper.mapToHospitalB(patient);
    }

    @PostMapping("/op-consult")
    public HospitalBOPConsultRecordDTO receiveFhirBundle(
            @RequestBody String fhirJson) {
        IParser parser = ctx.newJsonParser();
        Bundle bundle = parser.parseResource(Bundle.class, fhirJson);
        return FhirBundleToHospitalBMapper.map(bundle);
    }

}
