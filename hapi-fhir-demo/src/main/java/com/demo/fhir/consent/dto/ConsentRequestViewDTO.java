package com.demo.fhir.consent.dto;

import com.demo.fhir.consent.model.ConsentStatus;
import lombok.Data;
import java.time.Instant;

@Data
public class ConsentRequestViewDTO {
    private Long id;
    private String patientId;
    private String requesterId;
    private String purpose;
    private ConsentStatus status;
    private Instant createdAt;
    private Instant updatedAt;
}