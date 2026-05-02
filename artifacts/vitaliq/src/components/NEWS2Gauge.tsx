import { useGetNews2Score, useGetCurrentVitals } from "@workspace/api-client-react";

interface Props { patientId: string; }

function SemiArc({ score }: { score: number }) {
  const R = 72; const cx = 90; const cy = 90;
  const toXY = (deg: number, r: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  function arc(s: number, e: number, r: number) {
    const [x1, y1] = toXY(s, r); const [x2, y2] = toXY(e, r);
    const large = e - s > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  }
  const start = 210; const total = 300;
  const pct = Math.min(1, score / 20);
  const zone1 = start + (total * 4) / 20;
  const zone2 = start + (total * 6) / 20;
  const end = start + total;
  const valueEnd = start + total * pct;
  const color = score >= 7 ? "#f44336" : score >= 5 ? "#ff9800" : "#4caf50";
  const label = score >= 7 ? "HIGH RISK" : score >= 5 ? "MED RISK" : "LOW RISK";

  return (
    <div className="relative flex justify-center">
      {score >= 7 && (
        <>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 rounded-full border-2 border-red-500/40 animate-[news-pulse-ring_1.5s_ease-out_infinite]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-44 rounded-full border border-red-500/20 animate-[news-pulse-ring_1.5s_ease-out_0.5s_infinite]" />
        </>
      )}
      <svg width="180" height="120" viewBox="0 0 180 120">
        <path d={arc(start, zone1, R)} fill="none" stroke="#4caf5030" strokeWidth={10} strokeLinecap="round" />
        <path d={arc(zone1, zone2, R)} fill="none" stroke="#ff980030" strokeWidth={10} strokeLinecap="round" />
        <path d={arc(zone2, end, R)} fill="none" stroke="#f4433630" strokeWidth={10} strokeLinecap="round" />
        {score > 0 && <path d={arc(start, valueEnd, R)} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" />}
        <text x={cx} y={cy - 6} textAnchor="middle" fill={color} fontSize={34} fontWeight="900">{score}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill={color} fontSize={9} fontWeight="700">{label}</text>
        <text x={cx} y={cy + 24} textAnchor="middle" fill="#546e7a" fontSize={8}>/ 20</text>
        <text x={start === 210 ? 20 : 0} y={108} textAnchor="middle" fill="#4caf50" fontSize={7}>0</text>
        <text x={162} y={108} textAnchor="middle" fill="#f44336" fontSize={7}>20</text>
      </svg>
    </div>
  );
}

const VITAL_LABELS: Record<string, string> = {
  respiratory_rate: "Resp Rate", spo2: "SpO₂", systolic_bp: "Systolic BP",
  heart_rate: "Heart Rate", consciousness: "Consciousness", temperature: "Temp",
};

export default function NEWS2Gauge({ patientId }: Props) {
  const { data: news2, isLoading } = useGetNews2Score(patientId, { query: { refetchInterval: 4000, enabled: !!patientId } });
  const { data: vitals } = useGetCurrentVitals(patientId, { query: { refetchInterval: 3000, enabled: !!patientId } });

  if (isLoading) return <div className="h-48 bg-card border border-border rounded-lg animate-pulse" />;
  if (!news2) return null;

  const total = Object.values(news2.component_scores as unknown as Record<string, number>).reduce((a, b) => a + b, 0);
  const borderClass = total >= 7 ? "border-red-500/50" : total >= 5 ? "border-amber-500/40" : "border-border";

  const vitalsDisplay: Record<string, string> = {
    respiratory_rate: vitals ? `${vitals.respiratory_rate.toFixed(0)}/min` : "--",
    spo2: vitals ? `${vitals.spo2.toFixed(0)}%` : "--",
    systolic_bp: vitals ? `${vitals.systolic_bp.toFixed(0)} mmHg` : "--",
    heart_rate: vitals ? `${vitals.heart_rate.toFixed(0)} bpm` : "--",
    consciousness: vitals ? (vitals.gcs === 15 ? "Alert (A)" : vitals.gcs >= 13 ? "Confused (C)" : "Unresponsive (U)") : "--",
    temperature: vitals ? `${vitals.temperature.toFixed(1)} °C` : "--",
  };

  return (
    <div className={`bg-card border ${borderClass} rounded-lg overflow-hidden`}>
      <div className="px-3 py-2 border-b border-border/50">
        <span className="text-foreground text-xs font-semibold">NEWS2 SCORE</span>
        {news2.escalation_required && (
          <span className="ml-2 text-[10px] bg-red-500/20 text-red-400 border border-red-500/40 px-1.5 py-0.5 rounded animate-pulse font-bold">
            ESCALATION REQUIRED
          </span>
        )}
      </div>

      <div className="px-2 pt-2">
        <SemiArc score={total} />
      </div>

      <table className="w-full text-[10px] px-2">
        <tbody>
          {Object.entries(news2.component_scores as unknown as Record<string, number>).map(([key, s]) => {
            const score = Number(s);
            const scoreColor = score >= 3 ? "text-red-400 font-black" : score >= 2 ? "text-amber-400 font-bold" : score >= 1 ? "text-amber-300 font-semibold" : "text-muted-foreground";
            return (
              <tr key={key} className="border-t border-border/30">
                <td className="py-1 pl-3 text-muted-foreground">{VITAL_LABELS[key] ?? key}</td>
                <td className="py-1 text-center text-foreground font-mono text-[9px]">{vitalsDisplay[key]}</td>
                <td className={`py-1 pr-3 text-center ${scoreColor}`}>{score > 0 ? `+${score}` : score}</td>
              </tr>
            );
          })}
          <tr className="border-t border-border bg-muted/10">
            <td className="py-1.5 pl-3 font-bold text-foreground">TOTAL</td>
            <td />
            <td className={`py-1.5 pr-3 text-center font-black text-sm ${total >= 7 ? "text-red-400" : total >= 5 ? "text-amber-400" : "text-green-400"}`}>{total}</td>
          </tr>
        </tbody>
      </table>

      <div className={`mx-2 mb-2 mt-1 p-2 rounded text-[10px] border ${
        total >= 7 ? "bg-red-500/10 border-red-500/40 text-red-300"
        : total >= 5 ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
        : "bg-green-500/10 border-green-500/30 text-green-400"
      }`}>
        {total >= 7 ? "🚨 EMERGENCY — Continuous monitoring, consider ICU transfer"
          : total >= 5 ? "⚠ Urgent review within 1 hour"
          : "✓ Monitor every 4–6 hours"}
        <div className="text-muted-foreground mt-0.5 text-[9px]">{news2.monitoring_frequency}</div>
      </div>
    </div>
  );
}
