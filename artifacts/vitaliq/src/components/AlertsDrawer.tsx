import { useGetAllAlerts, useAcknowledgeAlert } from "@workspace/api-client-react";
import { useClinicalStore } from "@/store/clinicalStore";
import type { ClinicalAlert } from "@workspace/api-client-react";

const SEV_BORDER: Record<string, string> = {
  CRITICAL: "border-l-red-500 bg-red-500/5",
  URGENT: "border-l-amber-500 bg-amber-500/5",
  WARN: "border-l-yellow-500 bg-yellow-500/5",
  INFO: "border-l-blue-500 bg-blue-500/5",
};
const TYPE_BADGE: Record<string, string> = {
  DETERIORATION: "bg-red-500/20 text-red-300",
  DRUG_INTERACTION: "bg-purple-500/20 text-purple-300",
  CRITICAL_LAB: "bg-orange-500/20 text-orange-300",
  NEWS_ESCALATION: "bg-red-500/20 text-red-300",
  AI_DIAGNOSIS: "bg-blue-500/20 text-blue-300",
  ICU_THRESHOLD: "bg-red-800/30 text-red-200",
};

function timeAgo(ts: string) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return `${Math.round(s)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

export default function AlertsDrawer() {
  const { closeAlertsDrawer } = useClinicalStore();
  const { data: alerts = [], refetch } = useGetAllAlerts({ query: { refetchInterval: 5000 } });
  const { mutate: ack } = useAcknowledgeAlert();

  const handleAck = (alertId: string) => {
    ack({ alertId }, { onSuccess: () => refetch() });
  };

  const handleAckAll = () => {
    (alerts as ClinicalAlert[])
      .filter((a) => !a.acknowledged)
      .forEach((a) => ack({ alertId: a.alert_id }, { onSuccess: () => refetch() }));
  };

  // Group by patient
  const grouped: Record<string, ClinicalAlert[]> = {};
  (alerts as ClinicalAlert[]).forEach((a) => {
    const pid = a.patient_id;
    if (!grouped[pid]) grouped[pid] = [];
    grouped[pid].push(a);
  });

  const unackCount = (alerts as ClinicalAlert[]).filter((a) => !a.acknowledged).length;

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="animate-drawer-left w-[440px] bg-card border-r-2 border-primary/40 flex flex-col h-full shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div>
            <span className="text-foreground font-semibold text-sm">🔔 ALL ALERTS</span>
            {unackCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5">{unackCount}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unackCount > 0 && (
              <button
                onClick={handleAckAll}
                className="text-xs text-blue-400 border border-blue-400/30 px-2 py-0.5 rounded hover:bg-blue-400/10 transition-colors"
              >
                Ack All
              </button>
            )}
            <button onClick={closeAlertsDrawer} className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {Object.entries(grouped).map(([patientId, patientAlerts]) => {
            const unack = patientAlerts.filter((a) => !a.acknowledged).length;
            const first = patientAlerts[0];
            return (
              <div key={patientId} className="border-b border-border/50">
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/10">
                  <span className="text-foreground text-xs font-semibold">{(first as any).patient_name ?? patientId}</span>
                  <span className="text-muted-foreground text-[10px]">{(first as any).bed}</span>
                  {unack > 0 && (
                    <span className="bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">{unack}</span>
                  )}
                </div>
                {patientAlerts.map((alert) => (
                  <div
                    key={alert.alert_id}
                    className={`border-l-2 px-3 py-2 mx-2 my-1 rounded-r text-xs ${SEV_BORDER[alert.severity] ?? ""} ${alert.acknowledged ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex-1">
                        <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                          <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${TYPE_BADGE[alert.alert_type] ?? "bg-muted text-muted-foreground"}`}>
                            {alert.alert_type.replace("_", " ")}
                          </span>
                          <span className="text-muted-foreground text-[9px]">{timeAgo(alert.timestamp)}</span>
                        </div>
                        <div className="text-foreground font-semibold text-[11px]">{alert.title}</div>
                        <div className="text-muted-foreground text-[10px] mt-0.5 line-clamp-2">{alert.body}</div>
                      </div>
                    </div>
                    {!alert.acknowledged && (
                      <button
                        onClick={() => handleAck(alert.alert_id)}
                        className="mt-1 text-[9px] text-blue-400 border border-blue-400/30 px-1.5 py-0.5 rounded hover:bg-blue-400/10 transition-colors"
                      >
                        ✓ Acknowledge
                      </button>
                    )}
                    {alert.acknowledged && (
                      <span className="mt-1 text-[9px] text-muted-foreground/60">✓ Acknowledged</span>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
          {(alerts as ClinicalAlert[]).length === 0 && (
            <div className="text-center text-muted-foreground text-xs py-12">No alerts</div>
          )}
        </div>
      </div>
      <div className="flex-1 bg-black/40" onClick={closeAlertsDrawer} />
    </div>
  );
}
