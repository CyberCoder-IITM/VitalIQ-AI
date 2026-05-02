import { useGetLatestTriage } from "@workspace/api-client-react";

export default function TriageAgent() {
  const { data: triage, dataUpdatedAt } = useGetLatestTriage({ query: { refetchInterval: 15000 } });

  const secondsAgo = dataUpdatedAt ? Math.round((Date.now() - dataUpdatedAt) / 1000) : null;

  const deptColors: Record<string, string> = {
    CONTROLLED: "text-green-400 border-green-400/30 bg-green-400/10",
    BUSY: "text-amber-400 border-amber-400/30 bg-amber-400/10",
    CRITICAL_LOAD: "text-red-400 border-red-400/30 bg-red-400/10",
  };

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-foreground text-xs font-semibold">🤖 AI TRIAGE</span>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        </div>
        {secondsAgo !== null && (
          <span className="text-muted-foreground text-[10px]">{secondsAgo}s ago</span>
        )}
      </div>

      {!triage && (
        <div className="text-muted-foreground text-xs text-center py-3 animate-pulse">Initializing...</div>
      )}

      {triage && (
        <>
          {/* Physician Focus */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 mb-2">
            <div className="text-red-400 text-[10px] font-bold mb-1">PHYSICIAN FOCUS NOW</div>
            <div className="text-foreground text-xs font-semibold">{triage.physician_focus.name}</div>
            <div className="text-red-300 text-[10px]">{triage.physician_focus.reason}</div>
            <div className="text-muted-foreground text-[10px] mt-0.5">{triage.physician_focus.specific_concern}</div>
          </div>

          {/* Dept status */}
          <div className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-block mb-2 ${deptColors[triage.department_status] ?? deptColors.CONTROLLED}`}>
            {triage.department_status.replace("_", " ")}
          </div>

          {/* Priority list */}
          <div className="space-y-1">
            {triage.priority_ranking.slice(0, 5).map((item) => (
              <div key={item.patient_id} className="flex items-start gap-1.5 text-[10px]">
                <span className={`font-bold w-4 shrink-0 ${item.rank <= 2 ? "text-red-400" : item.rank <= 4 ? "text-amber-400" : "text-muted-foreground"}`}>
                  #{item.rank}
                </span>
                <div className="min-w-0">
                  <span className="text-foreground font-medium">{item.name}</span>
                  <span className="text-muted-foreground"> · {item.time_to_act_minutes}m</span>
                  <div className="text-muted-foreground truncate">{item.urgency_reason}</div>
                </div>
              </div>
            ))}
          </div>

          {triage.cycle_summary && (
            <div className="mt-2 text-[10px] text-muted-foreground border-t border-border pt-2">
              {triage.cycle_summary}
            </div>
          )}
        </>
      )}
    </div>
  );
}
