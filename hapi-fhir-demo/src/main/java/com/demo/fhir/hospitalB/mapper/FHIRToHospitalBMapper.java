package com.demo.fhir.hospitalB.mapper;

import com.demo.fhir.hospitalB.model.HospitalBPatient;
import org.hl7.fhir.r4.model.Patient;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

public class FHIRToHospitalBMapper {

    private static final DateTimeFormatter OUTPUT_FORMAT =
            DateTimeFormatter.ofPattern("d'th' MMM yyyy");

    public static HospitalBPatient mapToHospitalB(Patient patient) {

        HospitalBPatient hb = new HospitalBPatient();

        // UHID (new hospital generates its own)
        hb.setUhid("B998");

        // Name
        if (!patient.getName().isEmpty()) {
            hb.setFullName(patient.getName().get(0).getText());
        }

        // Gender
        if (patient.getGender() != null) {
            hb.setGender(
                    patient.getGender().toCode().substring(0, 1).toUpperCase()
                            + patient.getGender().toCode().substring(1)
            );
        }

        // DOB → "19th Aug 2003"
        if (patient.getBirthDate() != null) {
            String dob = patient.getBirthDate()
                    .toInstant()
                    .atZone(ZoneId.systemDefault())
                    .toLocalDate()
                    .format(OUTPUT_FORMAT);

            hb.setDateOfBirth(dob);
        }

        return hb;
    }
}
