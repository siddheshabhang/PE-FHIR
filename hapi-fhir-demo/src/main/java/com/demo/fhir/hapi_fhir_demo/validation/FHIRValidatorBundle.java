package com.demo.fhir.hapi_fhir_demo.validation;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.validation.FhirValidator;
import ca.uhn.fhir.validation.ValidationResult;
import org.hl7.fhir.r4.model.Bundle;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class FHIRValidatorBundle {
    @Autowired
    private FhirContext fhirContext;

    public void validate(Bundle bundle) {
        FhirValidator validator = fhirContext.newValidator();
        ValidationResult result = validator.validateWithResult(bundle);

        if(!result.isSuccessful()) {
            throw new RuntimeException("FHIR Bundle Validation Failed: "
            + result.getMessages().toString());
        }
    }
}
