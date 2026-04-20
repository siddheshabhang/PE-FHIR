package com.fhir.hospitalA.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "hospital_a_op_consults")
@Data
@NoArgsConstructor
public class HospitalAOPConsultEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String patientId;

    private String patientFirstName;
    private String patientLastName;
    
    @Column(nullable = false)
    private String doctorName;
    
    private String visitDate;
    
    @Column(columnDefinition = "TEXT")
    private String symptoms;
    
    private double temperature;
    private String bloodPressure;
    
    @Lob
    @Column(columnDefinition = "TEXT")
    private String prescriptionPdfBase64;
    
    @Column(updatable = false)
    private Instant createdAt;
    
    @PrePersist
    public void prePersist() {
        this.createdAt = Instant.now();
    }
}
