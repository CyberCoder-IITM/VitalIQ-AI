import { useGetVitalsHistory } from "@workspace/api-client-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer } from "recharts";

interface Props { patientId: string; }

interface ChartConfig {
  key: string;
  key2?: string;
  label: string;
  color: string;
  color2?: string;
  unit: string;
  min: number;
  max: number;
  normalLo: number;
  normalHi: number;
  dangerLo?: number;
  dangerHi?: number;
}

const CHARTS: ChartConfig[] = [
  { key: "heart_rate", label: "Heart Rate", color: "#f44336", unit: "bpm", min: 20, max: 220, normalLo: 60, normalHi: 100, dangerLo: 40, dangerHi: 150 },
  { key: "systolic_bp", key2: "diastolic_bp", label: "Blood Pressure", color: "#2196f3", color2: "#90caf9", unit: "mmHg", min: 40, max: 240, normalLo: 90, normalHi: 140, dangerLo: 70, dangerHi: 180 },
  { key: "respiratory_rate", label: "Respiratory Rate", color: "#4caf50", unit: "/min", min: 0, max: 50, normalLo: 12, normalHi: 20, dangerLo: 8, dangerHi: 28 },
  { key: "spo2", label: "SpO₂", color: "#00bcd4", unit: "%", min: 70, max: 100, normalLo: 94, normalHi: 100, dangerLo: 88 },
  { key: "temperature", label: "Temperature", color: "#ff9800", unit: "°C", min: 34, max: 42, normalLo: 36.0, normalHi: 38.0, dangerHi: 39.5 },
  { key: "gcs", label: "GCS", color: "#ab47bc", unit: "", min: 3, max: 15, normalLo: 13, normalHi: 15, dangerLo: 8 },
];

function MiniChart({ config, data }: { config: ChartConfig; data: any[] }) {
  const current = data[data.length - 1];
  const currentVal = current ? current[config.key] : null;
  const prevVal = data.length > 3 ? data[data.length - 4]?.[config.key] : null;
  const trend = prevVal !== null && currentVal !== null
    ? currentVal > prevVal + 1 ? "↑" : currentVal < prevVal - 1 ? "↓" : "→"
    : "";

  const isCritical = currentVal !== null && (
    (config.dangerLo !== undefined && currentVal < config.dangerLo) ||
    (config.dangerHi !== undefined && currentVal > config.dangerHi)
  );

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-muted-foreground text-xs">{config.label}</span>
        <div className="flex items-center gap-1">
          <span className={`text-sm font-bold ${isCritical ? "text-red-400" : "text-foreground"}`}>
            {currentVal !== null ? (config.key === "gcs" ? currentVal : currentVal.toFixed(config.key === "temperature" ? 1 : 0)) : "--"}
          </span>
          <span className="text-muted-foreground text-xs">{config.unit}</span>
          {trend && <span className={`text-xs ${trend === "↑" ? "text-amber-400" : trend === "↓" ? "text-blue-400" : "text-muted-foreground"}`}>{trend}</span>}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={70}>
        <LineChart data={data} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
          <XAxis dataKey="ts" hide />
          <YAxis domain={[config.min, config.max]} tick={{ fontSize: 9, fill: "#546e7a" }} tickCount={4} />
          {config.dangerLo !== undefined && (
            <ReferenceArea y1={config.min} y2={config.dangerLo} fill="#ef444420" />
          )}
          {config.dangerHi !== undefined && (
            <ReferenceArea y1={config.dangerHi} y2={config.max} fill="#ef444420" />
          )}
          <ReferenceLine y={config.normalLo} stroke={config.color} strokeDasharray="3 3" strokeOpacity={0.3} />
          <ReferenceLine y={config.normalHi} stroke={config.color} strokeDasharray="3 3" strokeOpacity={0.3} />
          <Line type="monotone" dataKey={config.key} stroke={config.color} dot={false} strokeWidth={1.5} isAnimationActive={false} />
          {config.key2 && (
            <Line type="monotone" dataKey={config.key2} stroke={config.color2 ?? "#90caf9"} dot={false} strokeWidth={1} strokeDasharray="3 3" isAnimationActive={false} />
          )}
          <Tooltip
            contentStyle={{ background: "#161b27", border: "1px solid #1e2d40", borderRadius: 6, fontSize: 10 }}
            formatter={(val: any) => [typeof val === "number" ? val.toFixed(1) : val, config.label]}
            labelFormatter={() => ""}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function VitalsMonitor({ patientId }: Props) {
  const { data: history = [], isLoading } = useGetVitalsHistory(patientId, { query: { refetchInterval: 3000, enabled: !!patientId } });

  const chartData = (history as any[]).map((v: any, i: number) => ({
    ...v,
    ts: i,
  }));

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 bg-card border border-border rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-foreground font-semibold text-sm">VITAL SIGNS MONITOR</h3>
        <span className="text-muted-foreground text-xs">{history.length} readings · live</span>
      </div>
      <div className="space-y-2">
        {CHARTS.map((cfg) => (
          <MiniChart key={cfg.key} config={cfg} data={chartData} />
        ))}
      </div>
    </div>
  );
}
