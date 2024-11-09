import React from 'react';
import { Users, Stethoscope, Shield, Calendar as CalendarIcon, Clock as ClockIcon } from 'lucide-react';
import { usePatientStore } from '../stores/usePatientStore';
import { useConsultationStore } from '../stores/useConsultationStore';
import SafetyBadge from '../components/PatientProfile/SafetyBadge';
import { formatDate } from '../utils/dateFormat';
import type { Patient } from '../types/patient';
import type { Consultation } from '../types/consultation';
import type { Admission } from '../types/admission';

interface SpecialtiesProps {
  onNavigateToPatient: () => void;
  selectedSpecialty?: string;
}

const Specialties: React.FC<SpecialtiesProps> = ({ onNavigateToPatient, selectedSpecialty }) => {
  const { patients, loading: loadingPatients, error: patientError, fetchPatients, setSelectedPatient } = usePatientStore();
  const { consultations, loading: loadingConsultations, error: consultationError } = useConsultationStore();

  const filteredPatients = patients.filter(patient => 
    patient.admissions?.some(admission => 
      (!selectedSpecialty || admission.department === selectedSpecialty) && 
      admission.status === 'active'
    )
  );

  const filteredConsultations = consultations.filter(consultation => 
    (!selectedSpecialty || consultation.consultation_specialty === selectedSpecialty) && 
    consultation.status === 'active'
  );

  const handleViewDetails = (patient: Patient) => {
    setSelectedPatient(patient);
    onNavigateToPatient();
  };

  const handleConsultationClick = (consultation: Consultation) => {
    const admissionDate = new Date(consultation.created_at);
    const dayOfWeek = admissionDate.getDay();
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Friday or Saturday

    const admission: Admission = {
      id: consultation.id,
      patient_id: consultation.patient_id,
      admitting_doctor_id: consultation.doctor_id || 0,
      status: 'active',
      department: consultation.consultation_specialty,
      admission_date: consultation.created_at,
      discharge_date: null,
      diagnosis: consultation.reason,
      visit_number: 1,
      shift_type: isWeekend ? 'weekend_morning' : 'morning',
      is_weekend: isWeekend,
      doctor_name: consultation.doctor_name || 'Pending Assignment'
    };

    const consultationPatient: Patient = {
      id: consultation.id,
      mrn: consultation.mrn,
      name: consultation.patient_name,
      gender: consultation.gender,
      date_of_birth: new Date(new Date().getFullYear() - consultation.age, 0, 1).toISOString(),
      department: consultation.consultation_specialty,
      doctor_name: consultation.doctor_name,
      diagnosis: consultation.reason,
      admission_date: consultation.created_at,
      admissions: [admission]
    };

    setSelectedPatient(consultationPatient);
    onNavigateToPatient();
  };

  const getShiftLabel = (admission: Admission) => {
    const shiftLabels = {
      morning: 'Morning',
      evening: 'Evening',
      night: 'Night',
      weekend_morning: 'Weekend Day (7:00 - 19:00)',
      weekend_night: 'Weekend Night (19:00 - 7:00)'
    };
    return shiftLabels[admission.shift_type];
  };

  if (loadingPatients || loadingConsultations) {
    return (
      <div className="flex-1 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (patientError || consultationError) {
    return (
      <div className="flex-1 p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          Error loading data: {patientError || consultationError}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {selectedSpecialty || 'All Specialties'}
        </h1>
        <p className="text-gray-600">View patients and consultations</p>
      </div>

      <div className="space-y-6">
        {filteredPatients.map((patient) => {
          const activeAdmission = patient.admissions?.find(a => a.status === 'active') as Admission | undefined;
          if (!activeAdmission) return null;

          return (
            <div
              key={`patient-${patient.id}-${activeAdmission.visit_number}`}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => handleViewDetails(patient)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <Users className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{patient.name}</h3>
                    <p className="text-sm text-gray-600">MRN: {patient.mrn}</p>
                    <div className="flex items-center space-x-4 mt-2">
                      <div className="flex items-center text-sm text-gray-500">
                        <CalendarIcon className="h-4 w-4 mr-1" />
                        {formatDate(activeAdmission.admission_date)}
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <ClockIcon className="h-4 w-4 mr-1" />
                        {getShiftLabel(activeAdmission)}
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <Stethoscope className="h-4 w-4 mr-1" />
                        {activeAdmission.doctor_name || 'Not assigned'}
                      </div>
                      {activeAdmission.visit_number > 1 && (
                        <div className="flex items-center text-sm text-purple-600">
                          Visit #{activeAdmission.visit_number}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Inpatient
                  </span>
                  {activeAdmission.safety_type && (
                    <SafetyBadge type={activeAdmission.safety_type} />
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredConsultations.map((consultation) => (
          <div
            key={`consultation-${consultation.id}`}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:bg-gray-50 transition-colors cursor-pointer"
            onClick={() => handleConsultationClick(consultation)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Stethoscope className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{consultation.patient_name}</h3>
                  <p className="text-sm text-gray-600">MRN: {consultation.mrn}</p>
                  <div className="flex items-center space-x-4 mt-2">
                    <div className="flex items-center text-sm text-gray-500">
                      <CalendarIcon className="h-4 w-4 mr-1" />
                      {formatDate(consultation.created_at)}
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <Users className="h-4 w-4 mr-1" />
                      {consultation.requesting_department}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end space-y-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Consultation
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  consultation.urgency === 'emergency'
                    ? 'bg-red-100 text-red-800'
                    : consultation.urgency === 'urgent'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-green-100 text-green-800'
                }`}>
                  {consultation.urgency}
                </span>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Reason:</span> {consultation.reason}
              </p>
            </div>
          </div>
        ))}

        {filteredPatients.length === 0 && filteredConsultations.length === 0 && (
          <div className="text-center py-12">
            <div className="p-2 bg-gray-100 rounded-full w-12 h-12 mx-auto mb-4 flex items-center justify-center">
              <Users className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Patients</h3>
            <p className="text-gray-500">
              {selectedSpecialty 
                ? `There are no active patients or consultations in ${selectedSpecialty}`
                : 'There are no active patients or consultations'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Specialties;