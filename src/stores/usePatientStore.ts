import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Patient } from '../types/patient';
import type { Admission } from '../types/admission';

interface PatientStore {
  patients: Patient[];
  selectedPatient: Patient | null;
  loading: boolean;
  error: string | null;
  fetchPatients: () => Promise<void>;
  addPatient: (patientData: any) => Promise<void>;
  updatePatient: (id: number, updates: Partial<Patient>) => Promise<void>;
  deletePatient: (id: number) => Promise<void>;
  setSelectedPatient: (patient: Patient | null) => void;
  subscribe: (callback: () => void) => () => void;
}

export const usePatientStore = create<PatientStore>((set, get) => ({
  patients: [],
  selectedPatient: null,
  loading: false,
  error: null,

  subscribe: (callback: () => void) => {
    const subscribers = new Set<() => void>();
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  },

  setSelectedPatient: (patient) => {
    set({ selectedPatient: patient });
  },

  fetchPatients: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('patients')
        .select(`
          *,
          admissions (
            id,
            admission_date,
            discharge_date,
            department,
            diagnosis,
            status,
            visit_number,
            safety_type,
            shift_type,
            is_weekend,
            users (
              name
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const patientsWithDetails = data?.map(patient => ({
        ...patient,
        doctor_name: patient.admissions?.[0]?.users?.name,
        department: patient.admissions?.[0]?.department,
        diagnosis: patient.admissions?.[0]?.diagnosis,
        admission_date: patient.admissions?.[0]?.admission_date,
        admissions: patient.admissions?.sort((a: Admission, b: Admission) => 
          new Date(b.admission_date).getTime() - new Date(a.admission_date).getTime()
        )
      })) || [];

      set({ patients: patientsWithDetails as Patient[], loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  addPatient: async (patientData) => {
    set({ loading: true, error: null });
    try {
      // First, create the patient record
      const { data: patientResult, error: patientError } = await supabase
        .from('patients')
        .insert([{
          mrn: patientData.mrn,
          name: patientData.name,
          date_of_birth: patientData.date_of_birth,
          gender: patientData.gender
        }])
        .select()
        .single();

      if (patientError) throw patientError;

      // Then, create the admission record with the correct shift type
      const { data: admissionResult, error: admissionError } = await supabase
        .from('admissions')
        .insert([{
          patient_id: patientResult.id,
          admission_date: patientData.admission.admission_date,
          department: patientData.admission.department,
          admitting_doctor_id: patientData.admission.admitting_doctor_id,
          diagnosis: patientData.admission.diagnosis,
          status: patientData.admission.status,
          safety_type: patientData.admission.safety_type,
          shift_type: patientData.admission.shift_type,
          visit_number: 1
        }])
        .select(`
          *,
          users (
            name
          )
        `)
        .single();

      if (admissionError) throw admissionError;

      const newPatient: Patient = {
        ...patientResult,
        doctor_name: admissionResult.users?.name,
        department: admissionResult.department,
        diagnosis: admissionResult.diagnosis,
        admission_date: admissionResult.admission_date,
        admissions: [admissionResult]
      };

      set(state => ({
        patients: [newPatient, ...state.patients],
        loading: false
      }));
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  updatePatient: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('patients')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          admissions (
            id,
            admission_date,
            discharge_date,
            department,
            diagnosis,
            status,
            visit_number,
            safety_type,
            shift_type,
            is_weekend,
            users (
              name
            )
          )
        `)
        .single();

      if (error) throw error;

      const updatedPatient = {
        ...data,
        doctor_name: data.admissions?.[0]?.users?.name,
        department: data.admissions?.[0]?.department,
        diagnosis: data.admissions?.[0]?.diagnosis,
        admission_date: data.admissions?.[0]?.admission_date,
        admissions: data.admissions?.sort((a: Admission, b: Admission) => 
          new Date(b.admission_date).getTime() - new Date(a.admission_date).getTime()
        )
      };

      set(state => ({
        patients: state.patients.map(p => p.id === id ? updatedPatient : p),
        selectedPatient: state.selectedPatient?.id === id ? updatedPatient : state.selectedPatient,
        loading: false
      }));
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  deletePatient: async (id) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set(state => ({
        patients: state.patients.filter(p => p.id !== id),
        selectedPatient: state.selectedPatient?.id === id ? null : state.selectedPatient,
        loading: false
      }));
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  }
}));