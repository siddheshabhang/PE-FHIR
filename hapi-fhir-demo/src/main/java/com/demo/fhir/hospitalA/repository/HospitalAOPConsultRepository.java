package com.demo.fhir.hospitalA.repository;

import com.demo.fhir.hospitalA.model.HospitalAOPConsultEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface HospitalAOPConsultRepository extends JpaRepository<HospitalAOPConsultEntity, Long> {
}
