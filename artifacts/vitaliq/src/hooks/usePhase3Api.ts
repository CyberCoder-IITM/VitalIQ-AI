import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: init?.body ? { "Content-Type": "application/json" } : {},
    ...init,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VitalForecast { current: number; predicted_5min: number; slope: number; direction: string; }

export interface DeteriorationForecast {
  patient_id: string;
  timestamp: string;
  current_news2: number;
  predicted_news2_5min: number;
  predicted_news2_10min: number;
  news2_trajectory: string;
  news2_history: number[];
  vital_forecasts: Record<string, VitalForecast>;
  patterns: { sepsis: number; respiratory_failure: number; hemodynamic_shock: number; neuro_deterioration: number; cardiac_arrest_risk: number };
  dominant_pattern: string | null;
  dominant_pattern_probability: number;
  intervention_window: string;
  time_to_critical_minutes: number | null;
  confidence: number;
  forecast_basis: string;
}

export interface SBARHandoff {
  patient_id: string;
  generated_at: string;
  outgoing_provider: string;
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  urgency: "ROUTINE" | "URGENT" | "EMERGENT";
  key_concerns: string[];
  pending_items: string[];
  verbal_summary: string;
}

export interface TimelineEvent {
  event_id: string;
  patient_id: string;
  timestamp: string;
  event_type: string;
  title: string;
  detail: string;
  severity: string;
  triggered_by: string;
  data_snapshot: Record<string, any>;
}

export interface BundleItem { item_id: string; item: string; completed: boolean; completed_at: string | null; time_to_complete: number | null; overdue: boolean; }

export interface SepsisStatus {
  patient_id: string;
  qsofa_score: number;
  qsofa_criteria_met: string[];
  sepsis_concern: boolean;
  sepsis_confirmed: boolean;
  bundle_1hr: BundleItem[];
  bundle_3hr: BundleItem[];
  time_since_recognition: number | null;
  recognition_time: string | null;
  bundle_compliance: number;
  cms_penalty_risk: boolean;
  alert_generated: boolean;
}

export interface MedicationDose {
  dose_id: string;
  patient_id: string;
  medication_name: string;
  dose: string;
  route: string;
  frequency: string;
  scheduled_time: string;
  administered_time: string | null;
  status: "UPCOMING" | "DUE" | "OVERDUE" | "ADMINISTERED" | "HELD" | "REFUSED";
  held_reason: string | null;
  minutes_until_due: number | null;
}

export interface RiskSnapshot {
  timestamp: string;
  news2: number;
  icu_probability: number;
  dominant_pattern: string | null;
  pattern_probability: number;
  alert_count: number;
  intervention_window: string;
}

// ─── Forecast Hooks ──────────────────────────────────────────────────────────

export function useGetForecast(patientId: string, opts?: { refetchInterval?: number }) {
  return useQuery<DeteriorationForecast>({
    queryKey: ["/api/forecast", patientId],
    queryFn: () => apiFetch<DeteriorationForecast>(`/forecast/${patientId}`),
    refetchInterval: opts?.refetchInterval ?? 15000,
    enabled: !!patientId,
  });
}

export function useGetAllForecasts(opts?: { refetchInterval?: number }) {
  return useQuery<DeteriorationForecast[]>({
    queryKey: ["/api/forecast/all"],
    queryFn: () => apiFetch<DeteriorationForecast[]>("/forecast/all"),
    refetchInterval: opts?.refetchInterval ?? 15000,
  });
}

// ─── Handoff Hooks ───────────────────────────────────────────────────────────

export function useGenerateHandoff() {
  return useMutation<SBARHandoff, Error, { patientId: string; outgoing_provider?: string }>({
    mutationFn: ({ patientId, outgoing_provider }) =>
      apiFetch<SBARHandoff>(`/ai/handoff/${patientId}`, {
        method: "POST",
        body: JSON.stringify({ outgoing_provider: outgoing_provider ?? "Dr. Attending" }),
      }),
  });
}

export function useGenerateDepartmentHandoff() {
  return useMutation<SBARHandoff[], Error, void>({
    mutationFn: () => apiFetch<SBARHandoff[]>("/ai/handoff/department", { method: "GET" }),
  });
}

export function useGetCommandPrediction() {
  return useQuery<{ prediction: string; generated_at: string }>({
    queryKey: ["/api/ai/command/prediction"],
    queryFn: () => apiFetch("/ai/command/prediction"),
    refetchInterval: 300000,
    staleTime: 240000,
  });
}

// ─── Timeline Hooks ──────────────────────────────────────────────────────────

export function useGetTimeline(patientId: string, opts?: { refetchInterval?: number }) {
  return useQuery<TimelineEvent[]>({
    queryKey: ["/api/timeline", patientId],
    queryFn: () => apiFetch<TimelineEvent[]>(`/timeline/${patientId}`),
    refetchInterval: opts?.refetchInterval ?? 10000,
    enabled: !!patientId,
  });
}

export function useGetDepartmentTimeline(opts?: { refetchInterval?: number }) {
  return useQuery<TimelineEvent[]>({
    queryKey: ["/api/timeline/department"],
    queryFn: () => apiFetch<TimelineEvent[]>("/timeline/department"),
    refetchInterval: opts?.refetchInterval ?? 10000,
  });
}

// ─── Sepsis Hooks ────────────────────────────────────────────────────────────

export function useGetSepsisStatus(patientId: string, opts?: { refetchInterval?: number }) {
  return useQuery<SepsisStatus>({
    queryKey: ["/api/sepsis", patientId],
    queryFn: () => apiFetch<SepsisStatus>(`/sepsis/${patientId}`),
    refetchInterval: opts?.refetchInterval ?? 15000,
    enabled: !!patientId,
  });
}

export function useGetAllSepsisStatuses() {
  return useQuery<SepsisStatus[]>({
    queryKey: ["/api/sepsis/all"],
    queryFn: () => apiFetch<SepsisStatus[]>("/sepsis/all"),
    refetchInterval: 15000,
  });
}

export function useCompleteBundleItem() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, { patientId: string; itemId: string }>({
    mutationFn: ({ patientId, itemId }) =>
      apiFetch(`/sepsis/${patientId}/bundle/${itemId}/complete`, { method: "POST" }),
    onSuccess: (_, { patientId }) => {
      qc.invalidateQueries({ queryKey: ["/api/sepsis", patientId] });
    },
  });
}

// ─── Medication Hooks ────────────────────────────────────────────────────────

export function useGetMedicationSchedule(patientId: string, opts?: { refetchInterval?: number }) {
  return useQuery<MedicationDose[]>({
    queryKey: ["/api/medications", patientId, "schedule"],
    queryFn: () => apiFetch<MedicationDose[]>(`/medications/${patientId}/schedule`),
    refetchInterval: opts?.refetchInterval ?? 30000,
    enabled: !!patientId,
  });
}

export function useGetOverdueMedications() {
  return useQuery<MedicationDose[]>({
    queryKey: ["/api/medications/overdue"],
    queryFn: () => apiFetch<MedicationDose[]>("/medications/overdue"),
    refetchInterval: 30000,
  });
}

export function useAdministerMedication() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, { doseId: string; patientId: string }>({
    mutationFn: ({ doseId }) => apiFetch(`/medications/${doseId}/administer`, { method: "POST" }),
    onSuccess: (_, { patientId }) => {
      qc.invalidateQueries({ queryKey: ["/api/medications", patientId, "schedule"] });
      qc.invalidateQueries({ queryKey: ["/api/medications/overdue"] });
    },
  });
}

export function useHoldMedication() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, { doseId: string; patientId: string; reason: string }>({
    mutationFn: ({ doseId, reason }) =>
      apiFetch(`/medications/${doseId}/hold`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: (_, { patientId }) => {
      qc.invalidateQueries({ queryKey: ["/api/medications", patientId, "schedule"] });
    },
  });
}

// ─── Risk History Hooks ──────────────────────────────────────────────────────

export function useGetRiskHistory(patientId: string) {
  return useQuery<RiskSnapshot[]>({
    queryKey: ["/api/history", patientId, "risk"],
    queryFn: () => apiFetch<RiskSnapshot[]>(`/history/${patientId}/risk`),
    refetchInterval: 30000,
    enabled: !!patientId,
  });
}
