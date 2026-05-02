import { useState } from "react";
import { useGetDrugInteractions, useCheckNewDrug } from "@workspace/api-client-react";
import { useClinicalStore } from "@/store/clinicalStore";
import type { DrugInteraction } from "@workspace/api-client-react";

interface Props { patientId: string; patient?: any; compact?: boolean; }

const SEV_COLORS: Record<string, string> = {
  MAJOR: "border-l-red-500 bg-red-500/5", MODERATE: "border-l-amber-500 bg-amber-500/5", MINOR: "border-l-green-500 bg-green-500/5",
};
const SEV_BADGE: Record<string, string> = {
  MAJOR: "bg-red-500/20 text-red-400 border-red-500/40",
  MODERATE: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  MINOR: "bg-green-500/20 text-green-400 border-green-500/40",
};
const SUGGESTIONS = ["Aspirin", "Heparin", "Morphine", "Metformin", "Vancomycin", "Amiodarone"];

function InteractionCard({ ix }: { ix: DrugInteraction }) {
  const [exp, setExp] = useState(false);
  return (
    <div className={`border-l-2 pl-2 pr-2 py-1.5 rounded-r text-xs ${SEV_COLORS[ix.severity] ?? SEV_COLORS.MINOR}`}>
      <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setExp(!exp)}>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${SEV_BADGE[ix.severity] ?? SEV_BADGE.MINOR}`}>{ix.severity}</span>
        <span className="text-foreground text-[11px] font-semibold">{ix.drug_a} ↔ {ix.drug_b}</span>
        <span className="text-muted-foreground text-[10px] ml-auto">{exp ? "▲" : "▼"}</span>
      </div>
      <div className="text-muted-foreground text-[10px] mt-0.5">⚡ {ix.effect}</div>
      {exp && (
        <div className="mt-1.5 space-y-1">
          <div><span className="text-muted-foreground">🔬 </span><span className="text-foreground/80 text-[10px]">{ix.mechanism}</span></div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded px-1.5 py-1 text-[10px] text-blue-300">
            📋 {ix.recommendation}
          </div>
          <div><span className="text-muted-foreground">👁 </span><span className="text-foreground/80 text-[10px]">{ix.monitor}</span></div>
        </div>
      )}
    </div>
  );
}

export default function DrugChecker({ patientId, patient, compact }: Props) {
  const [newDrug, setNewDrug] = useState("");
  const [checkResults, setCheckResults] = useState<DrugInteraction[] | null>(null);
  const { setActiveTab } = useClinicalStore();
  const { data: interactions = [], isLoading } = useGetDrugInteractions(patientId, { query: { staleTime: 30000 } });
  const { mutate: checkDrug, isPending: isChecking } = useCheckNewDrug();

  const majorCount = (interactions as DrugInteraction[]).filter((i) => i.severity === "MAJOR").length;
  const meds = patient?.current_medications ?? [];

  const handleCheck = () => {
    if (!newDrug.trim()) return;
    checkDrug({ data: { patient_id: patientId, new_drug: newDrug.trim() } } as any, {
      onSuccess: (d: any) => setCheckResults(d),
    });
    setNewDrug("");
  };

  if (compact) {
    return (
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-foreground text-xs font-semibold">💊 DRUG SAFETY</span>
            {majorCount > 0 && <span className="bg-red-500/20 text-red-400 border border-red-500/40 text-[9px] font-bold px-1 rounded">{majorCount} MAJOR</span>}
          </div>
          <button onClick={() => setActiveTab("drugs")} className="text-[10px] text-primary hover:text-primary/80 transition-colors">Details →</button>
        </div>
        <div className="p-2 space-y-1">
          {isLoading && <div className="h-8 bg-muted/30 rounded animate-pulse" />}
          {!isLoading && (interactions as DrugInteraction[]).length === 0 && (
            <div className="text-green-400 text-[10px] px-1">✓ No interactions detected</div>
          )}
          {!isLoading && (interactions as DrugInteraction[]).length > 0 && (
            <div className="text-amber-400 text-[10px] px-1">⚠ {(interactions as DrugInteraction[]).length} interaction(s) detected</div>
          )}
          <div className="flex flex-wrap gap-1 px-1">
            {meds.slice(0, 4).map((m: any, i: number) => {
              const hasMajor = (interactions as DrugInteraction[]).some(
                (ix) => ix.severity === "MAJOR" && (ix.drug_a.toLowerCase().includes(m.name.toLowerCase()) || ix.drug_b.toLowerCase().includes(m.name.toLowerCase()))
              );
              return (
                <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded border ${hasMajor ? "bg-red-500/15 text-red-300 border-red-500/30" : "bg-muted/30 text-foreground border-border"}`}>
                  {hasMajor && "⚠ "}{m.name}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-foreground font-semibold text-sm">DRUG INTERACTION CHECKER</h3>
        {majorCount > 0 && <span className="bg-red-500/20 text-red-400 border border-red-500/40 text-xs font-bold px-2 py-0.5 rounded">{majorCount} MAJOR</span>}
      </div>

      {/* Current medications table */}
      {meds.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden mb-3">
          <div className="px-3 py-2 border-b border-border/50 text-muted-foreground text-[10px] font-semibold uppercase">Current Medications</div>
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border/30">
              <th className="text-left px-3 py-1.5 text-muted-foreground font-normal">Drug</th>
              <th className="text-center py-1.5 text-muted-foreground font-normal">Dose</th>
              <th className="text-center py-1.5 text-muted-foreground font-normal">Route</th>
              <th className="text-center pr-3 py-1.5 text-muted-foreground font-normal">Status</th>
            </tr></thead>
            <tbody>
              {meds.map((m: any, i: number) => {
                const hasMajor = (interactions as DrugInteraction[]).some(
                  (ix) => ix.severity === "MAJOR" && (ix.drug_a.toLowerCase().includes(m.name.toLowerCase()) || ix.drug_b.toLowerCase().includes(m.name.toLowerCase()))
                );
                return (
                  <tr key={i} className="border-b border-border/20 last:border-0">
                    <td className="px-3 py-1.5 text-foreground font-medium">{m.name}</td>
                    <td className="py-1.5 text-center text-muted-foreground">{m.dose}</td>
                    <td className="py-1.5 text-center text-muted-foreground">{m.route}</td>
                    <td className="py-1.5 pr-3 text-center">
                      {hasMajor ? <span className="text-red-400 text-[10px] font-bold">⚠ MAJOR</span> : <span className="text-green-400 text-[10px]">OK</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Check new drug */}
      <div className="bg-card border border-border rounded-lg p-3 mb-3">
        <div className="text-muted-foreground text-[10px] font-semibold uppercase mb-2">Check New Drug</div>
        <div className="flex gap-2 mb-2">
          <input value={newDrug} onChange={(e) => setNewDrug(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCheck()}
            placeholder="Type medication name to check..."
            className="flex-1 bg-background border border-border rounded px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
          <button onClick={handleCheck} disabled={isChecking || !newDrug.trim()}
            className="text-xs px-3 py-1.5 rounded bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 disabled:opacity-50 transition-colors">
            {isChecking ? "Checking..." : "Check"}
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => setNewDrug(s)}
              className="text-[10px] bg-muted/30 border border-border text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-full transition-colors">
              {s}
            </button>
          ))}
        </div>
        {checkResults !== null && (
          <div className="mt-2 space-y-1.5">
            {checkResults.length === 0
              ? <div className="text-green-400 text-xs">✓ No interactions with current medications</div>
              : <>
                <div className="text-xs text-muted-foreground">Adding {newDrug || "this drug"} would cause {checkResults.length} interaction(s):</div>
                {checkResults.map((ix, i) => <InteractionCard key={i} ix={ix} />)}
              </>
            }
          </div>
        )}
      </div>

      {/* Existing interactions */}
      <div className="text-muted-foreground text-[10px] font-semibold uppercase mb-2">Detected Interactions</div>
      {isLoading && <div className="h-16 bg-card border border-border rounded-lg animate-pulse" />}
      {!isLoading && (interactions as DrugInteraction[]).length === 0 && (
        <div className="bg-card border border-border rounded-lg p-4 text-center text-green-400 text-xs">✓ No drug interactions detected for current medications</div>
      )}
      <div className="space-y-1.5">
        {(interactions as DrugInteraction[]).map((ix, i) => <InteractionCard key={i} ix={ix} />)}
      </div>
    </div>
  );
}
