package com.demo.fhir.consent.repository;

import com.demo.fhir.consent.model.ConsentPreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ConsentPreferenceRepository extends JpaRepository<ConsentPreference, Long> {
    Optional<ConsentPreference> findByPatientId(String patientId);
}
