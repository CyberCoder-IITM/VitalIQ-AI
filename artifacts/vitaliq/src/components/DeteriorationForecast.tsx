import { useEffect, useRef, useState } from "react";
import { useGetForecast } from "@/hooks/usePhase3Api";
import type { DeteriorationForecast as ForecastType } from "@/hooks/usePhase3Api";
import { ComposedChart, Line, XAxis, YAxis, ReferenceLine, ReferenceArea, ResponsiveContainer, Tooltip } from "recharts";

interface Props { patientId: string; }

const IW_STYLE: Record<string, { bg: string; text: string; pulse: boolean }> = {
  "ACT NOW": { bg: "bg-red-600", text: "text-white", pulse: true },
  "ACT WITHIN 10 MIN": { bg: "bg-orange-500", text: "text-white", pulse: false },
  "MONITOR CLOSELY": { bg: "bg-amber-500", text: "text-black", pulse: false },
  "STABLE": { bg: "bg-green-600/20 border border-green-500/40", text: "text-green-400", pulse: false },
};

const PATTERN_NAMES: Record<string, string> = {
  sepsis: "Sepsis",
  respiratory_failure: "Resp. Failure",
  hemodynamic_shock: "Shock",
  neuro_deterioration: "Neuro",
  cardiac_arrest_risk: "Cardiac Arrest",
};
const VITAL_LABELS: Record<string, string> = {
  heart_rate: "Heart Rate", systolic_bp: "Systolic BP",
  respiratory_rate: "Resp. Rate", spo2: "SpO₂", temperature: "Temp", gcs: "GCS",
};
const VITAL_UNITS: Record<string, string> = {
  heart_rate: "bpm", systolic_bp: "mmHg", respiratory_rate: "/min", spo2: "%", temperature: "°C", gcs: "",
};
const VITAL_NORMALS: Record<string, [number, number]> = {
  heart_rate: [60, 100], systolic_bp: [90, 140], respiratory_rate: [12, 20],
  spo2: [94, 100], temperature: [36.1, 38.0], gcs: [13, 15],
};

function PentagonRadar({ patterns }: { patterns: ForecastType["patterns"] }) {
  const cx = 100; const cy = 90; const R = 70;
  const keys = ["sepsis", "respiratory_failure", "hemodynamic_shock", "neuro_deterioration", "cardiac_arrest_risk"];
  const point = (i: number, r: number) => {
    const a = ((-90 + i * 72) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const poly = (r: number) => keys.map((_, i) => point(i, r).join(",")).join(" ");
  const valPoly = keys.map((k, i) => {
    const v = (patterns as any)[k] ?? 0;
    return point(i, R * v).join(",");
  }).join(" ");
  const dominantKey = keys.reduce((a, b) => ((patterns as any)[a] ?? 0) > ((patterns as any)[b] ?? 0) ? a : b);
  const dominantVal = (patterns as any)[dominantKey] ?? 0;

  return (
    <svg width="200" height="185" viewBox="0 0 200 185">
      {[0.25, 0.5, 0.75, 1].map(r => (
        <polygon key={r} points={poly(R * r)} fill="none" stroke={r === 1 ? "#334155" : "#1e2d40"} strokeWidth={r === 1 ? 1.5 : 0.5} />
      ))}
      {keys.map((_, i) => {
        const [x2, y2] = point(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke="#334155" strokeWidth={0.5} />;
      })}
      {dominantVal > 0 && (
        <polygon points={valPoly} fill="rgba(244,67,54,0.25)" stroke="#f44336" strokeWidth={1.5} />
      )}
      {keys.map((k, i) => {
        const val = (patterns as any)[k] ?? 0;
        const [px, py] = point(i, R * Math.max(val, 0.05));
        const [lx, ly] = point(i, R + 14);
        return (
          <g key={k}>
            {val > 0 && <circle cx={px} cy={py} r={3} fill="#f44336" />}
            <text x={lx} y={ly} textAnchor="middle" fill={val > 0.5 ? "#f44336" : "#546e7a"}
              fontSize={7.5} fontWeight={val > 0.5 ? "700" : "400"}>
              {PATTERN_NAMES[k]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Countdown({ minutes }: { minutes: number }) {
  const [remaining, setRemaining] = useState(minutes);
  const startRef = useRef(Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 60000;
      setRemaining(Math.max(0, minutes - elapsed));
    }, 5000);
    return () => clearInterval(id);
  }, [minutes]);
  const color = remaining < 5 ? "text-red-400" : remaining < 10 ? "text-orange-400" : "text-amber-400";
  return (
    <div className="text-center">
      <div className="text-muted-foreground text-xs mb-1">⏱ ESTIMATED TIME TO CRITICAL:</div>
      <div className={`font-black text-4xl ${color}`}>{remaining.toFixed(1)}</div>
      <div className={`text-sm font-semibold ${color}`}>minutes</div>
      <div className="mt-2 h-2 bg-muted/30 rounded-full overflow-hidden">
        <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${Math.min(100, 100 - (remaining / 30) * 100)}%` }} />
      </div>
    </div>
  );
}

export function DeteriorationMini({ patientId }: Props) {
  const { data: fc } = useGetForecast(patientId, { refetchInterval: 15000 });
  if (!fc || fc.intervention_window === "STABLE") return null;
  const trajColors: Record<string, string> = {
    RAPIDLY_RISING: "text-red-400", RISING: "text-amber-400",
    STABLE: "text-muted-foreground", FALLING: "text-green-400", RAPIDLY_FALLING: "text-green-500",
  };
  const trajArrows: Record<string, string> = {
    RAPIDLY_RISING: "↑↑", RISING: "↑", STABLE: "→", FALLING: "↓", RAPIDLY_FALLING: "↓↓",
  };
  const iw = fc.intervention_window;
  return (
    <div className="mt-1 pt-1 border-t border-border/30 flex items-center justify-between gap-1 text-[9px]">
      <span className={`font-bold ${trajColors[fc.news2_trajectory] ?? "text-muted-foreground"}`}>
        {trajArrows[fc.news2_trajectory] ?? "→"} {fc.news2_trajectory.replace("_", " ")}
      </span>
      {fc.time_to_critical_minutes !== null && fc.time_to_critical_minutes < 15 && (
        <span className="text-red-400 font-bold">Critical ~{Math.round(fc.time_to_critical_minutes)}m</span>
      )}
      {fc.dominant_pattern && fc.dominant_pattern_probability > 0.5 && (
        <span className="bg-red-500/20 text-red-400 px-1 py-0.5 rounded font-bold border border-red-500/30">
          {fc.dominant_pattern.replace(/_/g, " ").toUpperCase()}
        </span>
      )}
    </div>
  );
}

export default function DeteriorationForecast({ patientId }: Props) {
  const { data: fc, isLoading } = useGetForecast(patientId, { refetchInterval: 15000 });

  if (isLoading) return (
    <div className="space-y-3">
      {[120, 200, 150].map((h, i) => <div key={i} className={`h-${h} bg-card border border-border rounded-lg animate-pulse`} style={{ height: h }} />)}
    </div>
  );
  if (!fc || !fc.patient_id) return (
    <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
      Forecast initializing — collecting vitals history...
    </div>
  );

  const iw = fc.intervention_window;
  const iwStyle = IW_STYLE[iw] ?? IW_STYLE.STABLE;

  // Build chart data: historical + forecast
  const histPoints = (fc.news2_history ?? []).map((v, i) => ({
    x: i - (fc.news2_history.length - 1),
    historical: v,
    forecast: undefined as number | undefined,
  }));
  const lastHistX = 0;
  const forecastPts = [];
  for (let i = 1; i <= 10; i++) {
    const predicted = Math.max(0, Math.min(20, fc.current_news2 + (fc.predicted_news2_5min - fc.current_news2) * (i / 10)));
    forecastPts.push({ x: lastHistX + i, historical: undefined, forecast: Math.round(predicted) });
  }
  const chartData = [...histPoints, { x: 0, historical: fc.current_news2, forecast: fc.current_news2 }, ...forecastPts];

  return (
    <div className="space-y-3">
      {/* Intervention Banner */}
      <div className={`w-full rounded-lg p-4 text-center ${iwStyle.bg} ${iwStyle.pulse ? "animate-pulse" : ""}`}>
        <div className={`font-black text-xl ${iwStyle.text}`}>{iw}</div>
        <div className={`text-sm mt-1 ${iwStyle.text} opacity-80`}>{fc.forecast_basis}</div>
      </div>

      {/* NEWS2 Trajectory Chart */}
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-foreground text-xs font-semibold">NEWS2 TRAJECTORY</span>
          <span className="text-muted-foreground text-[10px]">Historical → Forecast (5min)</span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
            <XAxis dataKey="x" tick={{ fontSize: 9, fill: "#546e7a" }} tickFormatter={(v) => v === 0 ? "NOW" : `${v > 0 ? "+" : ""}${v}`} />
            <YAxis domain={[0, 20]} tick={{ fontSize: 9, fill: "#546e7a" }} />
            <ReferenceArea y1={0} y2={4} fill="rgba(76,175,80,0.05)" />
            <ReferenceArea y1={5} y2={6} fill="rgba(255,152,0,0.06)" />
            <ReferenceArea y1={7} y2={20} fill="rgba(244,67,54,0.06)" />
            <ReferenceLine x={0} stroke="#546e7a" strokeDasharray="4 4" label={{ value: "NOW", fontSize: 8, fill: "#546e7a" }} />
            <ReferenceLine y={5} stroke="#ff9800" strokeDasharray="2 4" label={{ value: "MED RISK", fontSize: 7, fill: "#ff9800", position: "right" }} />
            <ReferenceLine y={7} stroke="#f44336" strokeDasharray="2 4" label={{ value: "HIGH RISK", fontSize: 7, fill: "#f44336", position: "right" }} />
            <Line type="monotone" dataKey="historical" stroke="#00bcd4" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="forecast" stroke="#f44336" strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls={false} isAnimationActive={false} />
            <Tooltip
              contentStyle={{ background: "#161b27", border: "1px solid #1e2d40", fontSize: 10, borderRadius: 6 }}
              labelFormatter={(v) => v === 0 ? "NOW" : `T${v > 0 ? "+" : ""}${v} readings`}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Pattern Radar */}
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="text-foreground text-xs font-semibold mb-1">CLINICAL PATTERNS</div>
          <div className="flex justify-center">
            <PentagonRadar patterns={fc.patterns} />
          </div>
          {fc.dominant_pattern && fc.dominant_pattern_probability > 0.3 && (
            <div className="mt-2 bg-red-500/10 border border-red-500/30 rounded p-2 text-center">
              <div className="text-red-400 text-[10px] font-bold">DOMINANT: {PATTERN_NAMES[fc.dominant_pattern] ?? fc.dominant_pattern}</div>
              <div className="text-red-300 text-[10px]">{Math.round(fc.dominant_pattern_probability * 100)}% probability</div>
            </div>
          )}
        </div>

        {/* Countdown or stable indicator */}
        <div className="bg-card border border-border rounded-lg p-3 flex flex-col items-center justify-center">
          {fc.time_to_critical_minutes !== null ? (
            <Countdown minutes={fc.time_to_critical_minutes} />
          ) : fc.current_news2 >= 7 ? (
            <div className="text-center">
              <div className="text-4xl mb-2">🚨</div>
              <div className="text-red-400 font-bold text-sm">ALREADY CRITICAL</div>
              <div className="text-muted-foreground text-xs">NEWS2 {fc.current_news2}</div>
            </div>
          ) : (
            <div className="text-center">
              <div className="text-4xl mb-2">✓</div>
              <div className="text-green-400 font-bold text-sm">No critical threshold predicted</div>
              <div className="text-muted-foreground text-xs mt-1">Confidence: {Math.round(fc.confidence * 100)}%</div>
            </div>
          )}
        </div>
      </div>

      {/* Vital Forecasts Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2 border-b border-border/50 text-foreground text-xs font-semibold">VITAL SIGN FORECASTS</div>
        <table className="w-full text-xs">
          <thead><tr className="border-b border-border/30">
            <th className="text-left px-3 py-1.5 text-muted-foreground font-normal">Vital</th>
            <th className="text-center py-1.5 text-muted-foreground font-normal">Current</th>
            <th className="text-center py-1.5 text-muted-foreground font-normal">In 5min</th>
            <th className="text-center py-1.5 text-muted-foreground font-normal">Trend</th>
            <th className="text-center pr-3 py-1.5 text-muted-foreground font-normal">Status</th>
          </tr></thead>
          <tbody>
            {Object.entries(fc.vital_forecasts ?? {}).map(([key, vf]) => {
              const normals = VITAL_NORMALS[key];
              const pred5 = vf.predicted_5min;
              const isOutOfRange = normals && (pred5 < normals[0] || pred5 > normals[1]);
              const isCritical = normals && (pred5 < normals[0] * 0.85 || pred5 > normals[1] * 1.15);
              const predColor = isCritical ? "text-red-400 font-bold" : isOutOfRange ? "text-amber-400" : "text-green-400";
              return (
                <tr key={key} className="border-b border-border/20 last:border-0">
                  <td className="px-3 py-1.5 text-foreground">{VITAL_LABELS[key] ?? key}</td>
                  <td className="py-1.5 text-center font-mono text-foreground">
                    {key === "temperature" ? vf.current.toFixed(1) : vf.current.toFixed(0)}{" "}
                    <span className="text-muted-foreground text-[9px]">{VITAL_UNITS[key]}</span>
                  </td>
                  <td className={`py-1.5 text-center font-mono ${predColor}`}>
                    {key === "temperature" ? pred5.toFixed(1) : pred5.toFixed(0)}{" "}
                    <span className="text-[9px] opacity-60">{VITAL_UNITS[key]}</span>
                  </td>
                  <td className="py-1.5 text-center">
                    <span className={vf.direction === "WORSENING" ? "text-red-400" : vf.direction === "IMPROVING" ? "text-green-400" : "text-muted-foreground/40"}>
                      {vf.direction === "WORSENING" ? "↑" : vf.direction === "IMPROVING" ? "↓" : "→"}
                    </span>
                  </td>
                  <td className={`py-1.5 pr-3 text-center text-[10px] font-semibold ${predColor}`}>
                    {vf.direction}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-muted-foreground/50 text-[10px] text-center">
        Forecast confidence: {Math.round(fc.confidence * 100)}% · Updates every 15s · AI reference only
      </div>
    </div>
  );
}
