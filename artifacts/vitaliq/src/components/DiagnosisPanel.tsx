import { useState } from "react";
import { useGenerateDiagnosis } from "@workspace/api-client-react";
import type { DifferentialDiagnosis, DiagnosisItem } from "@workspace/api-client-react";

interface Props { patientId: string; }

const DISPOSITION: Record<string, { bg: string; text: string; label: string }> = {
  DISCHARGE: { bg: "bg-green-500/15 border-green-500/40", text: "text-green-400", label: "✓ DISCHARGE — Patient stable for home" },
  OBSERVE: { bg: "bg-blue-500/15 border-blue-500/40", text: "text-blue-400", label: "👁 OBSERVE — Monitor 4–6 hours" },
  ADMIT_FLOOR: { bg: "bg-amber-500/15 border-amber-500/40", text: "text-amber-400", label: "🏥 ADMIT TO FLOOR" },
  ADMIT_ICU: { bg: "bg-red-500/15 border-red-500/40", text: "text-red-400", label: "🚨 ADMIT TO ICU — Critical" },
  OR: { bg: "bg-red-900/30 border-red-700/60", text: "text-red-300", label: "⚡ OR EMERGENT — Activate surgical team" },
};

function DiagCard({ dx, expanded, onToggle }: { dx: DiagnosisItem; expanded: boolean; onToggle: () => void }) {
  const [checkedActions, setCheckedActions] = useState<Record<number, boolean>>({});
  const probColor =
    dx.probability === "HIGH" ? "border-red-500/40 bg-red-500/10 text-red-400"
    : dx.probability === "MEDIUM" ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
    : "border-border bg-muted/20 text-muted-foreground";
  const circleColor = dx.probability === "HIGH" ? "#f44336" : dx.probability === "MEDIUM" ? "#ff9800" : "#546e7a";
  const barPct = `${dx.probability_percent}%`;

  return (
    <div className="bg-background border border-border rounded-lg overflow-hidden">
      <div className="p-3 cursor-pointer hover:bg-muted/10" onClick={onToggle}>
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black border-2 text-white"
            style={{ background: circleColor, borderColor: circleColor }}>
            {dx.rank}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-foreground font-bold text-sm">{dx.diagnosis}</span>
              <span className="text-[10px] font-mono bg-muted/30 px-1.5 py-0.5 rounded text-muted-foreground">{dx.icd10_code}</span>
            </div>
            <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: barPct, background: circleColor }} />
            </div>
          </div>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${probColor}`}>
            {dx.probability} {dx.probability_percent}%
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-3 pb-3 pt-2 grid grid-cols-2 gap-3 text-xs">
          {dx.supporting_evidence.length > 0 && (
            <div>
              <div className="text-green-400 font-semibold mb-1">✓ Supporting Evidence</div>
              {dx.supporting_evidence.map((e, i) => <div key={i} className="text-foreground/80 flex gap-1"><span className="text-green-400">·</span>{e}</div>)}
            </div>
          )}
          {dx.against_evidence.length > 0 && (
            <div>
              <div className="text-red-400 font-semibold mb-1">✗ Against</div>
              {dx.against_evidence.map((e, i) => <div key={i} className="text-foreground/80 flex gap-1"><span className="text-red-400">·</span>{e}</div>)}
            </div>
          )}
          {dx.immediate_workup.length > 0 && (
            <div>
              <div className="text-blue-400 font-semibold mb-1">🔬 Immediate Workup</div>
              {dx.immediate_workup.map((e, i) => (
                <div key={i} className="flex items-start gap-1.5 mb-0.5">
                  <input type="checkbox" checked={!!checkedActions[i]} onChange={() => setCheckedActions(p => ({...p, [i]: !p[i]}))}
                    className="mt-0.5 accent-blue-400 shrink-0" />
                  <span className={checkedActions[i] ? "line-through text-muted-foreground" : "text-foreground/80"}>{e}</span>
                </div>
              ))}
            </div>
          )}
          {dx.red_flags.length > 0 && (
            <div>
              <div className="text-amber-400 font-semibold mb-1">⚠ Red Flags</div>
              {dx.red_flags.map((e, i) => <div key={i} className="text-amber-300/80 flex gap-1"><span>·</span>{e}</div>)}
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
    generate({ patientId }, { onSuccess: (d: any) => setDiagnosis(d) });
  };

  const disp = diagnosis ? (DISPOSITION[diagnosis.disposition_recommendation] ?? DISPOSITION.OBSERVE) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-foreground font-semibold text-sm">🧠 AI DIFFERENTIAL DIAGNOSIS</h3>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-[10px]">Powered by Gemini AI</span>
          {diagnosis && <span className="text-muted-foreground text-[10px]">{new Date(diagnosis.generated_at).toLocaleTimeString()}</span>}
          <button onClick={handleGenerate} disabled={isPending}
            className="text-xs px-3 py-1.5 rounded bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 disabled:opacity-50 transition-colors">
            {isPending ? "Analyzing..." : diagnosis ? "🔄 Regenerate" : "Generate"}
          </button>
        </div>
      </div>

      {isPending && (
        <div className="space-y-3">
          {["Reviewing vitals...", "Analyzing labs...", "Generating differential..."].map((msg, i) => (
            <div key={i} className="h-12 bg-card border border-border rounded-lg animate-pulse flex items-center px-4">
              <span className="text-muted-foreground text-xs animate-pulse">{msg}</span>
            </div>
          ))}
        </div>
      )}

      {!diagnosis && !isPending && (
        <div className="bg-card border border-border rounded-lg p-10 text-center text-muted-foreground text-sm">
          Click Generate to create an AI differential diagnosis for this patient.
        </div>
      )}

      {diagnosis && !isPending && (
        <div className="space-y-3">
          {/* Disposition banner */}
          {disp && (
            <div className={`w-full p-3 rounded-lg border ${disp.bg}`}>
              <div className={`font-bold text-sm ${disp.text}`}>{disp.label}</div>
              {diagnosis.time_sensitive && (
                <div className="text-red-400 text-xs mt-1 animate-pulse font-semibold">
                  ⚡ TIME CRITICAL: {diagnosis.time_sensitivity_reason}
                </div>
              )}
            </div>
          )}

          {/* Immediate actions */}
          {diagnosis.immediate_actions.length > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <div className="text-blue-400 text-xs font-bold mb-2">IMMEDIATE ACTIONS</div>
              {diagnosis.immediate_actions.map((a, i) => (
                <div key={i} className="text-blue-300 text-xs flex gap-1.5 mb-0.5">
                  <span className="text-blue-400 shrink-0">{i+1}.</span>{a}
                </div>
              ))}
            </div>
          )}

          {/* Diagnosis cards */}
          {diagnosis.diagnoses.map((dx, i) => (
            <DiagCard key={dx.rank} dx={dx} expanded={expandedIdx === i} onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)} />
          ))}

          <div className="text-muted-foreground text-[10px] text-center pt-1">
            AI-generated differential for clinical reference only. Always apply clinical judgment. Not FDA approved.
          </div>
        </div>
      )}
    </div>
  );
}
