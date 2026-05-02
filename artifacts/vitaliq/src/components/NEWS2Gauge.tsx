import { useGetNews2Score, useGetCurrentVitals } from "@workspace/api-client-react";

interface Props { patientId: string; }

function ArcGauge({ score }: { score: number }) {
  const maxScore = 20;
  const pct = Math.min(1, score / maxScore);
  const R = 60;
  const cx = 80;
  const cy = 80;
  const startAngle = 210;
  const endAngle = 330;
  const totalDeg = 300;

  function polarToXY(deg: number, r: number) {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(startDeg: number, endDeg: number, r: number) {
    const start = polarToXY(startDeg, r);
    const end = polarToXY(endDeg, r);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
  }

  const greenEnd = startAngle + (totalDeg * 4) / maxScore;
  const amberEnd = startAngle + (totalDeg * 6) / maxScore;
  const redEnd = startAngle + totalDeg;
  const valueEnd = startAngle + totalDeg * pct;

  const color = score >= 7 ? "#f44336" : score >= 5 ? "#ff9800" : "#4caf50";
  const label = score >= 7 ? "HIGH RISK" : score >= 5 ? "MEDIUM RISK" : "LOW RISK";

  return (
    <svg width="160" height="140" viewBox="0 0 160 140">
      <path d={arcPath(startAngle, greenEnd, R)} fill="none" stroke="#4caf5040" strokeWidth={8} strokeLinecap="round" />
      <path d={arcPath(greenEnd, amberEnd, R)} fill="none" stroke="#ff980040" strokeWidth={8} strokeLinecap="round" />
      <path d={arcPath(amberEnd, redEnd, R)} fill="none" stroke="#f4433640" strokeWidth={8} strokeLinecap="round" />
      {score > 0 && (
        <path d={arcPath(startAngle, valueEnd, R)} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" />
      )}
      <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize={28} fontWeight="bold">{score}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill={color} fontSize={9} fontWeight="600">{label}</text>
      <text x={cx} y={cy + 26} textAnchor="middle" fill="#546e7a" fontSize={8}>/ 20</text>
    </svg>
  );
}

const VITAL_LABELS: Record<string, string> = {
  respiratory_rate: "Respiratory Rate",
  spo2: "SpO₂",
  systolic_bp: "Systolic BP",
  heart_rate: "Heart Rate",
  consciousness: "Consciousness",
  temperature: "Temperature",
};

export default function NEWS2Gauge({ patientId }: Props) {
  const { data: news2, isLoading } = useGetNews2Score(patientId, { query: { refetchInterval: 4000, enabled: !!patientId } });
  const { data: vitals } = useGetCurrentVitals(patientId, { query: { refetchInterval: 3000, enabled: !!patientId } });

  if (isLoading) return <div className="h-64 bg-card border border-border rounded-lg animate-pulse" />;
  if (!news2) return null;

  const componentScores = news2.component_scores as Record<string, number>;
  const vitalsDisplay: Record<string, string> = {
    respiratory_rate: vitals ? `${vitals.respiratory_rate.toFixed(0)}/min` : "--",
    spo2: vitals ? `${vitals.spo2.toFixed(0)}%` : "--",
    systolic_bp: vitals ? `${vitals.systolic_bp.toFixed(0)} mmHg` : "--",
    heart_rate: vitals ? `${vitals.heart_rate.toFixed(0)} bpm` : "--",
    consciousness: vitals ? (vitals.gcs === 15 ? "Alert" : vitals.gcs >= 13 ? "Confused" : "Unconscious") : "--",
    temperature: vitals ? `${vitals.temperature.toFixed(1)}°C` : "--",
  };

  const total = Object.values(componentScores).reduce((a, b) => a + b, 0);
  const bgClass = total >= 7 ? "border-red-500/40" : total >= 5 ? "border-amber-500/40" : "border-border";

  return (
    <div>
      <h3 className="text-foreground font-semibold text-sm mb-3">NEWS2 SCORE</h3>
      <div className={`bg-card border ${bgClass} rounded-lg p-4`}>
        <div className="flex flex-col items-center mb-4">
          <ArcGauge score={total} />
        </div>

        {/* Component breakdown */}
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-muted-foreground py-1.5 font-normal">Parameter</th>
              <th className="text-center text-muted-foreground py-1.5 font-normal">Value</th>
              <th className="text-center text-muted-foreground py-1.5 font-normal">Score</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(componentScores).map(([key, score]) => {
              const numScore = Number(score);
              const scoreColor = numScore >= 3 ? "text-red-400 font-bold" : numScore >= 2 ? "text-amber-400 font-semibold" : numScore >= 1 ? "text-amber-300" : "text-green-400";
              return (
                <tr key={key} className="border-b border-border/50">
                  <td className="py-1.5 text-foreground">{VITAL_LABELS[key] ?? key}</td>
                  <td className="py-1.5 text-center text-muted-foreground">{vitalsDisplay[key]}</td>
                  <td className={`py-1.5 text-center ${scoreColor}`}>{numScore}</td>
                </tr>
              );
            })}
            <tr className="bg-card/50">
              <td className="py-1.5 text-foreground font-semibold">TOTAL</td>
              <td />
              <td className={`py-1.5 text-center font-bold ${total >= 7 ? "text-red-400" : total >= 5 ? "text-amber-400" : "text-green-400"}`}>{total}</td>
            </tr>
          </tbody>
        </table>

        <div className={`mt-3 p-2.5 rounded border text-xs ${
          news2.escalation_required ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-border bg-muted/30 text-muted-foreground"
        }`}>
          <div className="font-semibold mb-0.5">Recommended Action</div>
          <div>{news2.recommended_action}</div>
          <div className="mt-1 text-muted-foreground">Monitoring: {news2.monitoring_frequency}</div>
        </div>
      </div>
    </div>
  );
}
