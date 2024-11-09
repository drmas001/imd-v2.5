import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useUserStore } from './useUserStore';

export interface ActivePatient {
  id: number;
  patient_id: number;
  mrn: string;
  name: string;
  admission_date: string;
  department: string;
  doctor_name: string;
  diagnosis: string;
  status: 'active' | 'discharged' | 'transferred';
  admitting_doctor_id: number;
  shift_type: 'morning' | 'evening' | 'night' | 'weekend_morning' | 'weekend_night';
  is_weekend: boolean;
  isConsultation?: boolean;
  consultation_id?: number;
}

interface DischargeData {
  discharge_date: string;
  discharge_type: 'regular' | 'against-medical-advice' | 'transfer';
  follow_up_required: boolean;
  follow_up_date?: string;
  discharge_note: string;
}

interface DischargeStore {
  activePatients: ActivePatient[];
  loading: boolean;
  error: string | null;
  selectedPatient: ActivePatient | null;
  fetchActivePatients: () => Promise<void>;
  setSelectedPatient: (patient: ActivePatient | null) => void;
  processDischarge: (data: DischargeData) => Promise<void>;
}

export const useDischargeStore = create<DischargeStore>((set, get) => ({
  activePatients: [],
  loading: false,
  error: null,
  selectedPatient: null,

  fetchActivePatients: async () => {
    set({ loading: true, error: null });
    try {
      const { data: admissionsData, error: admissionsError } = await supabase
        .from('active_admissions')
        .select('*')
        .eq('status', 'active');

      if (admissionsError) throw admissionsError;

      const { data: consultationsData, error: consultationsError } = await supabase
        .from('consultations')
        .select('*')
        .eq('status', 'active');

      if (consultationsError) throw consultationsError;

      const consultationPatients = consultationsData.map(consultation => ({
        id: consultation.id,
        patient_id: consultation.patient_id,
        mrn: consultation.mrn,
        name: consultation.patient_name,
        admission_date: consultation.created_at,
        department: consultation.consultation_specialty,
        doctor_name: consultation.doctor_name || 'Pending Assignment',
        diagnosis: consultation.reason,
        status: 'active' as const,
        admitting_doctor_id: consultation.doctor_id,
        shift_type: consultation.shift_type || 'morning',
        is_weekend: false,
        isConsultation: true,
        consultation_id: consultation.id
      }));

      set({ 
        activePatients: [...(admissionsData || []), ...consultationPatients], 
        loading: false 
      });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  setSelectedPatient: (patient) => {
    set({ selectedPatient: patient });
  },

  processDischarge: async (data) => {
    set({ loading: true, error: null });
    try {
      const selectedPatient = get().selectedPatient;
      const currentUser = useUserStore.getState().currentUser;

      if (!selectedPatient) throw new Error('No patient selected');
      if (!currentUser) throw new Error('No user logged in');

      if (selectedPatient.isConsultation) {
        const { error: consultationError } = await supabase
          .from('consultations')
          .update({
            status: 'completed',
            completion_note: data.discharge_note,
            completed_by: currentUser.id,
            completed_at: new Date().toISOString()
          })
          .eq('id', selectedPatient.consultation_id);

        if (consultationError) throw consultationError;

        const { error: noteError } = await supabase
          .from('medical_notes')
          .insert([{
            patient_id: selectedPatient.patient_id,
            doctor_id: currentUser.id,
            note_type: 'Consultation Note',
            content: data.discharge_note
          }]);

        if (noteError) throw noteError;
      } else {
        const { error: updateError } = await supabase
          .from('admissions')
          .update({
            status: 'discharged',
            discharge_date: data.discharge_date,
            discharge_type: data.discharge_type,
            follow_up_required: data.follow_up_required,
            follow_up_date: data.follow_up_date || null
          })
          .eq('id', selectedPatient.id);

        if (updateError) throw updateError;

        const { error: noteError } = await supabase
          .from('medical_notes')
          .insert([{
            patient_id: selectedPatient.patient_id,
            doctor_id: currentUser.id,
            note_type: 'Discharge Summary',
            content: data.discharge_note
          }]);

        if (noteError) throw noteError;
      }

      // Refresh the active patients list after discharge
      await get().fetchActivePatients();
      
      // Clear the selected patient
      set({ selectedPatient: null, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  }
}));