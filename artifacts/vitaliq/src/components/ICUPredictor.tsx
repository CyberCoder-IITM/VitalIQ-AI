import { useGetIcuRisk } from "@workspace/api-client-react";

interface Props { patientId: string; }

const RISK_COLORS: Record<string, { text: string; bar: string; bg: string }> = {
  LOW: { text: "text-green-400", bar: "bg-green-400", bg: "border-green-500/30 bg-green-500/5" },
  MODERATE: { text: "text-blue-400", bar: "bg-blue-400", bg: "border-blue-500/30 bg-blue-500/5" },
  HIGH: { text: "text-amber-400", bar: "bg-amber-400", bg: "border-amber-500/30 bg-amber-500/5" },
  VERY_HIGH: { text: "text-red-400", bar: "bg-red-400", bg: "border-red-500/40 bg-red-500/5" },
};

export default function ICUPredictor({ patientId }: Props) {
  const { data: icu, isLoading } = useGetIcuRisk(patientId, { query: { refetchInterval: 15000, enabled: !!patientId } });

  if (isLoading) return <div className="h-64 bg-card border border-border rounded-lg animate-pulse" />;
  if (!icu) return null;

  const colors = RISK_COLORS[icu.risk_category] ?? RISK_COLORS.LOW;
  const ciLow = Math.round(icu.confidence_interval_low * 100);
  const ciHigh = Math.round(icu.confidence_interval_high * 100);

  return (
    <div>
      <h3 className="text-foreground font-semibold text-sm mb-3">ICU ADMISSION PREDICTOR</h3>

      <div className={`bg-card border ${colors.bg} rounded-xl p-5 mb-3`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className={`text-6xl font-black ${colors.text}`}>
              {icu.percentage}%
            </div>
            <div className="text-muted-foreground text-xs mt-1">
              95% CI: {ciLow}–{ciHigh}%
            </div>
          </div>
          <div className="text-right">
            <div className={`text-lg font-bold ${colors.text}`}>{icu.risk_category.replace("_", " ")}</div>
            <div className="text-muted-foreground text-xs mt-1">ICU ADMISSION RISK</div>
          </div>
        </div>

        {/* Probability bar */}
        <div className="mb-4">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>0%</span><span className="text-green-400">LOW</span><span className="text-blue-400">MODERATE</span><span className="text-amber-400">HIGH</span><span className="text-red-400">VERY HIGH</span><span>100%</span>
          </div>
          <div className="relative h-3 bg-muted/30 rounded-full overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-1/4 bg-green-500/20" />
            <div className="absolute inset-y-0 left-1/4 w-1/4 bg-blue-500/20" />
            <div className="absolute inset-y-0 left-2/4 w-1/4 bg-amber-500/20" />
            <div className="absolute inset-y-0 left-3/4 w-1/4 bg-red-500/20" />
            <div
              className={`absolute inset-y-0 left-0 ${colors.bar} opacity-80 transition-all duration-500 rounded-full`}
              style={{ width: `${icu.percentage}%` }}
            />
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/80"
              style={{ left: `${icu.percentage}%` }}
            />
          </div>
        </div>

        {/* Key risk factors */}
        <div className="mb-3">
          <div className="text-muted-foreground text-xs mb-2 font-medium">KEY RISK FACTORS</div>
          <div className="flex flex-wrap gap-1.5">
            {icu.key_factors.map((f, i) => (
              <span key={i} className={`text-xs px-2 py-0.5 rounded border ${colors.bg} ${colors.text} font-medium`}>
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className={`border ${colors.bg} rounded-lg p-3 text-xs`}>
        <div className={`font-semibold mb-1 ${colors.text}`}>Clinical Recommendation</div>
        <div className="text-foreground">{icu.recommendation}</div>
      </div>
    </div>
  );
}
