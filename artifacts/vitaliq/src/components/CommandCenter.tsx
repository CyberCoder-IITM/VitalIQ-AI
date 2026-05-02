import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listPatients, useGetAllCurrentVitals, useGetUnacknowledgedCount, useGetAllAlerts } from "@workspace/api-client-react";
import { useGetAllForecasts, useGetAllSepsisStatuses, useGetOverdueMedications, useGetCommandPrediction, useGetDepartmentTimeline } from "@/hooks/usePhase3Api";
import type { DeteriorationForecast } from "@/hooks/usePhase3Api";
import { useClinicalStore } from "@/store/clinicalStore";
import { useLocation } from "wouter";

export default function CommandCenter() {
  const { setCommandCenterOpen } = useClinicalStore();
  const [, navigate] = useLocation();
  const [shiftReport, setShiftReport] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  const { data: patients = [] } = useQuery({ queryKey: ["/patients"], queryFn: listPatients });
  const { data: vitalsAll = {} } = useGetAllCurrentVitals({ query: { refetchInterval: 5000 } });
  const { data: alertCount } = useGetUnacknowledgedCount({ query: { refetchInterval: 5000 } });
  const { data: allAlerts = [] } = useGetAllAlerts({ query: { refetchInterval: 5000 } });
  const { data: forecasts = [] } = useGetAllForecasts({ refetchInterval: 15000 });
  const { data: sepsisList = [] } = useGetAllSepsisStatuses();
  const { data: overdueMeds = [] } = useGetOverdueMedications();
  const { data: prediction } = useGetCommandPrediction();
  const { data: deptTimeline = [] } = useGetDepartmentTimeline({ refetchInterval: 10000 });

  const now = new Date();
  const shiftHour = now.getHours();
  const shiftName = shiftHour >= 7 && shiftHour < 19 ? "Day Shift 07:00–19:00" : "Night Shift 19:00–07:00";
  const shiftEndHour = shiftHour >= 7 && shiftHour < 19 ? 19 : shiftHour >= 19 ? 31 : 7;
  const hoursRemaining = ((shiftEndHour - shiftHour) + 24) % 24 || 12;

  const news2Map: Record<string, number> = {};
  const icuMap: Record<string, number> = {};
  const arrivalMap: Record<string, number> = {};
  const fcMap: Record<string, DeteriorationForecast> = {};

  (forecasts as DeteriorationForecast[]).forEach(f => { fcMap[f.patient_id] = f; });

  let criticalCount = 0; let news7Count = 0; let icuCandidates = 0;
  const news2sum: number[] = [];
  const edTimes: number[] = [];

  (patients as any[]).forEach((p) => {
    const fc = fcMap[p.id];
    const n2 = fc?.current_news2 ?? 0;
    news2Map[p.id] = n2;
    if (n2 >= 7) { criticalCount++; news7Count++; }
    const icu = fc ? fc.dominant_pattern_probability * 100 : 0;
    icuMap[p.id] = icu;
    if (icu >= 75) icuCandidates++;
    news2sum.push(n2);
    const edH = p.arrival_time ? (Date.now() - new Date(p.arrival_time).getTime()) / 3600000 : 0;
    arrivalMap[p.id] = edH;
    edTimes.push(edH);
  });

  const avgNews2 = news2sum.length ? (news2sum.reduce((a, b) => a + b, 0) / news2sum.length).toFixed(1) : "0";
  const avgEdTime = edTimes.length ? (edTimes.reduce((a, b) => a + b, 0) / edTimes.length) : 0;
  const sepsisCount = (sepsisList as any[]).filter(s => s.sepsis_concern).length;
  const overdueMedCount = (overdueMeds as any[]).length;
  const unackAlerts = alertCount?.count ?? 0;

  // Scatter plot
  const maxEdTime = Math.max(...edTimes, 4);
  const SVG_W = 480; const SVG_H = 200;
  const PAD = { t: 20, r: 20, b: 30, l: 35 };
  const plotW = SVG_W - PAD.l - PAD.r;
  const plotH = SVG_H - PAD.t - PAD.b;

  const toX = (h: number) => PAD.l + (h / maxEdTime) * plotW;
  const toY = (n2: number) => PAD.t + plotH - (n2 / 20) * plotH;

  const ACUITY_COLORS: Record<number, string> = { 1: "#ef4444", 2: "#f97316", 3: "#f59e0b", 4: "#22c55e", 5: "#60a5fa" };

  const generateShiftReport = async () => {
    setGeneratingReport(true);
    try {
      const res = await fetch("/api/ai/command/prediction");
      const data = await res.json();
      setShiftReport(data.prediction);
    } catch {
      setShiftReport("Unable to generate shift report.");
    } finally {
      setGeneratingReport(false);
    }
  };

  const METRICS = [
    { label: "CRITICAL PATIENTS", value: criticalCount, color: criticalCount > 0 ? "text-red-400" : "text-green-400" },
    { label: "NEWS2 ≥ 7", value: news7Count, color: news7Count > 0 ? "text-red-400" : "text-green-400" },
    { label: "AVG NEWS2", value: avgNews2, color: parseFloat(avgNews2) >= 5 ? "text-amber-400" : "text-green-400" },
    { label: "ICU CANDIDATES", value: icuCandidates, color: icuCandidates > 0 ? "text-orange-400" : "text-green-400" },
    { label: "SEPSIS ALERTS", value: sepsisCount, color: sepsisCount > 0 ? "text-amber-400" : "text-green-400" },
    { label: "OVERDUE MEDS", value: overdueMedCount, color: overdueMedCount > 0 ? "text-amber-400" : "text-green-400" },
    { label: "UNACK ALERTS", value: unackAlerts, color: unackAlerts > 10 ? "text-red-400" : unackAlerts > 0 ? "text-amber-400" : "text-green-400" },
    { label: "AVG ED TIME", value: `${Math.floor(avgEdTime)}h ${Math.floor((avgEdTime % 1) * 60)}m`, color: avgEdTime > 4 ? "text-amber-400" : "text-foreground" },
  ];

  const recentAlerts = (allAlerts as any[]).slice(0, 10);
  function timeAgo(ts: string) {
    const s = (Date.now() - new Date(ts).getTime()) / 1000;
    return s < 60 ? `${Math.round(s)}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[hsl(220,28%,7%)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0 bg-card">
        <div className="flex items-center gap-3">
          <span className="text-primary font-black text-lg">⚡ DEPARTMENT COMMAND CENTER</span>
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{now.toLocaleTimeString("en-US", { hour12: false })}</span>
          <span className="border-l border-border pl-4">{shiftName}</span>
          <span className="text-amber-400">{hoursRemaining}h remaining in shift</span>
          <button onClick={() => setCommandCenterOpen(false)}
            className="text-muted-foreground hover:text-foreground text-lg ml-2">✕</button>
        </div>
      </div>

      {/* Top section: Metrics */}
      <div className="grid grid-cols-8 gap-2 px-4 py-3 border-b border-border shrink-0">
        {METRICS.map((m) => (
          <div key={m.label} className="bg-card border border-border rounded-lg p-2 text-center">
            <div className={`font-black text-2xl leading-none ${m.color}`}>{m.value}</div>
            <div className="text-muted-foreground text-[9px] mt-1 leading-tight font-medium">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Middle section: Scatter plot */}
      <div className="px-4 py-3 border-b border-border shrink-0 bg-card/50">
        <div className="text-muted-foreground text-[10px] font-semibold mb-1 uppercase">Patient Priority Matrix — Time in ED × NEWS2 Score</div>
        <svg width="100%" height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="xMidYMid meet">
          {/* Quadrant backgrounds */}
          <rect x={PAD.l} y={PAD.t} width={plotW / 2} height={plotH / 2} fill="rgba(244,67,54,0.06)" />
          <rect x={PAD.l + plotW / 2} y={PAD.t} width={plotW / 2} height={plotH / 2} fill="rgba(244,67,54,0.10)" />
          <rect x={PAD.l} y={PAD.t + plotH / 2} width={plotW / 2} height={plotH / 2} fill="rgba(76,175,80,0.05)" />
          <rect x={PAD.l + plotW / 2} y={PAD.t + plotH / 2} width={plotW / 2} height={plotH / 2} fill="rgba(255,152,0,0.06)" />
          {/* Grid lines */}
          {[5, 10, 15].map(n2 => (
            <line key={n2} x1={PAD.l} x2={SVG_W - PAD.r} y1={toY(n2)} y2={toY(n2)} stroke="#1e2d40" strokeDasharray="3 4" />
          ))}
          {/* Quadrant labels */}
          <text x={PAD.l + 4} y={PAD.t + 12} fontSize={8} fill="rgba(244,67,54,0.5)" fontWeight="600">NEWLY CRITICAL</text>
          <text x={PAD.l + plotW / 2 + 4} y={PAD.t + 12} fontSize={8} fill="rgba(244,67,54,0.7)" fontWeight="600">CRITICAL ZONE</text>
          <text x={PAD.l + 4} y={PAD.t + plotH - 4} fontSize={8} fill="rgba(76,175,80,0.5)">STABLE</text>
          <text x={PAD.l + plotW / 2 + 4} y={PAD.t + plotH - 4} fontSize={8} fill="rgba(255,152,0,0.6)">BOARDING</text>
          {/* Axes */}
          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} stroke="#334155" />
          <line x1={PAD.l} x2={SVG_W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} stroke="#334155" />
          <text x={SVG_W / 2} y={SVG_H - 2} fontSize={8} fill="#546e7a" textAnchor="middle">Time in ED (hours)</text>
          <text x={8} y={PAD.t + plotH / 2} fontSize={8} fill="#546e7a" textAnchor="middle" transform={`rotate(-90, 8, ${PAD.t + plotH / 2})`}>NEWS2</text>
          {/* Patient circles */}
          {(patients as any[]).map((p) => {
            const n2 = news2Map[p.id] ?? 0;
            const edH = arrivalMap[p.id] ?? 0;
            const icp = icuMap[p.id] ?? 0;
            const cx2 = toX(edH);
            const cy2 = toY(n2);
            const r = 8 + icp * 0.12;
            const color = ACUITY_COLORS[p.acuity] ?? "#60a5fa";
            return (
              <g key={p.id} style={{ cursor: "pointer" }}
                onClick={() => { setCommandCenterOpen(false); navigate(`/patient/${p.id}`); }}>
                <circle cx={cx2} cy={cy2} r={r} fill={color} fillOpacity={0.7} stroke={color} strokeWidth={1.5} />
                <text x={cx2} y={cy2 + 3} fontSize={7} textAnchor="middle" fill="white" fontWeight="700">
                  {p.name.split(" ")[0]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Bottom section: 3 columns */}
      <div className="flex-1 grid grid-cols-3 gap-0 overflow-hidden min-h-0">
        {/* Predicted Next Hour */}
        <div className="border-r border-border p-4 overflow-y-auto">
          <div className="text-foreground text-xs font-semibold mb-2">🔮 PREDICTED NEXT HOUR</div>
          {prediction ? (
            <p className="text-foreground/80 text-xs leading-relaxed">{prediction.prediction}</p>
          ) : (
            <div className="text-muted-foreground text-xs animate-pulse">AI predicting department trajectory...</div>
          )}
          <button onClick={generateShiftReport} disabled={generatingReport}
            className="mt-3 text-xs px-3 py-1.5 bg-primary/15 text-primary border border-primary/30 rounded hover:bg-primary/25 transition-colors w-full disabled:opacity-50">
            {generatingReport ? "Generating..." : "📊 Generate Shift Report"}
          </button>
          {shiftReport && (
            <div className="mt-3 bg-muted/20 border border-border rounded p-2 text-xs text-foreground/80">{shiftReport}</div>
          )}
        </div>

        {/* Active Alerts Feed */}
        <div className="border-r border-border p-4 overflow-y-auto">
          <div className="text-foreground text-xs font-semibold mb-2">🔔 ACTIVE ALERTS FEED</div>
          <div className="space-y-1.5">
            {recentAlerts.map((a: any) => (
              <div key={a.alert_id} className={`px-2 py-1.5 rounded text-[10px] border-l-2 ${a.severity === "CRITICAL" ? "border-l-red-500 bg-red-500/5" : a.severity === "URGENT" ? "border-l-amber-500 bg-amber-500/5" : "border-l-blue-500"}`}>
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-muted-foreground">{a.patient_name}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-muted-foreground/60">{timeAgo(a.timestamp)}</span>
                  {!a.acknowledged && <span className="text-[8px] bg-red-500 text-white rounded-full px-1">NEW</span>}
                </div>
                <div className="text-foreground/80 font-medium">{a.title}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Shift Summary */}
        <div className="p-4 overflow-y-auto">
          <div className="text-foreground text-xs font-semibold mb-3">📋 SHIFT SUMMARY</div>
          <div className="space-y-2">
            {[
              { label: "Patients in department", value: patients.length },
              { label: "Critical events (NEWS2≥7)", value: news7Count },
              { label: "Total unack. alerts", value: unackAlerts },
              { label: "Sepsis concerns active", value: sepsisCount },
              { label: "Medications overdue", value: overdueMedCount },
              { label: "Timeline events logged", value: deptTimeline.length },
            ].map((s) => (
              <div key={s.label} className="flex justify-between text-xs border-b border-border/30 pb-1.5">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="text-foreground font-bold">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
