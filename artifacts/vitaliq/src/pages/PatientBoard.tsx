import { useListPatients, useGetAllCurrentVitals } from "@workspace/api-client-react";
import { useClinicalStore } from "@/store/clinicalStore";
import Header from "@/components/Header";
import PatientCard from "@/components/PatientCard";
import { useLocation } from "wouter";

export default function PatientBoard() {
  const [, navigate] = useLocation();
  const { disclaimerDismissed, dismissDisclaimer } = useClinicalStore();
  const { data: patients, isLoading: loadingPatients } = useListPatients();
  const { data: allVitals } = useGetAllCurrentVitals({ query: { refetchInterval: 3000 } });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {!disclaimerDismissed && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between">
          <span className="text-amber-400 text-xs font-medium">
            ⚠ DEMO MODE — Synthetic data only. Not for clinical use. Not FDA approved.
          </span>
          <button onClick={dismissDisclaimer} className="text-amber-400/60 hover:text-amber-400 text-xs ml-4">
            ✕ Dismiss
          </button>
        </div>
      )}

      <Header />

      <div className="flex-1 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-foreground font-semibold text-sm">ACTIVE PATIENTS</h2>
          <span className="text-muted-foreground text-xs">Live vitals · Refreshing every 3s</span>
        </div>

        {loadingPatients ? (
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-48 rounded-lg bg-card border border-border animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {(patients ?? []).map((patient) => {
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
    </div>
  );
}
