package com.fhir.hospitalB.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;

@Entity
@Table(name = "hospital_b_op_consults")
@Data
@NoArgsConstructor
public class HospitalBOPConsultEntity {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String uhid;
    private String patientName;
    private String consultDate;
    private String doctor;

    @Column(columnDefinition = "TEXT")
    private String clinicalNotes;

    private String bloodPressure;
    private String temperature;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String prescriptionPdfBase64;

    private boolean consentVerified;

    @Column(nullable = false, updatable = false)
    private Instant receivedAt;

    @PrePersist
    public void prePersist() { this.receivedAt = Instant.now(); }
}
