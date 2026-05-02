import { useState } from "react";
import { useGenerateDiagnosis } from "@workspace/api-client-react";
import type { DiagnosisItem, DifferentialDiagnosis } from "@workspace/api-client-react";

interface Props { patientId: string; }

const DISPOSITION_COLORS: Record<string, string> = {
  DISCHARGE: "bg-green-500/20 text-green-400 border-green-500/40",
  OBSERVE: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  ADMIT_FLOOR: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  ADMIT_ICU: "bg-red-500/20 text-red-400 border-red-500/40",
  OR: "bg-purple-500/20 text-purple-400 border-purple-500/40",
};

function DiagCard({ dx, expanded, onToggle }: { dx: DiagnosisItem; expanded: boolean; onToggle: () => void }) {
  const probColor =
    dx.probability === "HIGH" ? "bg-red-500/20 text-red-400 border-red-500/40"
    : dx.probability === "MEDIUM" ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
    : "bg-muted/30 text-muted-foreground border-border";

  const barWidth = `${dx.probability_percent}%`;
  const barColor = dx.probability === "HIGH" ? "bg-red-400" : dx.probability === "MEDIUM" ? "bg-amber-400" : "bg-muted-foreground";

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-3 cursor-pointer hover:bg-muted/10 transition-colors" onClick={onToggle}>
        <div className="flex items-start gap-2">
          <span className="text-muted-foreground text-xs font-mono w-5 shrink-0 mt-0.5">#{dx.rank}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-foreground text-sm font-semibold">{dx.diagnosis}</span>
              <span className="text-muted-foreground text-[10px] bg-muted/30 px-1.5 py-0.5 rounded font-mono">{dx.icd10_code}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${probColor}`}>
                {dx.probability} · {dx.probability_percent}%
              </span>
            </div>
            <div className="mt-1.5 h-1 bg-muted/30 rounded-full overflow-hidden">
              <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: barWidth }} />
            </div>
          </div>
          <span className="text-muted-foreground text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-border/50 pt-2.5 text-xs space-y-2">
          {dx.supporting_evidence.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-1">Supporting Evidence</div>
              {dx.supporting_evidence.map((e, i) => (
                <div key={i} className="flex gap-1.5 text-green-400"><span>✓</span><span>{e}</span></div>
              ))}
            </div>
          )}
          {dx.against_evidence.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-1">Against</div>
              {dx.against_evidence.map((e, i) => (
                <div key={i} className="flex gap-1.5 text-red-400/80"><span>✗</span><span>{e}</span></div>
              ))}
            </div>
          )}
          {dx.immediate_workup.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-1">Immediate Workup</div>
              {dx.immediate_workup.map((e, i) => (
                <div key={i} className="flex gap-1.5 text-blue-300"><span>→</span><span>{e}</span></div>
              ))}
            </div>
          )}
          {dx.red_flags.length > 0 && (
            <div>
              {dx.red_flags.map((e, i) => (
                <div key={i} className="flex gap-1.5 text-red-300 bg-red-500/10 px-2 py-0.5 rounded"><span>⚡</span><span>{e}</span></div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DiagnosisPanel({ patientId }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);
  const [diagnosis, setDiagnosis] = useState<DifferentialDiagnosis | null>(null);
  const { mutate: generate, isPending } = useGenerateDiagnosis();

  const handleGenerate = () => {
    generate({ patientId }, {
      onSuccess: (data: any) => setDiagnosis(data),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-foreground font-semibold text-sm">🧠 AI DIFFERENTIAL DIAGNOSIS</h3>
        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="text-xs px-3 py-1.5 rounded bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Generating..." : diagnosis ? "Regenerate" : "Generate"}
        </button>
      </div>

      {isPending && (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
          <div className="animate-pulse">AI is analyzing patient data...</div>
          <div className="text-xs mt-1">This may take 10-20 seconds</div>
        </div>
      )}

      {!diagnosis && !isPending && (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
          Click Generate to create an AI differential diagnosis for this patient.
        </div>
      )}

      {diagnosis && !isPending && (
        <div className="space-y-2">
          {diagnosis.time_sensitive && (
            <div className="bg-red-500/15 border border-red-500/40 rounded-lg p-2.5 text-xs text-red-400 flex items-center gap-2">
              <span className="animate-pulse">⚡</span>
              <span className="font-bold">TIME CRITICAL:</span>
              <span>{diagnosis.time_sensitivity_reason}</span>
            </div>
          )}

          {diagnosis.diagnoses.map((dx, i) => (
            <DiagCard
              key={dx.rank}
              dx={dx}
              expanded={expandedIdx === i}
              onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
            />
          ))}

          {diagnosis.immediate_actions.length > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mt-2">
              <div className="text-blue-400 text-xs font-bold mb-2">IMMEDIATE ACTIONS</div>
              {diagnosis.immediate_actions.map((action, i) => (
                <div key={i} className="text-blue-300 text-xs flex gap-2 mb-1">
                  <span className="text-blue-400">{i + 1}.</span>
                  <span>{action}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            <span className="text-muted-foreground text-xs">Disposition:</span>
            <span className={`text-xs font-bold px-2 py-1 rounded border ${DISPOSITION_COLORS[diagnosis.disposition_recommendation] ?? DISPOSITION_COLORS.OBSERVE}`}>
              {diagnosis.disposition_recommendation.replace("_", " ")}
            </span>
            <span className="text-muted-foreground text-xs ml-auto">Generated {new Date(diagnosis.generated_at).toLocaleTimeString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
