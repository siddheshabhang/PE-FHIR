package com.demo.fhir.hapi_fhir_demo.validation;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.validation.FhirValidator;
import ca.uhn.fhir.validation.ValidationResult;
import org.hl7.fhir.instance.model.api.IBaseResource;

public class FHIRValidatorUtil {
    private static final FhirContext ctx = FhirContext.forR4();

    public static void validate(IBaseResource resource) {
        FhirValidator validator = ctx.newValidator();
        ValidationResult result = validator.validateWithResult(resource);
        if (!result.isSuccessful()) {
            throw new RuntimeException("FHIR Validation Failed: " +
                    result.getMessages().toString());
        }
    }
}
