import { useGetLatestTriage } from "@workspace/api-client-react";
import { useClinicalStore } from "@/store/clinicalStore";

interface Props { patientId?: string; compact?: boolean; }

export default function TriageAgent({ patientId, compact }: Props) {
  const { data: triage } = useGetLatestTriage({ query: { refetchInterval: 15000 } });
  const { toggleTriageDrawer } = useClinicalStore();

  const deptColors: Record<string, string> = {
    CONTROLLED: "text-green-400 border-green-400/30 bg-green-400/10",
    BUSY: "text-amber-400 border-amber-400/30 bg-amber-400/10",
    CRITICAL_LOAD: "text-red-400 border-red-400/30 bg-red-400/10",
  };

  const thisPatientRank = patientId
    ? (triage?.priority_ranking ?? []).find((r: any) => r.patient_id === patientId)
    : null;
  const isFocus = triage?.physician_focus?.name && patientId
    ? (triage.priority_ranking ?? []).find((r: any) => r.patient_id === patientId)?.rank === 1
    : false;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-foreground text-xs font-semibold">🤖 AI TRIAGE</span>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        </div>
        <button onClick={toggleTriageDrawer} className="text-[10px] text-primary hover:text-primary/80 transition-colors">
          Full →
        </button>
      </div>

      <div className="p-3 space-y-2">
        {!triage ? (
          <div className="text-muted-foreground text-xs animate-pulse text-center py-3">Initializing...</div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${deptColors[triage.department_status] ?? deptColors.CONTROLLED}`}>
                {triage.department_status.replace("_", " ")}
              </span>
            </div>

            {/* This patient's rank */}
            {thisPatientRank && (
              <div className={`p-2 rounded border text-xs ${isFocus ? "bg-red-500/10 border-red-500/40" : "bg-muted/20 border-border"}`}>
                <div className="flex items-center gap-1.5">
                  <span className={`font-black text-lg ${thisPatientRank.rank <= 2 ? "text-red-400" : thisPatientRank.rank <= 4 ? "text-amber-400" : "text-muted-foreground"}`}>
                    #{thisPatientRank.rank}
                  </span>
                  <div>
                    <div className="text-foreground font-semibold text-[11px]">of 8 patients</div>
                    <div className="text-muted-foreground text-[9px]">Act within {thisPatientRank.time_to_act_minutes}m</div>
                  </div>
                </div>
                {thisPatientRank.urgency_reason && (
                  <div className="text-muted-foreground text-[10px] mt-1">{thisPatientRank.urgency_reason}</div>
                )}
              </div>
            )}

            {/* Physician focus (if this is the focus patient) */}
            {isFocus && triage.physician_focus && (
              <div className="bg-red-500/10 border border-red-500/30 rounded p-1.5 text-[10px]">
                <span className="text-red-400 font-bold">⚠ PHYSICIAN FOCUS: </span>
                <span className="text-red-300">{triage.physician_focus.specific_concern}</span>
              </div>
            )}

            {/* Top 3 priority if no patient context */}
            {!thisPatientRank && (
              <div className="space-y-1">
                {(triage.priority_ranking ?? []).slice(0, 4).map((item: any) => (
                  <div key={item.patient_id} className="flex items-center gap-1.5 text-[10px]">
                    <span className={`font-bold w-5 text-center ${item.rank <= 2 ? "text-red-400" : item.rank <= 4 ? "text-amber-400" : "text-muted-foreground"}`}>
                      #{item.rank}
                    </span>
                    <span className="text-foreground font-medium truncate">{item.name}</span>
                    <span className="text-muted-foreground ml-auto shrink-0">{item.time_to_act_minutes}m</span>
                  </div>
                ))}
              </div>
            )}

            {triage.cycle_summary && (
              <div className="text-[10px] text-muted-foreground border-t border-border pt-1.5 line-clamp-2 italic">
                {triage.cycle_summary}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
