import api from './api';

// ─── Mock Data ───────────────────────────────────────────────────────────────
const MOCK_ENABLED = false;

export const doctorService = {
  /**
   * POST /hospitalA/op-consult
   * Body: HospitalAOPConsultRecordDTO
   * Fields: patientId, patientFirstName, patientLastName, doctorName,
   *         visitDate, symptoms, temperature (double), bloodPressure,
   *         prescriptionPdfBase64
   * Returns plain string success message.
   */
  submitPatientData: async (formData) => {
    try {
      // Only send fields that exist in HospitalAOPConsultRecordDTO
      const payload = {
        patientId:            formData.patientId,
        patientFirstName:     formData.patientFirstName,
        patientLastName:      formData.patientLastName,
        doctorName:           formData.doctorName,
        visitDate:            formData.visitDate,
        symptoms:             formData.symptoms,
        temperature:          formData.temperature,
        bloodPressure:        formData.bloodPressure,
        prescriptionPdfBase64: formData.prescriptionPdfBase64 || '',
      };
      const res = await api.post('/hospitalA/op-consult', payload);
      return res.data;
    } catch (err) {
      if (MOCK_ENABLED) {
        return 'OP Consult record stored and converted to FHIR successfully (mock)';
      }
      throw err;
    }
  },

  /**
   * POST /hospitalA/patient/to-fhir
   * Body: HospitalAPatient (raw patient object)
   * Returns FHIR JSON string.
   */
  convertPatientToFhir: async (patientData) => {
    try {
      const res = await api.post('/hospitalA/patient/to-fhir', patientData);
      return res.data;
    } catch (err) {
      if (MOCK_ENABLED) {
        return `{"resourceType":"Patient","id":"${patientData.patientId}"}`;
      }
      throw err;
    }
  },

  /**
   * POST /hospitalB/op-consult
   * Body: raw FHIR JSON string (Content-Type: text/plain)
   * Returns: HospitalBOPConsultRecordDTO {
   *   uhid, patientName, consultDate, doctor, clinicalNotes,
   *   vitals: { bp, temp }, prescriptionPdfBase64, consentVerified
   * }
   */
  receiveFhirAtHospitalB: async (fhirJson) => {
    try {
      const res = await api.post('/hospitalB/op-consult', fhirJson, {
        headers: { 'Content-Type': 'text/plain' },
      });
      return res.data;
    } catch (err) {
      if (MOCK_ENABLED) {
        return {
          uhid: 'UHID-001',
          patientName: 'Alice Johnson',
          consultDate: '2026-04-08',
          doctor: 'Dr. Chen',
          clinicalNotes: 'Viral fever — supportive care',
          vitals: { bp: '118/76', temp: '38.4' },
          prescriptionPdfBase64: '',
          consentVerified: true,
        };
      }
      throw err;
    }
  },

  /**
   * POST /consent/initiate
   * Body: InitiateConsentDTO { patientId, purpose, requestedDataTypes }
   * Returns: ConsentRequestViewDTO
   * Requester ID is automatically taken from the logged-in doctor's JWT.
   */
  initiateConsent: async (patientId, purpose, requestedDataTypes) => {
    try {
      const res = await api.post('/consent/initiate', {
        patientId,
        purpose,
        requestedDataTypes,
      });
      return res.data;
    } catch (err) {
      if (MOCK_ENABLED) {
        return { id: Date.now(), patientId, purpose, status: 'PENDING', requestedDataTypes };
      }
      throw err;
    }
  },

  /**
   * POST /doctor/patients
   * Doctor registers a new patient
   */
  createPatient: async (patientData) => {
    try {
      const res = await api.post('/doctor/patients', patientData);
      return res.data;
    } catch (err) {
      if (MOCK_ENABLED) {
        return {
          message: 'Patient created successfully',
          patientId: 'P-' + Math.floor(Math.random() * 9000 + 1000),
          username: patientData.firstName.toLowerCase() + '.' + patientData.lastName.toLowerCase(),
          tempPassword: 'password123',
          hospitalId: 'HOSP-A',
        };
      }
      throw err;
    }
  },

  /**
   * GET /hospitalB/op-consult
   * Returns list of HospitalBOPConsultEntity
   */
  getHospitalBConsults: async () => {
    try {
      const res = await api.get('/hospitalB/op-consult');
      return res.data;
    } catch {
      if (MOCK_ENABLED) return [];
      throw new Error('Failed to fetch Hospital B intake records');
    }
  },
};
