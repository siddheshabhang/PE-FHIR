package com.fhir.identity.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;

@Entity
@Table(name = "global_patient_identity")
@Data
@NoArgsConstructor
public class GlobalPatientIdentity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String globalId;

    @Column
    private String hospitalAId;

    @Column
    private String hospitalBId;

    @Column
    private String name;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    public void prePersist() { this.createdAt = Instant.now(); }
}
