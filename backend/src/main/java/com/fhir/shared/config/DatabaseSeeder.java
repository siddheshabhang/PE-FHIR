package com.fhir.shared.config;

import com.fhir.auth.dto.RegisterRequest;
import com.fhir.auth.model.UserRole;
import com.fhir.auth.repository.AuthUserRepository;
import com.fhir.auth.service.AuthService;
import com.fhir.hospitalA.model.HospitalAOPConsultEntity;
import com.fhir.hospitalA.repository.HospitalAOPConsultRepository;
import com.fhir.identity.model.GlobalPatientIdentity;
import com.fhir.identity.repository.GlobalPatientIdentityRepository;
import com.fhir.shared.hospital.Hospital;
import com.fhir.shared.hospital.HospitalRepository;
import com.fhir.hospitalB.model.HospitalBOPConsultEntity;
import com.fhir.hospitalB.repository.HospitalBOPConsultRepository;
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
    private HospitalBOPConsultRepository hospitalBConsultRepository;

    @Autowired
    private GlobalPatientIdentityRepository globalPatientIdentityRepository;

    @Autowired
    private HospitalRepository hospitalRepository;

    @Override
    public void run(String... args) throws Exception {
        // Seed only if no users exist
        if (userRepository.count() == 0) {
            // Seed Hospitals
            Hospital hospA = new Hospital();
            hospA.setId("HOSP-A");
            hospA.setName("Apollo Hospitals");
            hospA.setCode("APL-MUM");
            hospA.setLocation("Mumbai, Maharashtra");
            hospA.setContactEmail("admin@apollo.in");
            hospitalRepository.save(hospA);

            Hospital hospB = new Hospital();
            hospB.setId("HOSP-B");
            hospB.setName("Fortis Healthcare");
            hospB.setCode("FHL-DEL");
            hospB.setLocation("New Delhi, Delhi");
            hospB.setContactEmail("admin@fortis.in");
            hospitalRepository.save(hospB);

            // Create Admin
            RegisterRequest admin = new RegisterRequest();
            admin.setUsername("admin1");
            admin.setPassword("adminpassword");
            admin.setRole(UserRole.ADMIN);
            admin.setFullName("System Administrator");
            authService.register(admin);

            // Create Doctor 1 (HOSP-A)
            RegisterRequest doctor = new RegisterRequest();
            doctor.setUsername("dr_sharma");
            doctor.setPassword("doctorpassword");
            doctor.setRole(UserRole.DOCTOR);
            doctor.setHospitalId("HOSP-A");
            doctor.setFullName("Dr. Rahul Sharma");
            doctor.setSpecialization("Cardiology");
            authService.register(doctor);

            // Create Doctor 2 (HOSP-B)
            RegisterRequest doctor2 = new RegisterRequest();
            doctor2.setUsername("dr_gupta");
            doctor2.setPassword("doctorpassword");
            doctor2.setRole(UserRole.DOCTOR);
            doctor2.setHospitalId("HOSP-B");
            doctor2.setFullName("Dr. Sneha Gupta");
            doctor2.setSpecialization("Neurology");
            authService.register(doctor2);

            // Create Patient HA-P-1001 (HOSP-A local ID)
            RegisterRequest patient = new RegisterRequest();
            patient.setUsername("rahul_verma");
            patient.setPassword("patientpassword");
            patient.setRole(UserRole.PATIENT);
            patient.setAbhaId("ABHA-2233-4455-6677-88");
            patient.setHospitalId("HOSP-A");
            patient.setFullName("Rahul Verma");
            authService.register(patient);

            // Create an initial consult record for the patient so push flow doesn't 404
            HospitalAOPConsultEntity consult = new HospitalAOPConsultEntity();
            consult.setPatientId("HA-P-1001");
            consult.setAbhaId("ABHA-2233-4455-6677-88");
            consult.setPatientFirstName("Rahul");
            consult.setPatientLastName("Verma");
            consult.setDoctorName("Dr. Rahul Sharma");
            consult.setVisitDate("2026-04-25");
            consult.setSymptoms("Chest pain, slight shortness of breath");
            consult.setTemperature(37.2);
            consult.setBloodPressure("145/90");
            consult.setPrescriptionPdfBase64(""); // keep empty
            
            // New Interoperability / Provenance fields
            consult.setReceivedViaFhir(false);
            consult.setSourceHospital("HOSP-A");
            consult.setSourceRecordId(null);
            
            consultRepository.save(consult);

            // Create an initial consult record for Hospital B natively (diff format)
            HospitalBOPConsultEntity consultB = new HospitalBOPConsultEntity();
            consultB.setPatientId("HB-P-8002");
            consultB.setAbhaId("ABHA-2233-4455-6677-88");
            consultB.setPatientName("Rahul Verma");
            consultB.setConsultDate("2026-03-15"); // Different date format/convention natively
            consultB.setDoctor("Dr. Sneha Gupta");
            consultB.setClinicalNotes("Patient complained of chronic headaches. Prescribed rest and hydration.");
            consultB.setTemperature("98.6"); // Stored as String in Hosp B
            consultB.setBloodPressure("120/80");
            consultB.setConsentVerified(true);
            consultB.setPrescriptionPdfBase64("");
            
            // New Interoperability / Provenance fields
            consultB.setReceivedViaFhir(false);
            consultB.setSourceHospital("HOSP-B");
            consultB.setSourceRecordId(null);
            
            hospitalBConsultRepository.save(consultB);

            // Register the Hospital A local ID in global identity service
            GlobalPatientIdentity gpi = new GlobalPatientIdentity();
            gpi.setGlobalId(UUID.randomUUID().toString());
            gpi.setHospitalAId("HA-P-1001");
            gpi.setName("Rahul Verma");
            globalPatientIdentityRepository.save(gpi);
            System.out.println("✅ [DatabaseSeeder] Registered HA-P-1001 in global identity registry.");

            // Register the Hospital B local ID as well
            GlobalPatientIdentity gpiB = new GlobalPatientIdentity();
            gpiB.setGlobalId(UUID.randomUUID().toString());
            gpiB.setHospitalBId("HB-P-8002");
            gpiB.setName("Rahul Verma");
            globalPatientIdentityRepository.save(gpiB);
            System.out.println("✅ [DatabaseSeeder] Registered HB-P-8002 in global identity registry.");

            System.out.println(
                    "✅ [DatabaseSeeder] Successfully seeded mock Admin, Hospitals, Doctors, Patient, and OP Consult data for both formats.");
        } else {
            System.out.println("✅ [DatabaseSeeder] Database already populated. Skipping seeding.");
        }
    }
}
