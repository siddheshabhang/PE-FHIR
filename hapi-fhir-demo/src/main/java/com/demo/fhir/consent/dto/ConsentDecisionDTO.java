package com.demo.fhir.consent.dto;

import com.demo.fhir.consent.model.ConsentStatus;
import lombok.Data;
import java.util.Set;

@Data
public class ConsentDecisionDTO {
    private ConsentStatus decision;
    private Set<String> grantedDataTypes;
}
