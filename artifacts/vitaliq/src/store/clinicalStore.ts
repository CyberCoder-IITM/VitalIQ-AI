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

export type TabId = 'diagnosis' | 'soap' | 'drugs' | 'labs';
export type SortMode = 'news2' | 'icu' | 'arrival' | 'name';

export interface QueryEntry {
  question: string;
  answer: string;
  timestamp: string;
}

interface ClinicalStore {
  selectedPatientId: string | null;
  setSelectedPatient: (id: string | null) => void;

  streamingVitals: Record<string, StreamVitals>;
  updateStreamingVitals: (patientId: string, vitals: StreamVitals) => void;

  disclaimerDismissed: boolean;
  dismissDisclaimer: () => void;

  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;

  alertsDrawerOpen: boolean;
  toggleAlertsDrawer: () => void;
  closeAlertsDrawer: () => void;

  triageDrawerOpen: boolean;
  toggleTriageDrawer: () => void;
  closeTriageDrawer: () => void;

  keyboardShortcutsOpen: boolean;
  setKeyboardShortcutsOpen: (open: boolean) => void;

  queryHistory: Record<string, QueryEntry[]>;
  addQueryResponse: (patientId: string, question: string, answer: string) => void;
  clearQueryHistory: (patientId: string) => void;

  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;
}

export const useClinicalStore = create<ClinicalStore>((set) => ({
  selectedPatientId: null,
  setSelectedPatient: (id) => set({ selectedPatientId: id }),

  streamingVitals: {},
  updateStreamingVitals: (patientId, vitals) =>
    set((state) => ({ streamingVitals: { ...state.streamingVitals, [patientId]: vitals } })),

  disclaimerDismissed: false,
  dismissDisclaimer: () => set({ disclaimerDismissed: true }),

  activeTab: 'diagnosis',
  setActiveTab: (tab) => set({ activeTab: tab }),

  alertsDrawerOpen: false,
  toggleAlertsDrawer: () => set((s) => ({ alertsDrawerOpen: !s.alertsDrawerOpen })),
  closeAlertsDrawer: () => set({ alertsDrawerOpen: false }),

  triageDrawerOpen: false,
  toggleTriageDrawer: () => set((s) => ({ triageDrawerOpen: !s.triageDrawerOpen })),
  closeTriageDrawer: () => set({ triageDrawerOpen: false }),

  keyboardShortcutsOpen: false,
  setKeyboardShortcutsOpen: (open) => set({ keyboardShortcutsOpen: open }),

  queryHistory: {},
  addQueryResponse: (patientId, question, answer) =>
    set((state) => {
      const prev = state.queryHistory[patientId] ?? [];
      const updated = [...prev, { question, answer, timestamp: new Date().toISOString() }].slice(-3);
      return { queryHistory: { ...state.queryHistory, [patientId]: updated } };
    }),
  clearQueryHistory: (patientId) =>
    set((state) => {
      const { [patientId]: _, ...rest } = state.queryHistory;
      return { queryHistory: rest };
    }),

  sortMode: 'news2',
  setSortMode: (mode) => set({ sortMode: mode }),
}));
