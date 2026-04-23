package com.fhir.hospitalB.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "hospital_b_patients")
@Data
@NoArgsConstructor
public class HospitalBPatient {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String abhaId;      // Universal ID (e.g. ABHA-1234)

    private String patientId;   // Local Hospital B ID
    private String fullName;
    private String dateOfBirth;
    private String gender;
}