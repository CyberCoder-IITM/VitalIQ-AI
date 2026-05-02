import { useState } from "react";
import { useGetPatientAlerts, useAcknowledgeAlert } from "@workspace/api-client-react";
import type { ClinicalAlert } from "@workspace/api-client-react";

interface Props { patientId: string; }

type FilterType = "ALL" | "CRITICAL" | "DRUG" | "LAB" | "DETERIORATION";

const SEV_COLORS: Record<string, string> = {
  CRITICAL: "border-l-red-500 bg-red-500/5",
  URGENT: "border-l-amber-500 bg-amber-500/5",
  WARN: "border-l-yellow-500 bg-yellow-500/5",
  INFO: "border-l-blue-500 bg-blue-500/5",
};
const SEV_TEXT: Record<string, string> = {
  CRITICAL: "text-red-400",
  URGENT: "text-amber-400",
  WARN: "text-yellow-400",
  INFO: "text-blue-400",
};
const TYPE_BADGES: Record<string, string> = {
  DETERIORATION: "bg-red-500/20 text-red-300",
  DRUG_INTERACTION: "bg-amber-500/20 text-amber-300",
  CRITICAL_LAB: "bg-purple-500/20 text-purple-300",
  NEWS_ESCALATION: "bg-orange-500/20 text-orange-300",
  AI_DIAGNOSIS: "bg-blue-500/20 text-blue-300",
  ICU_THRESHOLD: "bg-red-500/20 text-red-300",
};

function timeAgo(ts: string) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
}

export default function AlertTimeline({ patientId }: Props) {
  const [filter, setFilter] = useState<FilterType>("ALL");
  const { data: alerts = [], refetch } = useGetPatientAlerts(patientId, { query: { refetchInterval: 5000, enabled: !!patientId } });
  const { mutate: ackAlert } = useAcknowledgeAlert();

  const filterMap: Record<FilterType, string[] | null> = {
    ALL: null,
    CRITICAL: null, // handled below
    DRUG: ["DRUG_INTERACTION"],
    LAB: ["CRITICAL_LAB"],
    DETERIORATION: ["DETERIORATION", "NEWS_ESCALATION"],
  };

  const filtered = (alerts as ClinicalAlert[]).filter((a) => {
    if (filter === "ALL") return true;
    if (filter === "CRITICAL") return a.severity === "CRITICAL";
    return filterMap[filter]?.includes(a.alert_type) ?? true;
  });

  const handleAck = (alertId: string) => {
    ackAlert({ alertId }, {
      onSuccess: () => refetch(),
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border">
        <div className="text-foreground text-xs font-semibold mb-2">ALERT TIMELINE</div>
        <div className="flex gap-1 flex-wrap">
          {(["ALL", "CRITICAL", "DRUG", "LAB", "DETERIORATION"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                filter === f
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground text-xs py-6">No alerts</div>
        )}
        {filtered.map((alert) => (
          <div
            key={alert.alert_id}
            className={`border-l-2 pl-2 pr-2 py-1.5 rounded-r text-xs ${SEV_COLORS[alert.severity] ?? "border-l-border"} ${alert.acknowledged ? "opacity-50" : ""}`}
          >
            <div className="flex items-start justify-between gap-1">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${TYPE_BADGES[alert.alert_type] ?? ""}`}>
                    {alert.alert_type.replace("_", " ")}
                  </span>
                  <span className={`text-[9px] font-semibold ${SEV_TEXT[alert.severity] ?? ""}`}>{alert.severity}</span>
                </div>
                <div className="text-foreground font-semibold leading-tight text-[11px]">{alert.title}</div>
                <div className="text-muted-foreground text-[10px] mt-0.5 leading-relaxed line-clamp-2">{alert.body}</div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-muted-foreground text-[9px]">{timeAgo(alert.timestamp)}</span>
              {!alert.acknowledged && (
                <button
                  onClick={() => handleAck(alert.alert_id)}
                  className="text-[9px] text-muted-foreground hover:text-foreground border border-border px-1.5 py-0.5 rounded transition-colors"
                >
                  Ack
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
