import { useEffect, useRef } from "react";
import { useGetIcuRisk } from "@workspace/api-client-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface Props { patientId: string; }

export default function ICUPredictor({ patientId }: Props) {
  const { data: icu, isLoading } = useGetIcuRisk(patientId, { query: { refetchInterval: 15000, enabled: !!patientId } });
  const historyRef = useRef<number[]>([]);

  useEffect(() => {
    if (icu?.percentage !== undefined) {
      historyRef.current = [...historyRef.current, icu.percentage].slice(-10);
    }
  }, [icu?.percentage]);

  if (isLoading) return <div className="h-40 bg-card border border-border rounded-lg animate-pulse" />;
  if (!icu) return null;

  const pct = icu.percentage;
  const isDarkRed = pct > 75;
  const color = isDarkRed ? "#b71c1c" : pct >= 50 ? "#f44336" : pct >= 25 ? "#ff9800" : "#4caf50";
  const borderClass = isDarkRed ? "border-red-900/60" : pct >= 50 ? "border-red-500/40" : pct >= 25 ? "border-amber-500/30" : "border-border";

  const hist = historyRef.current;
  const sparkData = hist.map((v, i) => ({ i, v }));
  const trendLabel = hist.length >= 3
    ? hist[hist.length - 1] > hist[0] + 3 ? "▲ Risk increasing"
    : hist[hist.length - 1] < hist[0] - 3 ? "▼ Risk decreasing"
    : "→ Risk stable"
    : "→ Risk stable";
  const trendColor = trendLabel.startsWith("▲") ? "text-red-400" : trendLabel.startsWith("▼") ? "text-green-400" : "text-muted-foreground";

  const ciLow = Math.round(icu.confidence_interval_low * 100);
  const ciHigh = Math.round(icu.confidence_interval_high * 100);

  return (
    <div className={`bg-card border ${borderClass} rounded-lg overflow-hidden`}>
      <div className="px-3 py-2 border-b border-border/50">
        <span className="text-foreground text-xs font-semibold">🏥 ICU ADMISSION RISK</span>
      </div>

      <div className="px-3 pt-3 pb-2">
        <div className="flex items-end justify-between mb-2">
          <div>
            <div className="font-black leading-none" style={{ fontSize: "2.8rem", color: isDarkRed ? "#ef5350" : color }}>
              {pct}%
            </div>
            <div className="text-muted-foreground text-[10px] mt-1">95% CI: {ciLow}–{ciHigh}%</div>
          </div>
          <div className="text-right">
            <div className="font-bold text-sm" style={{ color }}>{icu.risk_category.replace("_", " ")}</div>
            {isDarkRed && <div className="text-red-400 text-[10px] animate-pulse font-bold">CRITICAL</div>}
            {sparkData.length > 1 && (
              <div className={`text-[10px] mt-1 ${trendColor}`}>{trendLabel}</div>
            )}
          </div>
        </div>

        {/* Gradient probability bar */}
        <div className="mb-1">
          <div className="relative h-3 rounded-full overflow-hidden" style={{ background: "linear-gradient(to right, #4caf50 0%, #ff9800 50%, #f44336 75%, #b71c1c 100%)" }}>
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md border-2 border-card"
              style={{ left: `${Math.min(97, pct)}%`, transform: "translateY(-50%) translateX(-50%)" }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
            <span className="text-green-400">LOW</span>
            <span className="text-amber-400">MOD</span>
            <span className="text-red-400">HIGH</span>
            <span className="text-red-900">V.HIGH</span>
          </div>
        </div>

        {/* Sparkline */}
        {sparkData.length > 2 && (
          <div className="h-10 mb-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData}>
                <Line type="monotone" dataKey="v" stroke={color} dot={false} strokeWidth={1.5} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Key factors */}
        {icu.key_factors.length > 0 && (
          <div className="mb-2">
            <div className="text-muted-foreground text-[10px] mb-1">Driving factors:</div>
            <div className="flex flex-wrap gap-1">
              {icu.key_factors.slice(0, 4).map((f, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded border border-border text-foreground bg-muted/20">{f}</span>
              ))}
            </div>
          </div>
        )}

        {/* Recommendation */}
        <div className={`p-2 rounded text-[10px] border ${
          pct > 75 ? "bg-red-500/10 border-red-500/40 text-red-300"
          : pct > 50 ? "bg-orange-500/10 border-orange-500/30 text-orange-300"
          : pct > 25 ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
          : "bg-green-500/10 border-green-500/30 text-green-400"
        }`}>
          {pct > 75 ? "🚨 IMMEDIATE ICU CONSULT REQUIRED"
          : pct > 50 ? "🚨 Notify attending — ICU consult advised"
          : pct > 25 ? "⚠ Reassess in 30 minutes"
          : "✓ Continue monitoring per protocol"}
        </div>
      </div>
    </div>
  );
}
