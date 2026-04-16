package com.demo.fhir.hospitalA.repository;

import com.demo.fhir.hospitalA.model.HospitalAPatient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface HospitalAPatientRepository extends JpaRepository<HospitalAPatient, String> {
}
