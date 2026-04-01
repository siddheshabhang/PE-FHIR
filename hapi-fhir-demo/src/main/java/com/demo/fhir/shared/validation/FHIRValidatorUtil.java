package com.demo.fhir.shared.validation;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.context.support.DefaultProfileValidationSupport;
import ca.uhn.fhir.validation.FhirValidator;
import ca.uhn.fhir.validation.ValidationResult;
import org.hl7.fhir.common.hapi.validation.support.CommonCodeSystemsTerminologyService;
import org.hl7.fhir.common.hapi.validation.support.InMemoryTerminologyServerValidationSupport;
import org.hl7.fhir.common.hapi.validation.support.ValidationSupportChain;
import org.hl7.fhir.common.hapi.validation.validator.FhirInstanceValidator;
import org.hl7.fhir.instance.model.api.IBaseResource;

public class FHIRValidatorUtil {
    private static final FhirContext ctx = FhirContext.forR4();
    public static void validate(IBaseResource resource) {
        FhirValidator validator = ctx.newValidator();

        //same ValidationSupportChain as FHIRValidatorBundle.
        ValidationSupportChain supportChain = new ValidationSupportChain(
                new DefaultProfileValidationSupport(ctx),
                new InMemoryTerminologyServerValidationSupport(ctx),
                new CommonCodeSystemsTerminologyService(ctx)
        );

        FhirInstanceValidator instanceValidator = new FhirInstanceValidator(supportChain);
        validator.registerValidatorModule(instanceValidator);

        ValidationResult result = validator.validateWithResult(resource);

        if (!result.isSuccessful()) {
            throw new RuntimeException(
                    "FHIR Validation Failed: " + result.getMessages().toString()
            );
        }
    }
}