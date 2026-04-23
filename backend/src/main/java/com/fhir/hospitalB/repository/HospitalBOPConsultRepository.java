package com.fhir.hospitalB.repository;

import com.fhir.hospitalB.model.HospitalBOPConsultEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface HospitalBOPConsultRepository
        extends JpaRepository<HospitalBOPConsultEntity, Long> {
    List<HospitalBOPConsultEntity> findByAbhaIdOrderByReceivedAtDesc(String abhaId);
    java.util.Optional<HospitalBOPConsultEntity> findFirstByAbhaIdOrderByIdDesc(String abhaId);
}
