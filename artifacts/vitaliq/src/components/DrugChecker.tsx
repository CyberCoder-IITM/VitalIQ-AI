import { useState } from "react";
import { useGetDrugInteractions, useCheckNewDrug } from "@workspace/api-client-react";
import type { DrugInteraction } from "@workspace/api-client-react";

interface Props { patientId: string; patient: any; }

const SEV_COLORS: Record<string, string> = {
  MAJOR: "border-red-500/50 bg-red-500/5",
  MODERATE: "border-amber-500/40 bg-amber-500/5",
  MINOR: "border-green-500/30 bg-green-500/5",
};
const SEV_BADGE: Record<string, string> = {
  MAJOR: "bg-red-500/20 text-red-400 border-red-500/40",
  MODERATE: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  MINOR: "bg-green-500/20 text-green-400 border-green-500/40",
};

function InteractionCard({ ix }: { ix: DrugInteraction }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`border rounded-lg overflow-hidden transition-colors ${SEV_COLORS[ix.severity] ?? SEV_COLORS.MINOR}`}>
      <div
        className="px-3 py-2 cursor-pointer flex items-center gap-2"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${SEV_BADGE[ix.severity] ?? SEV_BADGE.MINOR}`}>
          {ix.severity}
        </span>
        <span className="text-foreground text-xs font-semibold">
          {ix.drug_a} ↔ {ix.drug_b}
        </span>
        <span className="text-muted-foreground text-[10px] ml-auto">{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div className="px-3 pb-3 text-xs space-y-1.5 border-t border-border/50 pt-2">
          <div><span className="text-muted-foreground">Effect: </span><span className="text-foreground">{ix.effect}</span></div>
          <div><span className="text-muted-foreground">Mechanism: </span><span className="text-foreground/80">{ix.mechanism}</span></div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded p-1.5 text-amber-300">
            <span className="font-semibold">Action: </span>{ix.recommendation}
          </div>
          <div><span className="text-muted-foreground">Monitor: </span><span className="text-foreground/80">{ix.monitor}</span></div>
        </div>
      )}
    </div>
  );
}

export default function DrugChecker({ patientId, patient }: Props) {
  const [newDrug, setNewDrug] = useState("");
  const [checkResults, setCheckResults] = useState<DrugInteraction[] | null>(null);
  const { data: interactions = [], isLoading } = useGetDrugInteractions(patientId, { query: { staleTime: 30000 } });
  const { mutate: checkDrug, isPending: isChecking } = useCheckNewDrug();

  const handleCheck = () => {
    if (!newDrug.trim()) return;
    checkDrug({ data: { patient_id: patientId, new_drug: newDrug.trim() } } as any, {
      onSuccess: (data: any) => setCheckResults(data),
    });
  };

  const majorCount = (interactions as DrugInteraction[]).filter(i => i.severity === "MAJOR").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-foreground font-semibold text-sm">DRUG INTERACTION CHECKER</h3>
        {majorCount > 0 && (
          <span className="bg-red-500/20 text-red-400 border border-red-500/40 text-xs font-bold px-2 py-0.5 rounded">
            {majorCount} MAJOR
          </span>
        )}
      </div>

      {/* Current medications */}
      <div className="bg-card border border-border rounded-lg p-3 mb-3">
        <div className="text-muted-foreground text-xs mb-2 font-medium">CURRENT MEDICATIONS</div>
        {(patient?.current_medications ?? []).length === 0 ? (
          <div className="text-muted-foreground text-xs">No medications</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {(patient.current_medications as any[]).map((m: any, i: number) => (
              <span key={i} className="text-xs bg-muted/30 text-foreground border border-border px-2 py-0.5 rounded">
                {m.name} <span className="text-muted-foreground">{m.dose} {m.route}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Check new drug */}
      <div className="bg-card border border-border rounded-lg p-3 mb-3">
        <div className="text-muted-foreground text-xs mb-2 font-medium">CHECK NEW DRUG</div>
        <div className="flex gap-2">
          <input
            value={newDrug}
            onChange={(e) => setNewDrug(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCheck()}
            placeholder="Enter drug name..."
            className="flex-1 bg-background border border-border rounded px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
          <button
            onClick={handleCheck}
            disabled={isChecking || !newDrug.trim()}
            className="text-xs px-3 py-1.5 rounded bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 disabled:opacity-50 transition-colors"
          >
            {isChecking ? "Checking..." : "Check"}
          </button>
        </div>
        {checkResults !== null && (
          <div className="mt-2 space-y-1.5">
            {checkResults.length === 0 ? (
              <div className="text-green-400 text-xs">No interactions found for {newDrug}</div>
            ) : (
              <>
                <div className="text-xs text-muted-foreground mb-1">{checkResults.length} interaction(s) with {newDrug}:</div>
                {checkResults.map((ix, i) => <InteractionCard key={i} ix={ix} />)}
              </>
            )}
          </div>
        )}
      </div>

      {/* Existing interactions */}
      <div className="text-muted-foreground text-xs mb-2 font-medium">EXISTING INTERACTIONS</div>
      {isLoading && (
        <div className="h-16 bg-card border border-border rounded-lg animate-pulse" />
      )}
      {!isLoading && (interactions as DrugInteraction[]).length === 0 && (
        <div className="bg-card border border-border rounded-lg p-4 text-center text-muted-foreground text-xs">
          No drug interactions detected for current medications
        </div>
      )}
      <div className="space-y-2">
        {(interactions as DrugInteraction[]).map((ix, i) => (
          <InteractionCard key={i} ix={ix} />
        ))}
      </div>
    </div>
  );
}
