package com.demo.fhir.consent.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "consent_preferences")
@Data
@NoArgsConstructor
public class ConsentPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String patientId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ConsentStatus consentStatus;

    // ── Six granular sharing flags ────────────────────────────────────────────
    private boolean shareWithHospitalB;
    private boolean shareDiagnostics;
    private boolean shareMedications;
    private boolean shareLabResults;
    private boolean shareSurgicalHistory;
    private boolean shareAllergies;

    /** Null means no expiry. */
    private Instant expiresAt;

    @Column(updatable = false)
    private Instant grantedAt;

    private Instant lastModifiedAt;

    @PrePersist
    public void prePersist() {
        Instant now = Instant.now();
        if (consentStatus == ConsentStatus.GRANTED) {
            this.grantedAt = now;
        }
        this.lastModifiedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.lastModifiedAt = Instant.now();
    }
}
