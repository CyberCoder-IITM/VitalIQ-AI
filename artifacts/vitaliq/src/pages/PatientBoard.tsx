import { useMemo } from "react";
import { useListPatients, useGetAllCurrentVitals, useGetUnacknowledgedCount, useGetLatestTriage } from "@workspace/api-client-react";
import { useClinicalStore } from "@/store/clinicalStore";
import Header from "@/components/Header";
import PatientCard from "@/components/PatientCard";
import { useLocation } from "wouter";
import AlertsDrawer from "@/components/AlertsDrawer";
import TriageDrawer from "@/components/TriageDrawer";

const SORT_OPTIONS = [
  { value: "news2", label: "NEWS2 ↓" },
  { value: "icu", label: "ICU Risk" },
  { value: "arrival", label: "Arrival Time" },
  { value: "name", label: "Name" },
];

export default function PatientBoard() {
  const [, navigate] = useLocation();
  const { disclaimerDismissed, dismissDisclaimer, sortMode, setSortMode, alertsDrawerOpen, triageDrawerOpen } = useClinicalStore();
  const { data: patients = [], isLoading: loadingPatients } = useListPatients();
  const { data: allVitals } = useGetAllCurrentVitals({ query: { refetchInterval: 3000 } });
  const { data: alertCount } = useGetUnacknowledgedCount({ query: { refetchInterval: 5000 } });
  const { data: triage } = useGetLatestTriage({ query: { refetchInterval: 15000 } });

  const news2High = (patients as any[]).filter((_p: any) => (_p as any).__news2 >= 7).length;
  const news2Med = (patients as any[]).filter((_p: any) => (_p as any).__news2 >= 5 && (_p as any).__news2 < 7).length;

  const sortedPatients = useMemo(() => {
    if (!patients || patients.length === 0) return patients;
    const arr = [...(patients as any[])];
    if (sortMode === "name") return arr.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    if (sortMode === "arrival") return arr.sort((a, b) => new Date(a.arrival_time ?? 0).getTime() - new Date(b.arrival_time ?? 0).getTime());
    return arr;
  }, [patients, sortMode]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {!disclaimerDismissed && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between shrink-0">
          <span className="text-amber-400 text-xs font-medium">
            ⚠ DEMO MODE — Synthetic data only. Not for clinical use. Not FDA approved.
          </span>
          <button onClick={dismissDisclaimer} className="text-amber-400/60 hover:text-amber-400 text-xs ml-4">✕ Dismiss</button>
        </div>
      )}
      <Header />

      <div className="flex-1 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-foreground font-semibold text-sm">ACTIVE PATIENTS</h2>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">Sort:</span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as any)}
              className="text-xs bg-card border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:border-primary"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {news2High > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-medium">
              NEWS2 ≥7: {news2High} patients
            </span>
          )}
          {news2Med > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-medium">
              NEWS2 5–6: {news2Med} patients
            </span>
          )}
          {(alertCount?.count ?? 0) > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-medium">
              {alertCount?.count} unacked alerts
            </span>
          )}
          <span className="text-muted-foreground text-xs ml-auto">Live vitals · Refreshing every 3s</span>
        </div>

        {loadingPatients ? (
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-52 rounded-lg bg-card border border-border animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {sortedPatients.map((patient: any) => {
              const vitals = allVitals?.[patient.id as keyof typeof allVitals];
              return (
                <PatientCard
                  key={patient.id}
                  patient={patient}
                  vitals={vitals as any}
                  onClick={() => navigate(`/patient/${patient.id}`)}
                />
              );
            })}
          </div>
        )}
      </div>

      {alertsDrawerOpen && <AlertsDrawer />}
      {triageDrawerOpen && <TriageDrawer />}
    </div>
  );
}
