import { useState } from "react";
import { useGetPatientAlerts, useAcknowledgeAlert } from "@workspace/api-client-react";
import { useClinicalStore } from "@/store/clinicalStore";
import type { ClinicalAlert } from "@workspace/api-client-react";

interface Props { patientId: string; }

type Filter = "ALL" | "CRITICAL" | "DRUG" | "LAB" | "VITALS";

const SEV_L: Record<string, string> = {
  CRITICAL: "border-l-red-500 bg-red-500/5",
  URGENT: "border-l-amber-500 bg-amber-500/5",
  WARN: "border-l-yellow-500",
  INFO: "border-l-blue-500",
};
const TYPE_B: Record<string, string> = {
  DETERIORATION: "bg-red-500/20 text-red-300",
  DRUG_INTERACTION: "bg-purple-500/20 text-purple-300",
  CRITICAL_LAB: "bg-orange-500/20 text-orange-300",
  NEWS_ESCALATION: "bg-red-500/20 text-red-300",
  AI_DIAGNOSIS: "bg-blue-500/20 text-blue-300",
  ICU_THRESHOLD: "bg-red-800/30 text-red-200",
};
const TYPE_FILTER: Record<Filter, string[] | null> = {
  ALL: null, CRITICAL: null, DRUG: ["DRUG_INTERACTION"], LAB: ["CRITICAL_LAB"], VITALS: ["DETERIORATION", "NEWS_ESCALATION"],
};

function timeAgo(ts: string) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
}

export default function AlertTimeline({ patientId }: Props) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toggleAlertsDrawer } = useClinicalStore();
  const { data: alerts = [], refetch } = useGetPatientAlerts(patientId, { query: { refetchInterval: 5000, enabled: !!patientId } });
  const { mutate: ack } = useAcknowledgeAlert();

  const filtered = (alerts as ClinicalAlert[]).filter((a) => {
    if (filter === "ALL") return true;
    if (filter === "CRITICAL") return a.severity === "CRITICAL";
    return TYPE_FILTER[filter]?.includes(a.alert_type) ?? true;
  });

  const unackCount = (alerts as ClinicalAlert[]).filter((a) => !a.acknowledged).length;

  const handleAck = (alertId: string) => {
    ack({ alertId }, { onSuccess: () => refetch() });
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-foreground text-xs font-semibold">🔔 ALERTS</span>
          {unackCount > 0 && (
            <span className="bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">{unackCount}</span>
          )}
        </div>
        <button
          onClick={toggleAlertsDrawer}
          className="text-[10px] text-primary hover:text-primary/80 transition-colors"
        >
          All →
        </button>
      </div>

      <div className="px-2 pt-1.5 pb-1 flex gap-1 flex-wrap border-b border-border/50 shrink-0">
        {(["ALL", "CRITICAL", "DRUG", "LAB", "VITALS"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
              filter === f ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="overflow-y-auto max-h-72 px-1.5 py-1.5 space-y-1.5">
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground text-[10px] py-4">No alerts</div>
        )}
        {filtered.slice(0, 8).map((alert) => (
          <div
            key={alert.alert_id}
            className={`border-l-2 pl-2 pr-2 py-1.5 rounded-r cursor-pointer text-xs ${SEV_L[alert.severity] ?? "border-l-border"} ${alert.acknowledged ? "opacity-50" : ""}`}
            onClick={() => setExpandedId(expandedId === alert.alert_id ? null : alert.alert_id)}
          >
            <div className="flex items-start justify-between gap-1">
              <div className="flex-1">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className={`text-[9px] px-1 rounded font-bold ${TYPE_B[alert.alert_type] ?? "bg-muted text-muted-foreground"}`}>
                    {alert.alert_type.replace("_", " ")}
                  </span>
                  <span className="text-muted-foreground text-[9px]">{timeAgo(alert.timestamp)} ago</span>
                </div>
                <div className="text-foreground font-semibold text-[11px] leading-tight">{alert.title}</div>
                {expandedId === alert.alert_id && (
                  <div className="text-muted-foreground text-[10px] mt-0.5 leading-relaxed">{alert.body}</div>
                )}
              </div>
            </div>
            {expandedId === alert.alert_id && !alert.acknowledged && (
              <button
                onClick={(e) => { e.stopPropagation(); handleAck(alert.alert_id); }}
                className="mt-1 text-[9px] text-blue-400 border border-blue-400/30 px-1.5 py-0.5 rounded hover:bg-blue-400/10"
              >
                ✓ Acknowledge
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
