package com.demo.fhir.hapi_fhir_demo.hospitalA.model;

public class HospitalAPatient {
    private String patientId;   // Local hospital ID
    private String name;        // Full name
    private String dob;         // dd/MM/yyyy (NON-FHIR)
    private String gender;      // M / F

    public HospitalAPatient() {
    }

    public HospitalAPatient(String patientId, String name, String dob, String gender) {
        this.patientId = patientId;
        this.name = name;
        this.dob = dob;
        this.gender = gender;
    }

    public String getPatientId() {
        return patientId;
    }

    public void setPatientId(String patientId) {
        this.patientId = patientId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDob() {
        return dob;
    }

    public void setDob(String dob) {
        this.dob = dob;
    }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }
}
