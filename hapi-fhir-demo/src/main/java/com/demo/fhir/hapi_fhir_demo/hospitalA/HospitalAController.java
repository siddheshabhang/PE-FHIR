package com.demo.fhir.hapi_fhir_demo.hospitalA;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.parser.IParser;
import com.demo.fhir.hapi_fhir_demo.hospitalA.Dto.HospitalAOPConsultRecordDTO;
import com.demo.fhir.hapi_fhir_demo.hospitalA.mapper.HospitalAOPConsultToFhirMapper;
import com.demo.fhir.hapi_fhir_demo.hospitalA.mapper.HospitalAToFHIRMapper;
import com.demo.fhir.hapi_fhir_demo.hospitalA.model.HospitalAPatient;
import com.demo.fhir.hapi_fhir_demo.validation.FHIRValidatorBundle;
import com.demo.fhir.hapi_fhir_demo.validation.FHIRValidatorUtil;
import org.hl7.fhir.r4.model.Bundle;
import org.hl7.fhir.r4.model.Patient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/hospitalA")
public class HospitalAController {
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

    @Autowired
    private FHIRValidatorBundle bundleValidator;

    @PostMapping("/op-consult")
    public String receiveOPConsult
            (@RequestBody HospitalAOPConsultRecordDTO consultRecord) {
        Bundle bundle = HospitalAOPConsultToFhirMapper.mapToBundle(consultRecord);
        bundleValidator.validate(bundle);
        IParser parser = fhirContext.newJsonParser().setPrettyPrint(true);
        return parser.encodeResourceToString(bundle);
    }
}
