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

  const news2High = (patients as any[]).filter((_p: any) => (_p as any).__news2 >= 7).length;
  const news2Med  = (patients as any[]).filter((_p: any) => (_p as any).__news2 >= 5 && (_p as any).__news2 < 7).length;

  const sortedPatients = useMemo(() => {
    if (!patients || patients.length === 0) return patients;
    const arr = [...(patients as any[])];
    if (sortMode === "name")    return arr.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
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

      <div className="flex-1 p-3">
        {/* Toolbar */}
        <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-foreground font-semibold text-sm tracking-wide">ACTIVE PATIENTS</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {news2High > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-medium">
                NEWS2 ≥7: {news2High}
              </span>
            )}
            {news2Med > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-medium">
                NEWS2 5–6: {news2Med}
              </span>
            )}
            {(alertCount?.count ?? 0) > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-medium">
                {alertCount?.count} unacked
              </span>
            )}
            <span className="text-muted-foreground text-[10px]">Live · every 3s</span>
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

        {/* Responsive card grid: 1 col → 2 → 3 → 4 */}
        {loadingPatients ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-52 rounded-lg bg-card border border-border animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
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
