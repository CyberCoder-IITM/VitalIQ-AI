import { useState, useEffect } from "react";
import { useGetSepsisStatus, useCompleteBundleItem } from "@/hooks/usePhase3Api";
import type { BundleItem } from "@/hooks/usePhase3Api";

interface Props { patientId: string; }

function LiveClock({ startIso }: { startIso: string }) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    const update = () => {
      const s = Math.floor((Date.now() - new Date(startIso).getTime()) / 1000);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      setElapsed(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startIso]);
  return <span className="font-mono">{elapsed}</span>;
}

function BundleList({ items, patientId, hours }: { items: BundleItem[]; patientId: string; hours: number }) {
  const { mutate: complete, isPending } = useCompleteBundleItem();
  const overdue = items.filter(i => !i.completed && i.overdue).length;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between">
        <span className="text-foreground text-xs font-semibold">{hours}-HOUR BUNDLE</span>
        {overdue > 0 && (
          <span className="text-red-400 text-[10px] font-bold animate-pulse">OVERDUE: {overdue} items</span>
        )}
      </div>
      <div className="divide-y divide-border/30">
        {items.map((item) => (
          <div key={item.item_id}
            className={`flex items-center gap-2 px-3 py-2 text-xs ${item.overdue && !item.completed ? "bg-red-500/5" : ""}`}>
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${item.completed ? "bg-green-500 border-green-500" : item.overdue ? "border-red-500 animate-pulse" : "border-border"}`}>
              {item.completed && <span className="text-white text-[8px] font-bold">✓</span>}
            </div>
            <span className={`flex-1 ${item.completed ? "line-through text-muted-foreground/60" : item.overdue ? "text-red-300" : "text-foreground"}`}>
              {item.item}
            </span>
            {!item.completed && (
              <button onClick={() => complete({ patientId, itemId: item.item_id })}
                disabled={isPending}
                className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors shrink-0 ${item.overdue ? "bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30" : "bg-primary/15 text-primary border-primary/30 hover:bg-primary/25"}`}>
                ✓ Done
              </button>
            )}
            {item.completed && item.time_to_complete !== null && (
              <span className="text-[9px] text-muted-foreground shrink-0">+{item.time_to_complete}m</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SepsisMini({ patientId }: Props) {
  const { data } = useGetSepsisStatus(patientId, { refetchInterval: 30000 });
  if (!data?.sepsis_concern) return null;
  const done = [...(data.bundle_1hr ?? []), ...(data.bundle_3hr ?? [])].filter(i => i.completed).length;
  const total = (data.bundle_1hr?.length ?? 0) + (data.bundle_3hr?.length ?? 0);
  return (
    <div className="mt-1 pt-1 border-t border-border/30">
      <div className="text-[9px] bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5 text-amber-400 flex items-center justify-between">
        <span>🦠 SEPSIS CONCERN — qSOFA {data.qsofa_score}/3</span>
        <span>Bundle: {done}/{total} complete</span>
      </div>
    </div>
  );
}

export default function SepsisTracker({ patientId }: Props) {
  const { data: status, isLoading } = useGetSepsisStatus(patientId, { refetchInterval: 15000 });

  if (isLoading) return <div className="h-20 bg-card border border-border rounded-lg animate-pulse" />;
  if (!status || !status.sepsis_concern) return null;

  const compliance = Math.round(status.bundle_compliance * 100);
  const complianceColor = compliance >= 80 ? "text-green-400" : compliance >= 50 ? "text-amber-400" : "text-red-400";

  return (
    <div className="space-y-2">
      {/* Sepsis banner */}
      <div className={`rounded-lg border p-3 ${status.sepsis_confirmed ? "bg-red-500/15 border-red-500/50 animate-news-critical" : "bg-amber-500/10 border-amber-500/40"}`}>
        <div className={`font-bold text-sm ${status.sepsis_confirmed ? "text-red-300" : "text-amber-400"}`}>
          {status.sepsis_confirmed ? "🦠 SEPSIS CONFIRMED" : "⚠ SEPSIS CONCERN"} — qSOFA: {status.qsofa_score}/3
        </div>
        <div className="text-muted-foreground text-xs mt-0.5">
          {status.qsofa_criteria_met.join(" · ")}
        </div>
        {status.recognition_time && (
          <div className={`text-sm font-mono mt-1 ${status.sepsis_confirmed ? "text-red-400" : "text-amber-400"}`}>
            Time since recognition: <LiveClock startIso={status.recognition_time} />
          </div>
        )}
      </div>

      {/* qSOFA scorecard */}
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="text-muted-foreground text-[10px] font-semibold mb-2 uppercase">qSOFA Scorecard</div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: "RR ≥ 22", key: "respiratory_rate" },
            { label: "Altered Mentation", key: "gcs" },
            { label: "SBP ≤ 100", key: "sbp" },
          ].map((criterion, i) => {
            const met = i < status.qsofa_score;
            return (
              <div key={i} className={`rounded p-2 text-center text-xs border ${met ? "bg-red-500/15 border-red-500/40" : "bg-muted/20 border-border"}`}>
                <div className={`text-lg font-black ${met ? "text-red-400" : "text-muted-foreground/30"}`}>
                  {met ? "✓" : "✗"}
                </div>
                <div className={`text-[9px] ${met ? "text-red-300" : "text-muted-foreground"}`}>{criterion.label}</div>
              </div>
            );
          })}
        </div>
        <div className={`text-center font-black text-lg mt-2 ${status.qsofa_score >= 2 ? "text-red-400" : "text-muted-foreground"}`}>
          {status.qsofa_score}/3
        </div>
      </div>

      {/* Bundle compliance */}
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-foreground text-xs font-semibold">Bundle Compliance</span>
          <div className="flex items-center gap-1.5">
            {status.cms_penalty_risk && (
              <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/40 px-1.5 py-0.5 rounded font-bold" title="Incomplete sepsis bundle may result in CMS quality penalty">
                ⚠ CMS PENALTY RISK
              </span>
            )}
            <span className={`text-sm font-bold ${complianceColor}`}>{compliance}%</span>
          </div>
        </div>
        <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${compliance >= 80 ? "bg-green-500" : compliance >= 50 ? "bg-amber-500" : "bg-red-500"}`}
            style={{ width: `${compliance}%` }} />
        </div>
      </div>

      <BundleList items={status.bundle_1hr ?? []} patientId={patientId} hours={1} />
      <BundleList items={status.bundle_3hr ?? []} patientId={patientId} hours={3} />
    </div>
  );
}
