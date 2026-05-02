import { useGetLabResults } from "@workspace/api-client-react";
import type { LabResult } from "@workspace/api-client-react";

interface Props { patientId: string; }

const STATUS_COLORS: Record<string, string> = {
  NORMAL: "text-green-400",
  LOW: "text-blue-400",
  HIGH: "text-amber-400",
  CRITICAL_LOW: "text-red-400 font-bold animate-pulse",
  CRITICAL_HIGH: "text-red-400 font-bold animate-pulse",
};

const STATUS_BG: Record<string, string> = {
  CRITICAL_LOW: "bg-red-500/10",
  CRITICAL_HIGH: "bg-red-500/10",
  LOW: "bg-blue-500/5",
  HIGH: "bg-amber-500/5",
  NORMAL: "",
};

const PANELS: Record<string, string[]> = {
  CARDIAC: ["Troponin I", "CK-MB", "BNP", "Digoxin Level"],
  METABOLIC: ["Glucose", "Na+", "Sodium", "K+", "Creatinine", "BUN", "Bicarbonate", "Calcium", "Phosphorus", "Magnesium", "Mg2+", "Ammonia", "Albumin", "eGFR"],
  HEMATOLOGY: ["WBC", "Hgb", "Hemoglobin", "PLT", "INR", "HbA1c"],
  COAGULATION: ["INR"],
  HEPATIC: ["ALT", "AST", "Bilirubin Total", "Bilirubin"],
  ABG: ["ABG pH", "pCO2", "pO2", "HCO3", "Lactic Acid"],
  OTHER: [],
};

function getPanelForTest(testName: string): string {
  for (const [panel, tests] of Object.entries(PANELS)) {
    if (panel === "OTHER") continue;
    if (tests.some(t => testName.includes(t) || t.includes(testName))) return panel;
  }
  return "OTHER";
}

function timeAgo(ts: string) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
}

export default function LabResults({ patientId }: Props) {
  const { data: labs = [], isLoading } = useGetLabResults(patientId, { query: { staleTime: 30000, enabled: !!patientId } });

  if (isLoading) return <div className="h-64 bg-card border border-border rounded-lg animate-pulse" />;

  // Group by panel
  const grouped: Record<string, LabResult[]> = {};
  for (const lab of labs as LabResult[]) {
    const panel = getPanelForTest(lab.test_name);
    if (!grouped[panel]) grouped[panel] = [];
    grouped[panel].push(lab);
  }

  const panelOrder = ["CARDIAC", "ABG", "HEMATOLOGY", "METABOLIC", "HEPATIC", "COAGULATION", "OTHER"];
  const orderedPanels = panelOrder.filter(p => grouped[p]?.length > 0);

  const criticalCount = (labs as LabResult[]).filter(l => l.status === "CRITICAL_HIGH" || l.status === "CRITICAL_LOW").length;

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

      <div className="space-y-3">
        {orderedPanels.map((panel) => (
          <div key={panel} className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-border/50 bg-muted/10">
              <span className="text-muted-foreground text-xs font-semibold">{panel}</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left text-muted-foreground py-1.5 px-3 font-normal">Test</th>
                  <th className="text-center text-muted-foreground py-1.5 font-normal">Value</th>
                  <th className="text-center text-muted-foreground py-1.5 font-normal">Reference</th>
                  <th className="text-center text-muted-foreground py-1.5 font-normal">Delta</th>
                  <th className="text-center text-muted-foreground py-1.5 pr-3 font-normal">Time</th>
                </tr>
              </thead>
              <tbody>
                {grouped[panel].map((lab, i) => (
                  <tr key={i} className={`border-b border-border/20 last:border-0 ${STATUS_BG[lab.status] ?? ""}`}>
                    <td className="py-1.5 px-3 text-foreground">{lab.test_name}</td>
                    <td className={`py-1.5 text-center font-semibold ${STATUS_COLORS[lab.status] ?? "text-foreground"}`}>
                      {lab.value} <span className="text-muted-foreground font-normal">{lab.unit}</span>
                    </td>
                    <td className="py-1.5 text-center text-muted-foreground">
                      {lab.reference_low}–{lab.reference_high}
                    </td>
                    <td className="py-1.5 text-center">
                      {lab.delta !== null && lab.delta !== undefined ? (
                        <span className={lab.delta > 0 ? "text-amber-400" : "text-blue-400"}>
                          {lab.delta > 0 ? "+" : ""}{lab.delta.toFixed(1)}
                        </span>
                      ) : <span className="text-muted-foreground/30">—</span>}
                    </td>
                    <td className="py-1.5 pr-3 text-center text-muted-foreground text-[10px]">
                      {timeAgo(lab.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {(labs as LabResult[]).length === 0 && (
          <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
            No lab results available
          </div>
        )}
      </div>
    </div>
  );
}
