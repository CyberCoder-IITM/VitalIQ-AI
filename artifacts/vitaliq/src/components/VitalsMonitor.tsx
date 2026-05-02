import { useGetVitalsHistory, useGetCurrentVitals } from "@workspace/api-client-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer } from "recharts";

interface Props { patientId: string; }

interface ChartConfig {
  key: string; key2?: string; label: string; color: string; color2?: string;
  unit: string; min: number; max: number; normalLo: number; normalHi: number;
  dangerLo?: number; dangerHi?: number; stepAfter?: boolean;
}

const CHARTS: ChartConfig[] = [
  { key: "heart_rate", label: "HEART RATE", color: "#f44336", unit: "bpm", min: 30, max: 180, normalLo: 60, normalHi: 100, dangerLo: 40, dangerHi: 130 },
  { key: "systolic_bp", key2: "diastolic_bp", label: "BLOOD PRESSURE", color: "#2196f3", color2: "#90caf9", unit: "mmHg", min: 40, max: 240, normalLo: 90, normalHi: 140, dangerLo: 70, dangerHi: 180 },
  { key: "respiratory_rate", label: "RESPIRATORY RATE", color: "#4caf50", unit: "/min", min: 0, max: 50, normalLo: 12, normalHi: 20, dangerLo: 8, dangerHi: 30 },
  { key: "spo2", label: "SpO₂", color: "#00bcd4", unit: "%", min: 70, max: 100, normalLo: 94, normalHi: 100, dangerLo: 88 },
  { key: "temperature", label: "TEMPERATURE", color: "#ff9800", unit: "°C", min: 35, max: 41, normalLo: 36.1, normalHi: 38.0, dangerHi: 39.5 },
  { key: "gcs", label: "GCS", color: "#9c27b0", unit: "", min: 3, max: 15, normalLo: 13, normalHi: 15, dangerLo: 8, stepAfter: true },
];

function trend(data: any[], key: string) {
  if (data.length < 6) return "→";
  const last3 = data.slice(-3).map((d) => d[key] ?? 0);
  const prev3 = data.slice(-6, -3).map((d) => d[key] ?? 0);
  const lastAvg = last3.reduce((a, b) => a + b, 0) / 3;
  const prevAvg = prev3.reduce((a, b) => a + b, 0) / 3;
  if (lastAvg > prevAvg + 1.5) return "↑";
  if (lastAvg < prevAvg - 1.5) return "↓";
  return "→";
}

function isCritical(val: number, cfg: ChartConfig) {
  return (cfg.dangerLo !== undefined && val < cfg.dangerLo) || (cfg.dangerHi !== undefined && val > cfg.dangerHi);
}

function MiniChart({ config, data }: { config: ChartConfig; data: any[] }) {
  const current = data[data.length - 1];
  const val = current ? current[config.key] : null;
  const t = trend(data, config.key);
  const critical = val !== null && isCritical(val, config);
  const isSpo2Critical = config.key === "spo2" && val !== null && val < 90;
  const isGcsCritical = config.key === "gcs" && val !== null && val <= 8;

  const valDisplay =
    config.key2 && current
      ? `${current[config.key]?.toFixed(0)}/${current[config.key2]?.toFixed(0)}`
      : val !== null
      ? config.key === "temperature" ? val.toFixed(1)
        : config.key === "gcs" ? val
        : val.toFixed(0)
      : "--";

  return (
    <div className={`bg-card border border-border rounded-lg overflow-hidden ${isSpo2Critical ? "animate-spo2-alarm" : ""} ${isGcsCritical ? "bg-red-500/5" : ""}`}>
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-muted-foreground text-[10px] font-semibold tracking-wider">{config.label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] ${t === "↑" ? "text-amber-400" : t === "↓" ? "text-blue-400" : "text-muted-foreground/40"}`}>{t}</span>
          <span className={`font-mono font-bold text-sm ${critical ? "text-red-400 animate-cardiac-pulse" : "text-foreground"}`}>
            {valDisplay}
            <span className="text-muted-foreground text-[10px] font-normal ml-1">{config.unit}</span>
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={60}>
        <LineChart data={data} margin={{ top: 2, right: 4, left: -30, bottom: 0 }}>
          <XAxis dataKey="ts" hide />
          <YAxis domain={[config.min, config.max]} tick={{ fontSize: 8, fill: "#546e7a" }} tickCount={3} />
          {config.dangerLo !== undefined && <ReferenceArea y1={config.min} y2={config.dangerLo} fill="rgba(244,67,54,0.12)" />}
          {config.dangerHi !== undefined && <ReferenceArea y1={config.dangerHi} y2={config.max} fill="rgba(244,67,54,0.12)" />}
          <ReferenceArea y1={config.normalLo} y2={config.normalHi} fill="rgba(76,175,80,0.06)" />
          <ReferenceLine y={config.normalLo} stroke={config.color} strokeDasharray="2 4" strokeOpacity={0.25} />
          <ReferenceLine y={config.normalHi} stroke={config.color} strokeDasharray="2 4" strokeOpacity={0.25} />
          {config.dangerLo !== undefined && <ReferenceLine y={config.dangerLo} stroke="#f44336" strokeOpacity={0.4} />}
          {config.dangerHi !== undefined && <ReferenceLine y={config.dangerHi} stroke="#f44336" strokeOpacity={0.4} />}
          <Line type={config.stepAfter ? "stepAfter" : "monotone"} dataKey={config.key} stroke={config.color} dot={false} strokeWidth={1.5} isAnimationActive={false} />
          {config.key2 && (
            <Line type="monotone" dataKey={config.key2} stroke={config.color2} dot={false} strokeWidth={1} strokeDasharray="3 3" isAnimationActive={false} />
          )}
          <Tooltip
            contentStyle={{ background: "#161b27", border: "1px solid #1e2d40", borderRadius: 6, fontSize: 10, padding: "4px 8px" }}
            formatter={(v: any) => [typeof v === "number" ? v.toFixed(1) : v, config.label]}
            labelFormatter={() => ""}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function VitalsMonitor({ patientId }: Props) {
  const { data: history = [], isLoading } = useGetVitalsHistory(patientId, { query: { refetchInterval: 3000, enabled: !!patientId } });
  const chartData = (history as any[]).map((v: any, i: number) => ({ ...v, ts: i })).slice(-60);

  if (isLoading) return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 bg-card border border-border rounded-lg animate-pulse" />)}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-foreground font-semibold text-xs tracking-wider">📈 REAL-TIME VITALS MONITOR</h3>
        <span className="text-muted-foreground text-[10px]">{chartData.length} pts · live</span>
      </div>
      <div className="space-y-1.5">
        {CHARTS.map((cfg) => <MiniChart key={cfg.key} config={cfg} data={chartData} />)}
      </div>
    </div>
  );
}
