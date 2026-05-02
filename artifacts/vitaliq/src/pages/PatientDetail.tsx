import { useEffect, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetPatient, useClinicalQuery } from "@workspace/api-client-react";
import Header from "@/components/Header";
import PatientHeader from "@/components/PatientHeader";
import { useClinicalStore, type TabId } from "@/store/clinicalStore";
import VitalsMonitor from "@/components/VitalsMonitor";
import NEWS2Gauge from "@/components/NEWS2Gauge";
import DiagnosisPanel from "@/components/DiagnosisPanel";
import SOAPNoteWriter from "@/components/SOAPNoteWriter";
import DrugChecker from "@/components/DrugChecker";
import ICUPredictor from "@/components/ICUPredictor";
import LabResults from "@/components/LabResults";
import AlertTimeline from "@/components/AlertTimeline";
import TriageAgent from "@/components/TriageAgent";
import AlertsDrawer from "@/components/AlertsDrawer";
import TriageDrawer from "@/components/TriageDrawer";

const TABS: { id: TabId; label: string }[] = [
  { id: "diagnosis", label: "🧠 AI Diagnosis" },
  { id: "soap", label: "📝 SOAP Note" },
  { id: "drugs", label: "💊 Drug Safety" },
  { id: "labs", label: "🔬 Lab Trends" },
];

const SUGGESTIONS = [
  "What's causing the tachycardia?",
  "Is this patient safe for discharge?",
  "What's the most dangerous drug interaction?",
  "Explain the NEWS2 score",
  "Should I be worried about the troponin?",
  "What's the biggest risk right now?",
];

function useTypewriter(text: string) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    if (!text) { setDisplayed(""); return; }
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      setDisplayed(text.slice(0, ++i));
      if (i >= text.length) clearInterval(id);
    }, 12);
    return () => clearInterval(id);
  }, [text]);
  return displayed;
}

function ClinicalQueryBar({ patientId }: { patientId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [question, setQuestion] = useState("");
  const { queryHistory, addQueryResponse } = useClinicalStore();
  const { mutate: queryAI, isPending } = useClinicalQuery();
  const history = queryHistory[patientId] ?? [];
  const lastAnswer = history[history.length - 1]?.answer ?? "";
  const typedAnswer = useTypewriter(lastAnswer);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target as HTMLElement).matches("input,textarea")) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  const submit = (q: string) => {
    if (!q.trim() || isPending) return;
    setQuestion("");
    queryAI({ data: { patient_id: patientId, question: q } } as any, {
      onSuccess: (data: any) => addQueryResponse(patientId, q, data.answer),
    });
  };

  return (
    <div className="border-t border-border bg-card shrink-0">
      {history.length > 0 && (
        <div className="px-4 pt-3 max-h-40 overflow-y-auto space-y-2">
          {history.slice(-2).map((h, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-end">
                <span className="text-[11px] bg-primary/20 text-primary border border-primary/20 rounded-lg px-2.5 py-1 max-w-md">
                  {h.question}
                </span>
              </div>
              <div className="flex justify-start">
                <div className="text-[11px] bg-muted/30 border border-border rounded-lg px-2.5 py-1 max-w-lg">
                  <span className="text-cyan-300">
                    {i === history.length - 1 ? typedAnswer : h.answer}
                    {i === history.length - 1 && typedAnswer.length < h.answer.length && (
                      <span className="animate-cursor">▋</span>
                    )}
                  </span>
                  <div className="text-muted-foreground/60 text-[9px] mt-0.5">
                    ⚠ AI reference only — apply clinical judgment
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="px-4 pb-2 pt-2">
        <div className="flex gap-1 mb-2 overflow-x-auto scrollbar-none">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => submit(s)}
              className="text-[10px] whitespace-nowrap bg-muted/30 border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 px-2 py-0.5 rounded-full transition-colors shrink-0">
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit(question)}
            placeholder="💬 Ask anything about this patient... (press / to focus)"
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
          />
          <button
            onClick={() => submit(question)}
            disabled={isPending || !question.trim()}
            className="text-xs px-4 py-2 rounded-lg bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 disabled:opacity-40 transition-colors shrink-0"
          >
            {isPending ? "..." : "Ask"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PatientDetail() {
  const [, params] = useRoute("/patient/:id");
  const [, navigate] = useLocation();
  const patientId = params?.id ?? "";

  const { activeTab, setActiveTab, disclaimerDismissed, dismissDisclaimer, alertsDrawerOpen, triageDrawerOpen } = useClinicalStore();
  const { data: patient, isLoading } = useGetPatient(patientId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Loading patient...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {!disclaimerDismissed && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between shrink-0">
          <span className="text-amber-400 text-xs font-medium">⚠ DEMO — Synthetic data only. Not for clinical use.</span>
          <button onClick={dismissDisclaimer} className="text-amber-400/60 hover:text-amber-400 text-xs">✕</button>
        </div>
      )}
      <Header />
      <PatientHeader patientId={patientId} onBack={() => navigate("/")} />

      {/* Main scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* 3-column grid */}
        <div className="grid gap-3 p-3" style={{ gridTemplateColumns: "272px 1fr 272px" }}>
          {/* Left column */}
          <div className="space-y-3 min-w-0">
            <NEWS2Gauge patientId={patientId} />
            <ICUPredictor patientId={patientId} />
            <DrugChecker patientId={patientId} patient={patient} compact />
          </div>

          {/* Center column */}
          <div className="space-y-3 min-w-0">
            <VitalsMonitor patientId={patientId} />
            <LabResults patientId={patientId} compact />
          </div>

          {/* Right column */}
          <div className="space-y-3 min-w-0">
            <AlertTimeline patientId={patientId} />
            <TriageAgent patientId={patientId} compact />
          </div>
        </div>

        {/* Bottom tabs section */}
        <div className="border-t border-border mx-3 mb-3 rounded-lg overflow-hidden bg-card">
          <div className="flex border-b border-border">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="p-4 min-h-96">
            {activeTab === "diagnosis" && <DiagnosisPanel patientId={patientId} />}
            {activeTab === "soap" && <SOAPNoteWriter patientId={patientId} patient={patient} />}
            {activeTab === "drugs" && <DrugChecker patientId={patientId} patient={patient} />}
            {activeTab === "labs" && <LabResults patientId={patientId} />}
          </div>
        </div>
      </div>

      <ClinicalQueryBar patientId={patientId} />

      {alertsDrawerOpen && <AlertsDrawer />}
      {triageDrawerOpen && <TriageDrawer currentPatientId={patientId} />}
    </div>
  );
}
