package com.demo.fhir.shared.audit;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "transfer_audit_log")
@Data
@NoArgsConstructor
public class TransferAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String patientId;

    @Column(nullable = false)
    private String sourceHospital;

    @Column(nullable = false)
    private String targetHospital;

    private int bundleResourceCount;

    /** JSON snapshot of consent flags at transfer time. */
    @Column(columnDefinition = "TEXT")
    private String consentSnapshot;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TransferStatus status;

    @Column(nullable = false, updatable = false)
    private Instant timestamp;

    /** Populated only when status = FAILED. */
    @Column
    private String failureReason;

    @PrePersist
    public void prePersist() {
        this.timestamp = Instant.now();
    }
}
