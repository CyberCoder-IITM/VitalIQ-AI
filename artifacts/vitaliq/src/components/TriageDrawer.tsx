import { useEffect, useState } from "react";
import { useGetLatestTriage } from "@workspace/api-client-react";
import { useClinicalStore } from "@/store/clinicalStore";
import { useLocation } from "wouter";

interface Props { currentPatientId?: string; }

const RANK_COLORS: Record<number, string> = { 1: "text-red-400", 2: "text-orange-400", 3: "text-amber-400" };

export default function TriageDrawer({ currentPatientId }: Props) {
  const { closeTriageDrawer } = useClinicalStore();
  const { data: triage, dataUpdatedAt } = useGetLatestTriage({ query: { refetchInterval: 15000 } });
  const [, navigate] = useLocation();
  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 15 : c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [dataUpdatedAt]);

  const deptColors: Record<string, string> = {
    CONTROLLED: "text-green-400 border-green-400/30 bg-green-400/10",
    BUSY: "text-amber-400 border-amber-400/30 bg-amber-400/10",
    CRITICAL_LOAD: "text-red-400 border-red-400/30 bg-red-400/10 animate-pulse",
  };

  const timeColor = (min: number) =>
    min < 5 ? "bg-red-500/20 text-red-400 border-red-500/30"
    : min < 15 ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
    : "bg-green-500/20 text-green-400 border-green-500/30";

  const handlePatientClick = (patientId: string) => {
    closeTriageDrawer();
    navigate(`/patient/${patientId}`);
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="flex-1 bg-black/40" onClick={closeTriageDrawer} />
      <div className="animate-drawer-right w-[440px] bg-card border-l-2 border-primary/40 flex flex-col h-full shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-foreground font-semibold text-sm">🤖 AI TRIAGE AGENT</span>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-blue-400 text-[10px]">ANALYZING</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-[10px]">Next in {countdown}s</span>
            <button onClick={closeTriageDrawer} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!triage ? (
            <div className="text-center text-muted-foreground text-xs py-8 animate-pulse">Initializing triage agent...</div>
          ) : (
            <>
              {/* Department status */}
              <div className="text-center">
                <span className={`text-sm font-bold px-3 py-1.5 rounded-full border inline-block ${deptColors[triage.department_status] ?? deptColors.CONTROLLED}`}>
                  {triage.department_status.replace("_", " ")}
                </span>
                {triage.cycle_summary && (
                  <p className="text-muted-foreground text-xs mt-2 italic">{triage.cycle_summary}</p>
                )}
              </div>

              {/* Physician focus */}
              {triage.physician_focus && (
                <div className="border border-red-500/40 bg-red-500/10 rounded-lg p-3">
                  <div className="text-red-400 text-[10px] font-bold mb-1">⚠ IMMEDIATE ATTENTION REQUIRED</div>
                  <div className="text-foreground font-bold text-sm">{triage.physician_focus.name}</div>
                  <div className="text-red-300 text-xs mt-0.5">{triage.physician_focus.reason}</div>
                  {triage.physician_focus.specific_concern && (
                    <div className="text-muted-foreground text-[10px] mt-1">{triage.physician_focus.specific_concern}</div>
                  )}
                </div>
              )}

              {/* Priority ranking */}
              <div>
                <div className="text-muted-foreground text-[10px] font-semibold mb-2 uppercase tracking-wider">Priority Ranking</div>
                <div className="space-y-1.5">
                  {(triage.priority_ranking ?? []).map((item: any) => (
                    <div
                      key={item.patient_id}
                      onClick={() => handlePatientClick(item.patient_id)}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/20 transition-colors ${
                        item.patient_id === currentPatientId ? "bg-primary/10 border border-primary/20" : ""
                      }`}
                    >
                      <span className={`text-sm font-black w-6 text-center shrink-0 ${RANK_COLORS[item.rank] ?? "text-muted-foreground"}`}>
                        #{item.rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-foreground text-xs font-semibold">{item.name}</span>
                          <span className="text-muted-foreground text-[10px]">{item.bed}</span>
                          {item.patient_id === currentPatientId && (
                            <span className="text-[9px] bg-primary/20 text-primary px-1 rounded">current</span>
                          )}
                        </div>
                        <div className="text-muted-foreground text-[10px] truncate">{item.urgency_reason}</div>
                      </div>
                      <span className={`text-[10px] font-medium border px-1.5 py-0.5 rounded shrink-0 ${timeColor(item.time_to_act_minutes)}`}>
                        {item.time_to_act_minutes}m
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
