import { create } from 'zustand';

export interface StreamVitals {
  patient_id: string;
  timestamp: string;
  heart_rate: number;
  systolic_bp: number;
  diastolic_bp: number;
  respiratory_rate: number;
  spo2: number;
  temperature: number;
  gcs: number;
  pain_score: number;
  etco2?: number | null;
}

interface ClinicalStore {
  selectedPatientId: string | null;
  setSelectedPatient: (id: string | null) => void;
  streamingVitals: Record<string, StreamVitals>;
  updateStreamingVitals: (patientId: string, vitals: StreamVitals) => void;
  disclaimerDismissed: boolean;
  dismissDisclaimer: () => void;
}

export const useClinicalStore = create<ClinicalStore>((set) => ({
  selectedPatientId: null,
  setSelectedPatient: (id) => set({ selectedPatientId: id }),
  streamingVitals: {},
  updateStreamingVitals: (patientId, vitals) =>
    set((state) => ({
      streamingVitals: { ...state.streamingVitals, [patientId]: vitals },
    })),
  disclaimerDismissed: false,
  dismissDisclaimer: () => set({ disclaimerDismissed: true }),
}));
