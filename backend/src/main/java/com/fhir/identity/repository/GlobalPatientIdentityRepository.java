package com.fhir.identity.repository;

import com.fhir.identity.model.GlobalPatientIdentity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface GlobalPatientIdentityRepository
        extends JpaRepository<GlobalPatientIdentity, Long> {
    Optional<GlobalPatientIdentity> findByHospitalAId(String hospitalAId);
    Optional<GlobalPatientIdentity> findByGlobalId(String globalId);
}
