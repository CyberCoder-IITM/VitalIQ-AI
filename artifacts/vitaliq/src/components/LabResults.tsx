import { useState } from "react";
import { useGetLabResults } from "@workspace/api-client-react";
import type { LabResult } from "@workspace/api-client-react";
import { LineChart, Line, ReferenceLine, ResponsiveContainer } from "recharts";

interface Props { patientId: string; compact?: boolean; }

const STATUS_COLOR: Record<string, string> = {
  NORMAL: "text-foreground", LOW: "text-blue-400", HIGH: "text-amber-400",
  CRITICAL_LOW: "text-red-400 font-black animate-cardiac-pulse",
  CRITICAL_HIGH: "text-red-400 font-black animate-cardiac-pulse",
};
const STATUS_ROW: Record<string, string> = {
  CRITICAL_LOW: "bg-red-500/8 border-l-2 border-l-red-500",
  CRITICAL_HIGH: "bg-red-500/8 border-l-2 border-l-red-500",
};
const STATUS_LABEL: Record<string, string> = {
  NORMAL: "NORMAL", LOW: "LOW ↓", HIGH: "HIGH ↑",
  CRITICAL_LOW: "CRIT LOW ↓↓", CRITICAL_HIGH: "CRIT HIGH ↑↑",
};

type PanelId = "METABOLIC" | "CBC" | "CARDIAC" | "COAG" | "ABG";
const PANELS: PanelId[] = ["CARDIAC", "CBC", "METABOLIC", "COAG", "ABG"];
const PANEL_KEYWORDS: Record<PanelId, string[]> = {
  CARDIAC: ["Troponin", "CK-MB", "BNP", "Digoxin", "Lactic"],
  CBC: ["WBC", "Hgb", "Hemoglobin", "PLT", "HbA1c"],
  METABOLIC: ["Glucose", "Na", "Sodium", "K+", "Creatinine", "BUN", "Bicarbonate", "Calcium", "Phosphorus", "Magnesium", "Ammonia", "Albumin", "eGFR"],
  COAG: ["INR", "PT", "PTT", "Fibrinogen", "D-dimer"],
  ABG: ["ABG", "pH", "pCO2", "pO2", "HCO3"],
};

function getPanel(name: string): PanelId {
  for (const [panel, keys] of Object.entries(PANEL_KEYWORDS)) {
    if (keys.some((k) => name.includes(k))) return panel as PanelId;
  }
  return "METABOLIC";
}

function timeAgo(ts: string) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
}

const KEY_LABS = ["Troponin", "WBC", "Creatinine", "K+", "Glucose", "INR", "BNP"];

export default function LabResults({ patientId, compact }: Props) {
  const [activePanel, setActivePanel] = useState<PanelId>("CARDIAC");
  const { data: labs = [], isLoading } = useGetLabResults(patientId, { query: { staleTime: 30000, enabled: !!patientId } });

  const criticalCount = (labs as LabResult[]).filter((l) => l.status === "CRITICAL_HIGH" || l.status === "CRITICAL_LOW").length;

  if (isLoading) return <div className="h-24 bg-card border border-border rounded-lg animate-pulse" />;

  if (compact) {
    const keyLabs = (labs as LabResult[]).filter((l) => KEY_LABS.some((k) => l.test_name.includes(k)));
    return (
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-foreground text-xs font-semibold">🔬 LABS</span>
            {criticalCount > 0 && (
              <span className="bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 animate-pulse">{criticalCount} CRITICAL</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto px-2 py-2 scrollbar-none">
          {keyLabs.slice(0, 8).map((lab, i) => {
            const isCrit = lab.status === "CRITICAL_HIGH" || lab.status === "CRITICAL_LOW";
            return (
              <div key={i} className={`shrink-0 rounded px-2 py-1.5 text-center border min-w-[68px] ${isCrit ? "bg-red-500/10 border-red-500/30" : "bg-muted/20 border-border"}`}>
                <div className={`font-bold text-xs font-mono ${STATUS_COLOR[lab.status] ?? "text-foreground"}`}>
                  {lab.value}
                  <span className="text-[9px] font-normal text-muted-foreground ml-0.5">{lab.unit}</span>
                </div>
                <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{lab.test_name}</div>
                <div className={`text-[9px] ${STATUS_COLOR[lab.status] ?? ""}`}>{STATUS_LABEL[lab.status]}</div>
              </div>
            );
          })}
          {keyLabs.length === 0 && <div className="text-muted-foreground text-xs py-2 px-1">No key labs available</div>}
        </div>
      </div>
    );
  }

  const grouped: Record<string, LabResult[]> = {};
  (labs as LabResult[]).forEach((l) => {
    const p = getPanel(l.test_name);
    if (!grouped[p]) grouped[p] = [];
    grouped[p].push(l);
  });

  const panelLabs = grouped[activePanel] ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-foreground font-semibold text-sm">LABORATORY RESULTS</h3>
        {criticalCount > 0 && (
          <span className="bg-red-500/20 text-red-400 border border-red-500/40 text-xs font-bold px-2 py-0.5 rounded animate-pulse">
            {criticalCount} CRITICAL
          </span>
        )}
      </div>

      <div className="flex gap-0 border border-border rounded-lg overflow-hidden mb-3">
        {PANELS.map((p) => (
          <button key={p} onClick={() => setActivePanel(p)}
            className={`flex-1 px-2 py-1.5 text-[10px] font-semibold border-r border-border last:border-r-0 transition-colors ${
              activePanel === p ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}>
            {p} {grouped[p]?.filter((l) => l.status === "CRITICAL_HIGH" || l.status === "CRITICAL_LOW").length > 0 && "🔴"}
          </button>
        ))}
      </div>

      {panelLabs.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-6 text-center text-muted-foreground text-xs">
          No {activePanel} labs available
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/10">
                <th className="text-left px-3 py-2 text-muted-foreground font-normal">Test</th>
                <th className="text-center py-2 text-muted-foreground font-normal">Result</th>
                <th className="text-center py-2 text-muted-foreground font-normal">Reference</th>
                <th className="text-center py-2 text-muted-foreground font-normal">Status</th>
                <th className="text-center py-2 text-muted-foreground font-normal">Δ</th>
                <th className="text-center pr-3 py-2 text-muted-foreground font-normal">Time</th>
              </tr>
            </thead>
            <tbody>
              {panelLabs.map((lab, i) => {
                const isCrit = lab.status === "CRITICAL_HIGH" || lab.status === "CRITICAL_LOW";
                return (
                  <tr key={i} className={`border-b border-border/30 last:border-0 ${STATUS_ROW[lab.status] ?? ""}`}>
                    <td className="px-3 py-1.5">
                      {isCrit && <span className="text-red-400 mr-1">!</span>}
                      <span className="text-foreground">{lab.test_name}</span>
                    </td>
                    <td className={`py-1.5 text-center font-mono font-semibold ${STATUS_COLOR[lab.status] ?? ""}`}>
                      {lab.value} <span className="text-muted-foreground font-normal text-[10px]">{lab.unit}</span>
                    </td>
                    <td className="py-1.5 text-center text-muted-foreground text-[10px]">
                      {lab.reference_low}–{lab.reference_high}
                    </td>
                    <td className={`py-1.5 text-center text-[10px] font-semibold ${STATUS_COLOR[lab.status] ?? ""}`}>
                      {STATUS_LABEL[lab.status] ?? lab.status}
                    </td>
                    <td className="py-1.5 text-center text-[10px]">
                      {lab.delta != null
                        ? <span className={lab.delta > 0 ? "text-amber-400" : "text-blue-400"}>{lab.delta > 0 ? "+" : ""}{lab.delta.toFixed(1)}</span>
                        : <span className="text-muted-foreground/30">—</span>}
                    </td>
                    <td className="py-1.5 pr-3 text-center text-muted-foreground text-[10px]">{timeAgo(lab.timestamp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
