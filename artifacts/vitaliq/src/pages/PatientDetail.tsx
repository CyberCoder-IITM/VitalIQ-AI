import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetPatient, useGetCurrentVitals, useGetNews2Score, useGetDrugInteractions, useGetIcuRisk, useGetPatientAlerts, useGetLabResults } from "@workspace/api-client-react";
import Header from "@/components/Header";
import { useClinicalStore } from "@/store/clinicalStore";
import VitalsMonitor from "@/components/VitalsMonitor";
import NEWS2Gauge from "@/components/NEWS2Gauge";
import DiagnosisPanel from "@/components/DiagnosisPanel";
import SOAPNoteWriter from "@/components/SOAPNoteWriter";
import DrugChecker from "@/components/DrugChecker";
import ICUPredictor from "@/components/ICUPredictor";
import LabResults from "@/components/LabResults";
import AlertTimeline from "@/components/AlertTimeline";
import TriageAgent from "@/components/TriageAgent";

const TABS = [
  { id: "vitals", label: "Vitals" },
  { id: "news2", label: "NEWS2" },
  { id: "diagnosis", label: "AI Diagnosis" },
  { id: "soap", label: "SOAP Note" },
  { id: "drugs", label: "Drug Checker" },
  { id: "icu", label: "ICU Risk" },
  { id: "labs", label: "Labs" },
];

const ACUITY_COLORS: Record<number, string> = {
  1: "bg-red-500 text-white",
  2: "bg-orange-500 text-white",
  3: "bg-amber-400 text-black",
  4: "bg-green-500 text-white",
  5: "bg-blue-400 text-white",
};

export default function PatientDetail() {
  const [, params] = useRoute("/patient/:id");
  const [, navigate] = useLocation();
  const patientId = params?.id ?? "";
  const [activeTab, setActiveTab] = useState("vitals");
  const { disclaimerDismissed, dismissDisclaimer } = useClinicalStore();

  const { data: patient, isLoading } = useGetPatient(patientId);
  const { data: vitals } = useGetCurrentVitals(patientId, { query: { refetchInterval: 3000, enabled: !!patientId } });
  const { data: news2 } = useGetNews2Score(patientId, { query: { refetchInterval: 4000, enabled: !!patientId } });
  const { data: alerts } = useGetPatientAlerts(patientId, { query: { refetchInterval: 5000, enabled: !!patientId } });
  const { data: interactions } = useGetDrugInteractions(patientId, { query: { staleTime: 30000, enabled: !!patientId } });
  const { data: icu } = useGetIcuRisk(patientId, { query: { refetchInterval: 15000, enabled: !!patientId } });

  const news2Score = news2?.score ?? 0;
  const unackAlerts = (alerts ?? []).filter((a: any) => !a.acknowledged).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Loading patient...</div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Patient not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {!disclaimerDismissed && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between">
          <span className="text-amber-400 text-xs font-medium">
            ⚠ DEMO MODE — Synthetic data only. Not for clinical use. Not FDA approved.
          </span>
          <button onClick={dismissDisclaimer} className="text-amber-400/60 hover:text-amber-400 text-xs">✕</button>
        </div>
      )}
      <Header />

      {/* Patient Header Bar */}
      <div className="bg-card border-b border-border px-4 py-2.5 flex items-center gap-4">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground text-xs transition-colors">
          ← Board
        </button>
        <div className="border-l border-border pl-3 flex items-center gap-3">
          <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${ACUITY_COLORS[patient.acuity] ?? ACUITY_COLORS[3]}`}>
            ESI {patient.acuity}
          </span>
          <span className="text-foreground font-semibold text-sm">{patient.name}</span>
          <span className="text-muted-foreground text-xs">{patient.age}{patient.sex}</span>
          <span className="text-muted-foreground text-xs border-l border-border pl-2">{patient.bed}</span>
          <span className="text-muted-foreground text-xs border-l border-border pl-2">{patient.chief_complaint}</span>
          <span className="text-muted-foreground text-xs border-l border-border pl-2">
            Att: {patient.attending}
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          {news2Score >= 5 && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${news2Score >= 7 ? "bg-red-500/20 text-red-400 border-red-500/40 animate-pulse" : "bg-amber-500/20 text-amber-400 border-amber-500/40"}`}>
              NEWS2: {news2Score}
            </span>
          )}
          {unackAlerts > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {unackAlerts}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded border ${patient.code_status === "FULL" ? "text-green-400 border-green-400/30" : "text-amber-400 border-amber-400/30"}`}>
            {patient.code_status}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card border-b border-border px-4 flex gap-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main content + Sidebar */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Main panel */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "vitals" && <VitalsMonitor patientId={patientId} />}
          {activeTab === "news2" && <NEWS2Gauge patientId={patientId} />}
          {activeTab === "diagnosis" && <DiagnosisPanel patientId={patientId} />}
          {activeTab === "soap" && <SOAPNoteWriter patientId={patientId} />}
          {activeTab === "drugs" && <DrugChecker patientId={patientId} patient={patient} />}
          {activeTab === "icu" && <ICUPredictor patientId={patientId} />}
          {activeTab === "labs" && <LabResults patientId={patientId} />}
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l border-border flex flex-col overflow-hidden shrink-0">
          <div className="flex-1 overflow-y-auto">
            <AlertTimeline patientId={patientId} />
          </div>
          <div className="border-t border-border overflow-y-auto max-h-64">
            <TriageAgent />
          </div>
        </div>
      </div>
    </div>
  );
}
