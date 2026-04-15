package com.demo.fhir.consent.dto;

import com.demo.fhir.consent.model.ConsentStatus;
import lombok.Data;

@Data
public class ConsentDecisionDTO {
    private ConsentStatus decision;
}
