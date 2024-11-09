import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { usePatientStore } from '../../stores/usePatientStore';
import { useConsultationStore } from '../../stores/useConsultationStore';
import { useAppointmentStore } from '../../stores/useAppointmentStore';
import { exportToPDF } from '../../utils/pdfExport';
import { Download, Printer, FileText, Calendar, Filter, Search } from 'lucide-react';
import type { Patient } from '../../types/patient';
import type { Consultation } from '../../types/consultation';
import type { Appointment } from '../../types/appointment';
import { formatDate } from '../../utils/dateFormat';

interface DateFilter {
  startDate: string;
  endDate: string;
}

const UserReports: React.FC = () => {
  const { patients } = usePatientStore();
  const { consultations } = useConsultationStore();
  const { appointments } = useAppointmentStore();
  const [activeTab, setActiveTab] = useState('all');
  const [specialty, setSpecialty] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateFilter>({
    startDate: '',
    endDate: ''
  });
  const [isExporting, setIsExporting] = useState(false);

  const getFilteredPatients = () => {
    return patients.filter((patient: Patient) => {
      const matchesSpecialty = specialty === 'all' || patient.department === specialty;
      const matchesSearch = searchQuery === '' || 
        patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.mrn.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDate = !dateRange.startDate || !dateRange.endDate || (
        patient.admission_date && 
        new Date(patient.admission_date) >= new Date(dateRange.startDate) &&
        new Date(patient.admission_date) <= new Date(dateRange.endDate)
      );
      return matchesSpecialty && matchesSearch && matchesDate;
    });
  };

  const getFilteredConsultations = () => {
    return consultations.filter((consultation: Consultation) => {
      const matchesSpecialty = specialty === 'all' || consultation.consultation_specialty === specialty;
      const matchesSearch = searchQuery === '' || 
        consultation.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        consultation.mrn.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDate = !dateRange.startDate || !dateRange.endDate || (
        new Date(consultation.created_at) >= new Date(dateRange.startDate) &&
        new Date(consultation.created_at) <= new Date(dateRange.endDate)
      );
      return matchesSpecialty && matchesSearch && matchesDate;
    });
  };

  const getFilteredAppointments = () => {
    return appointments.filter((appointment: Appointment) => {
      const matchesSpecialty = specialty === 'all' || appointment.specialty === specialty;
      const matchesSearch = searchQuery === '' || 
        appointment.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        appointment.medicalNumber.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDate = !dateRange.startDate || !dateRange.endDate || (
        new Date(appointment.createdAt) >= new Date(dateRange.startDate) &&
        new Date(appointment.createdAt) <= new Date(dateRange.endDate)
      );
      return matchesSpecialty && matchesSearch && matchesDate;
    });
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportToPDF({
        patients: getFilteredPatients(),
        consultations: getFilteredConsultations(),
        appointments: getFilteredAppointments(),
        activeTab,
        dateFilter: {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          period: 'custom'
        }
      });
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export report. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6">
          {/* Header with export buttons */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 space-y-4 md:space-y-0">
            <div className="flex items-center space-x-3">
              <FileText className="h-6 w-6 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900">Reports</h2>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={handlePrint}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Printer className="h-4 w-4" />
                <span>Print</span>
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                <span>{isExporting ? 'Exporting...' : 'Export PDF'}</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Report Type
              </label>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <select
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                >
                  <option value="all">All Reports</option>
                  <option value="admissions">Active Admissions</option>
                  <option value="consultations">Medical Consultations</option>
                  <option value="appointments">Clinic Appointments</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Specialty
              </label>
              <select
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              >
                <option value="all">All Specialties</option>
                <option value="Internal Medicine">Internal Medicine</option>
                <option value="Pulmonology">Pulmonology</option>
                <option value="Neurology">Neurology</option>
                <option value="Gastroenterology">Gastroenterology</option>
                <option value="Rheumatology">Rheumatology</option>
                <option value="Endocrinology">Endocrinology</option>
                <option value="Hematology">Hematology</option>
                <option value="Infectious Disease">Infectious Disease</option>
                <option value="Thrombosis Medicine">Thrombosis Medicine</option>
                <option value="Immunology & Allergy">Immunology & Allergy</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full pl-9 pr-2 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  />
                </div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full pl-9 pr-2 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or MRN..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Report Content */}
          <div className="space-y-8">
            {(activeTab === 'all' || activeTab === 'admissions') && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Active Admissions ({getFilteredPatients().length})
                </h3>
                <div className="space-y-4">
                  {getFilteredPatients().map((patient) => (
                    <div
                      key={patient.id}
                      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-base font-medium text-gray-900">{patient.name}</h4>
                          <p className="text-sm text-gray-600">MRN: {patient.mrn}</p>
                          <div className="mt-2 space-y-1">
                            <p className="text-sm text-gray-600">
                              Department: {patient.department}
                            </p>
                            <p className="text-sm text-gray-600">
                              Admission Date: {formatDate(patient.admission_date || '')}
                            </p>
                            <p className="text-sm text-gray-600">
                              Doctor: {patient.doctor_name || 'Not assigned'}
                            </p>
                          </div>
                        </div>
                        {patient.admissions?.[0]?.safety_type && (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            patient.admissions[0].safety_type === 'emergency'
                              ? 'bg-red-100 text-red-800'
                              : patient.admissions[0].safety_type === 'observation'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {patient.admissions[0].safety_type}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(activeTab === 'all' || activeTab === 'consultations') && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Medical Consultations ({getFilteredConsultations().length})
                </h3>
                <div className="space-y-4">
                  {getFilteredConsultations().map((consultation) => (
                    <div
                      key={consultation.id}
                      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-base font-medium text-gray-900">{consultation.patient_name}</h4>
                          <p className="text-sm text-gray-600">MRN: {consultation.mrn}</p>
                          <div className="mt-2 space-y-1">
                            <p className="text-sm text-gray-600">
                              Specialty: {consultation.consultation_specialty}
                            </p>
                            <p className="text-sm text-gray-600">
                              Created: {formatDate(consultation.created_at)}
                            </p>
                            <p className="text-sm text-gray-600">
                              Doctor: {consultation.doctor_name || 'Pending Assignment'}
                            </p>
                          </div>
                        </div>
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
                  ))}
                </div>
              </div>
            )}

            {(activeTab === 'all' || activeTab === 'appointments') && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Clinic Appointments ({getFilteredAppointments().length})
                </h3>
                <div className="space-y-4">
                  {getFilteredAppointments().map((appointment) => (
                    <div
                      key={appointment.id}
                      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-base font-medium text-gray-900">{appointment.patientName}</h4>
                          <p className="text-sm text-gray-600">MRN: {appointment.medicalNumber}</p>
                          <div className="mt-2 space-y-1">
                            <p className="text-sm text-gray-600">
                              Specialty: {appointment.specialty}
                            </p>
                            <p className="text-sm text-gray-600">
                              Date: {formatDate(appointment.createdAt)}
                            </p>
                            {appointment.notes && (
                              <p className="text-sm text-gray-600">
                                Notes: {appointment.notes}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            appointment.appointmentType === 'urgent'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {appointment.appointmentType}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            appointment.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : appointment.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {appointment.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {getFilteredPatients().length === 0 && 
             getFilteredConsultations().length === 0 && 
             getFilteredAppointments().length === 0 && (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
                <p className="text-gray-500">
                  Try adjusting your filters or search criteria
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserReports;