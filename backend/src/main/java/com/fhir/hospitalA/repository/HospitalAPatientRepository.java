package com.fhir.hospitalA.repository;

import com.fhir.hospitalA.model.HospitalAPatient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface HospitalAPatientRepository extends JpaRepository<HospitalAPatient, String> {
}
