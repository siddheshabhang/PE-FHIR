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

    private String abhaId;
    private String patientId;
    private String patientName;
    private String consultDate;
    private String doctor;

    @Column(columnDefinition = "TEXT")
    private String clinicalNotes;

    private String bloodPressure;
    private String temperature;

    @Column(columnDefinition = "TEXT")
    private String prescriptionPdfBase64;

    private boolean consentVerified;

    // ── Provenance / interoperability fields ─────────────────────────────────
    /** The originating hospital code (e.g. "HOSP-A", "HOSP-B"). Null = native record. */
    private String sourceHospital;

    /** The record ID in the source hospital's local DB, if transferred via FHIR. */
    private String sourceRecordId;

    /** True when this row was received from another hospital via a FHIR Bundle exchange. */
    @Column(nullable = false)
    private boolean receivedViaFhir = false;

    @Column(nullable = false, updatable = false)
    private Instant receivedAt;

    @PrePersist
    public void prePersist() { this.receivedAt = Instant.now(); }
}
