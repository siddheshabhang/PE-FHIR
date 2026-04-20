package com.fhir.shared.config;

import com.fhir.auth.dto.RegisterRequest;
import com.fhir.auth.model.UserRole;
import com.fhir.auth.repository.AuthUserRepository;
import com.fhir.auth.service.AuthService;
import com.fhir.hospitalA.model.HospitalAOPConsultEntity;
import com.fhir.hospitalA.repository.HospitalAOPConsultRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DatabaseSeeder implements CommandLineRunner {

    @Autowired
    private AuthUserRepository userRepository;

    @Autowired
    private AuthService authService;

    @Autowired
    private HospitalAOPConsultRepository consultRepository;

    @Override
    public void run(String... args) throws Exception {
        // Seed only if no users exist
        if (userRepository.count() == 0) {
            // Create Admin
            RegisterRequest admin = new RegisterRequest();
            admin.setUsername("admin1");
            admin.setPassword("adminone");
            admin.setRole(UserRole.ADMIN);
            authService.register(admin);

            // Create Doctor
            RegisterRequest doctor = new RegisterRequest();
            doctor.setUsername("doctor1");
            doctor.setPassword("doctorone");
            doctor.setRole(UserRole.DOCTOR);
            authService.register(doctor);

            // Create Patient P-1001
            RegisterRequest patient = new RegisterRequest();
            patient.setUsername("patient1");
            patient.setPassword("patientone");
            patient.setRole(UserRole.PATIENT);
            patient.setPatientId("P-1001");
            authService.register(patient);

            // Create an initial consult record for the patient so push flow doesn't 404
            HospitalAOPConsultEntity consult = new HospitalAOPConsultEntity();
            consult.setPatientId("P-1001");
            consult.setPatientFirstName("Siddhesh");
            consult.setPatientLastName("Abhang");
            consult.setDoctorName("Dr. Deshmukh");
            consult.setVisitDate("2026-04-20");
            consult.setSymptoms("Fever, Cough");
            consult.setTemperature(38.5);
            consult.setBloodPressure("120/80");
            consult.setPrescriptionPdfBase64(""); // keep empty
            consultRepository.save(consult);

            System.out.println(
                    "✅ [DatabaseSeeder] Successfully seeded mock Admin, Doctor, Patient, and OP Consult data.");
        } else {
            System.out.println("✅ [DatabaseSeeder] Database already populated. Skipping seeding.");
        }
    }
}
