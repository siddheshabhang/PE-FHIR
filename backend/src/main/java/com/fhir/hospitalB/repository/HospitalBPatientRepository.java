package com.fhir.hospitalB.repository;

import com.fhir.hospitalB.model.HospitalBPatient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface HospitalBPatientRepository extends JpaRepository<HospitalBPatient, Long> {
    Optional<HospitalBPatient> findByAbhaId(String abhaId);
}
