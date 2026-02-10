package com.demo.fhir.hapi_fhir_demo.hospitalA.mapper;

import com.demo.fhir.hapi_fhir_demo.hospitalA.model.HospitalAPatient;
import org.hl7.fhir.r4.model.HumanName;
import org.hl7.fhir.r4.model.Patient;
import org.hl7.fhir.r4.model.Enumerations.AdministrativeGender;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

public class HospitalAToFHIRMapper {
    private static final DateTimeFormatter INPUT_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public static Patient mapToFHIRPatient(HospitalAPatient source) {
        Patient patient = new Patient();
        //Id
        patient.setId(source.getPatientId());

        //Name
        HumanName name = new HumanName();
        name.setText(source.getName());
        patient.addName(name);

        //Gender
        if ("M".equalsIgnoreCase(source.getGender())) {
            patient.setGender(AdministrativeGender.MALE);
        } else if ("F".equalsIgnoreCase(source.getGender())) {
            patient.setGender(AdministrativeGender.FEMALE);
        }

        //negative test
//        patient.getGenderElement().setValueAsString("INVALID_GENDER");

//        //Date of Birth
        LocalDate dob = LocalDate.parse(source.getDob(), INPUT_FORMAT);
        patient.setBirthDate(java.sql.Date.valueOf(dob));

//        patient.getBirthDateElement().setValueAsString("19/08/2003");

        return patient;
    }
}
