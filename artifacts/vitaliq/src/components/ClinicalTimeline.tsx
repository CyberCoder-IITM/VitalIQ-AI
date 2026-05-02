import { useState } from "react";
import { useGetTimeline } from "@/hooks/usePhase3Api";
import type { TimelineEvent } from "@/hooks/usePhase3Api";

interface Props { patientId: string; }

type Filter = "ALL" | "VITALS" | "ALERTS" | "AI" | "LABS";

const SEV_DOT: Record<string, string> = {
  INFO: "bg-blue-500", WARN: "bg-amber-500", URGENT: "bg-orange-500", CRITICAL: "bg-red-500",
};
const SEV_ROW: Record<string, string> = {
  CRITICAL: "bg-red-500/8 border-l-2 border-l-red-500",
  URGENT: "bg-orange-500/5",
};
const TYPE_BADGE: Record<string, string> = {
  NEWS2_CHANGE: "bg-cyan-500/20 text-cyan-300",
  VITALS_CHANGE: "bg-blue-500/20 text-blue-300",
  ALERT_GENERATED: "bg-red-500/20 text-red-300",
  ALERT_ACKNOWLEDGED: "bg-green-500/20 text-green-400",
  AI_DIAGNOSIS: "bg-purple-500/20 text-purple-300",
  SOAP_NOTE: "bg-indigo-500/20 text-indigo-300",
  HANDOFF: "bg-teal-500/20 text-teal-300",
  DRUG_INTERACTION: "bg-amber-500/20 text-amber-300",
  LAB_RESULT: "bg-orange-500/20 text-orange-300",
  ICU_THRESHOLD: "bg-red-800/30 text-red-200",
  DETERIORATION_EVENT: "bg-red-500/20 text-red-300",
  FORECAST_CRITICAL: "bg-red-600/20 text-red-200",
};
const FILTER_TYPES: Record<Filter, string[] | null> = {
  ALL: null,
  VITALS: ["VITALS_CHANGE", "NEWS2_CHANGE", "DETERIORATION_EVENT", "FORECAST_CRITICAL"],
  ALERTS: ["ALERT_GENERATED", "ALERT_ACKNOWLEDGED", "ICU_THRESHOLD"],
  AI: ["AI_DIAGNOSIS", "SOAP_NOTE", "HANDOFF"],
  LABS: ["LAB_RESULT", "DRUG_INTERACTION"],
};

function timeAgo(ts: string) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return `${Math.round(s)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

function snapshotSummary(event: TimelineEvent): string {
  const ds = event.data_snapshot;
  if (event.event_type === "NEWS2_CHANGE") return `NEWS2: ${ds.previous}→${ds.current} (${ds.change > 0 ? "+" : ""}${ds.change} pts)`;
  if (event.event_type === "AI_DIAGNOSIS") return ds.top_diagnosis ? `Top: ${ds.top_diagnosis}` : "";
  if (event.event_type === "FORECAST_CRITICAL") return `Window: ${ds.intervention_window} | NEWS2: ${ds.news2}`;
  return Object.entries(ds).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(" | ");
}

export default function ClinicalTimeline({ patientId }: Props) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: events = [], isLoading } = useGetTimeline(patientId, { refetchInterval: 10000 });

  const filtered = filter === "ALL"
    ? (events as TimelineEvent[])
    : (events as TimelineEvent[]).filter(e => FILTER_TYPES[filter]?.includes(e.event_type) ?? true);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-foreground font-semibold text-sm">📅 CLINICAL DECISION TIMELINE</h3>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">{(events as TimelineEvent[]).length} events</span>
          <button onClick={() => window.print()}
            className="text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors">
            🖨 Export
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {(["ALL", "VITALS", "ALERTS", "AI", "LABS"] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-[10px] px-2 py-1 rounded transition-colors ${filter === f ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground border border-transparent"}`}>
            {f}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 bg-card border border-border rounded animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center text-muted-foreground text-xs py-12 bg-card border border-border rounded-lg">
          No events recorded yet. Events are auto-generated as the patient's condition changes.
        </div>
      )}

      <div className="relative">
        {/* Vertical line */}
        {filtered.length > 0 && (
          <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
        )}

        <div className="space-y-1">
          {filtered.map((event) => {
            const isCrit = event.severity === "CRITICAL";
            const snapshot = snapshotSummary(event);
            return (
              <div key={event.event_id}
                className={`flex gap-3 py-2 px-2 rounded-r cursor-pointer hover:bg-muted/10 transition-colors ${SEV_ROW[event.severity] ?? ""} ${isCrit ? "text-base" : ""}`}
                onClick={() => setExpandedId(expandedId === event.event_id ? null : event.event_id)}>
                {/* Dot */}
                <div className="shrink-0 mt-1.5 relative z-10">
                  <div className={`w-2.5 h-2.5 rounded-full ${SEV_DOT[event.severity] ?? "bg-border"} ${isCrit ? "ring-2 ring-red-500/30" : ""}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${TYPE_BADGE[event.event_type] ?? "bg-muted text-muted-foreground"}`}>
                      {event.event_type.replace(/_/g, " ")}
                    </span>
                    <span className="text-muted-foreground text-[9px]">{new Date(event.timestamp).toLocaleTimeString()}</span>
                    <span className="text-muted-foreground/50 text-[9px]">{timeAgo(event.timestamp)}</span>
                    <span className="text-muted-foreground/40 text-[9px] ml-auto">{event.triggered_by}</span>
                  </div>
                  <div className={`text-[11px] font-semibold ${isCrit ? "text-red-300" : "text-foreground"}`}>{event.title}</div>
                  <div className="text-muted-foreground text-[10px] leading-relaxed">{event.detail}</div>

                  {expandedId === event.event_id && snapshot && (
                    <div className="mt-1 bg-muted/20 border border-border/50 rounded px-2 py-1 text-[10px] text-cyan-300 font-mono">
                      {snapshot}
                    </div>
                  )}
                </div>

                {/* Severity badge */}
                <span className={`text-[9px] font-bold shrink-0 self-start mt-1 px-1 py-0.5 rounded ${SEV_DOT[event.severity] ? `bg-${event.severity === "CRITICAL" ? "red" : event.severity === "URGENT" ? "orange" : event.severity === "WARN" ? "amber" : "blue"}-500/20 text-${event.severity === "CRITICAL" ? "red" : event.severity === "URGENT" ? "orange" : event.severity === "WARN" ? "amber" : "blue"}-300` : "bg-muted text-muted-foreground"}`}>
                  {event.severity}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
