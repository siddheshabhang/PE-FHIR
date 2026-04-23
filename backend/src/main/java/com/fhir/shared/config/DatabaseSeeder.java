package com.fhir.shared.config;

import com.fhir.auth.dto.RegisterRequest;
import com.fhir.auth.model.UserRole;
import com.fhir.auth.repository.AuthUserRepository;
import com.fhir.auth.service.AuthService;
import com.fhir.hospitalA.model.HospitalAOPConsultEntity;
import com.fhir.hospitalA.repository.HospitalAOPConsultRepository;
<<<<<<< HEAD
import com.fhir.identity.model.GlobalPatientIdentity;
import com.fhir.identity.repository.GlobalPatientIdentityRepository;
=======
import com.fhir.shared.hospital.Hospital;
import com.fhir.shared.hospital.HospitalRepository;
>>>>>>> 9236203 (Add HIE federated exchange and multi-hospital persistence support)
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class DatabaseSeeder implements CommandLineRunner {

    @Autowired
    private AuthUserRepository userRepository;

    @Autowired
    private AuthService authService;

    @Autowired
    private HospitalAOPConsultRepository consultRepository;

    @Autowired
<<<<<<< HEAD
    private GlobalPatientIdentityRepository globalPatientIdentityRepository;
=======
    private HospitalRepository hospitalRepository;
>>>>>>> 9236203 (Add HIE federated exchange and multi-hospital persistence support)

    @Override
    public void run(String... args) throws Exception {
        // Seed only if no users exist
        if (userRepository.count() == 0) {
            // Seed Hospitals
            Hospital hospA = new Hospital();
            hospA.setId("HOSP-A");
            hospA.setName("City General Hospital");
            hospA.setCode("CGH-01");
            hospA.setLocation("New York");
            hospA.setContactEmail("admin@citygeneral.com");
            hospitalRepository.save(hospA);

            Hospital hospB = new Hospital();
            hospB.setId("HOSP-B");
            hospB.setName("Metro Medical Center");
            hospB.setCode("MMC-02");
            hospB.setLocation("Chicago");
            hospB.setContactEmail("admin@metromedical.com");
            hospitalRepository.save(hospB);

            // Create Admin
            RegisterRequest admin = new RegisterRequest();
            admin.setUsername("admin1");
            admin.setPassword("adminone");
            admin.setRole(UserRole.ADMIN);
            admin.setFullName("Super Admin");
            authService.register(admin);

            // Create Doctor 1 (HOSP-A)
            RegisterRequest doctor = new RegisterRequest();
            doctor.setUsername("doctor1");
            doctor.setPassword("doctorone");
            doctor.setRole(UserRole.DOCTOR);
            doctor.setHospitalId("HOSP-A");
            doctor.setFullName("Dr. Deshmukh");
            doctor.setSpecialization("General Physician");
            authService.register(doctor);

            // Create Doctor 2 (HOSP-B)
            RegisterRequest doctor2 = new RegisterRequest();
            doctor2.setUsername("doctor2");
            doctor2.setPassword("doctortwo");
            doctor2.setRole(UserRole.DOCTOR);
            doctor2.setHospitalId("HOSP-B");
            doctor2.setFullName("Dr. Chen");
            doctor2.setSpecialization("Cardiologist");
            authService.register(doctor2);

            // Create Patient P-1001 (HOSP-A)
            RegisterRequest patient = new RegisterRequest();
            patient.setUsername("patient1");
            patient.setPassword("patientone");
            patient.setRole(UserRole.PATIENT);
            patient.setPatientId("P-1001");
            patient.setHospitalId("HOSP-A");
            patient.setFullName("Siddhesh Abhang");
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

            // Register P-1001 in global identity service
            GlobalPatientIdentity gpi = new GlobalPatientIdentity();
            gpi.setGlobalId(UUID.randomUUID().toString());
            gpi.setHospitalAId("P-1001");
            gpi.setName("Siddhesh Abhang");
            globalPatientIdentityRepository.save(gpi);
            System.out.println("✅ [DatabaseSeeder] Registered P-1001 in global identity registry.");

            System.out.println(
                    "✅ [DatabaseSeeder] Successfully seeded mock Admin, Hospitals, Doctors, Patient, and OP Consult data.");
        } else {
            System.out.println("✅ [DatabaseSeeder] Database already populated. Skipping seeding.");
        }
    }
}
