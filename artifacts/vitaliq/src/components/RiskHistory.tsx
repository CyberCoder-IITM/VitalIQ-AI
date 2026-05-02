import { useGetRiskHistory } from "@/hooks/usePhase3Api";
import type { RiskSnapshot } from "@/hooks/usePhase3Api";
import { ComposedChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, ReferenceArea, Tooltip } from "recharts";

interface Props { patientId: string; }

export default function RiskHistory({ patientId }: Props) {
  const { data: snapshots = [] } = useGetRiskHistory(patientId);

  const snaps = snapshots as RiskSnapshot[];
  if (snaps.length === 0) return (
    <div className="border-t border-border mx-3 mb-3">
      <div className="flex items-center justify-between px-1 pt-2 pb-1">
        <span className="text-muted-foreground/50 text-[10px] font-semibold">📈 RISK TRAJECTORY — Since Arrival</span>
        <span className="text-muted-foreground/40 text-[9px]">Collecting data...</span>
      </div>
      <div className="h-20 bg-muted/10 rounded flex items-center justify-center text-muted-foreground/30 text-xs">
        Snapshots recorded every 30s
      </div>
    </div>
  );

  const data = snaps.map((s, i) => ({
    i,
    time: new Date(s.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
    news2: s.news2,
    icu: Math.round(s.icu_probability * 100),
  }));

  const lastSnap = snaps[snaps.length - 1];
  const firstSnap = snaps[0];
  const news2Trend = snaps.length >= 4
    ? lastSnap.news2 > firstSnap.news2 + 2 ? "DETERIORATING"
    : lastSnap.news2 < firstSnap.news2 - 2 ? "IMPROVING"
    : "STABLE"
    : "STABLE";
  const trendColor = news2Trend === "IMPROVING" ? "text-green-400 bg-green-500/10 border-green-500/30"
    : news2Trend === "DETERIORATING" ? "text-red-400 bg-red-500/10 border-red-500/30"
    : "text-muted-foreground bg-muted/20 border-border";

  return (
    <div className="border-t border-border mx-3 mb-3">
      <div className="flex items-center justify-between px-1 pt-2 pb-1">
        <span className="text-foreground/70 text-[10px] font-semibold">📈 RISK TRAJECTORY — Since Arrival</span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground/50 text-[9px]">
            <span className="text-cyan-400">─</span> NEWS2 &nbsp;
            <span className="text-blue-400 border-b-dashed">- -</span> ICU%
          </span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${trendColor}`}>
            {news2Trend === "IMPROVING" ? "↓ IMPROVING TREND" : news2Trend === "DETERIORATING" ? "↑ DETERIORATING" : "→ STABLE"}
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={90}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: -30, bottom: 0 }}>
          <XAxis dataKey="time" tick={{ fontSize: 8, fill: "#546e7a" }} interval={Math.max(1, Math.floor(data.length / 6))} />
          <YAxis yAxisId="news2" domain={[0, 20]} tick={{ fontSize: 8, fill: "#546e7a" }} tickCount={3} />
          <YAxis yAxisId="icu" orientation="right" domain={[0, 100]} tick={{ fontSize: 8, fill: "#546e7a" }} tickCount={3} tickFormatter={(v) => `${v}%`} />
          <ReferenceArea yAxisId="news2" y1={0} y2={4} fill="rgba(76,175,80,0.05)" />
          <ReferenceArea yAxisId="news2" y1={5} y2={6} fill="rgba(255,152,0,0.05)" />
          <ReferenceArea yAxisId="news2" y1={7} y2={20} fill="rgba(244,67,54,0.05)" />
          <ReferenceLine yAxisId="news2" y={7} stroke="#f44336" strokeDasharray="2 4" strokeOpacity={0.3} />
          <Line yAxisId="news2" type="monotone" dataKey="news2" stroke="#00bcd4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line yAxisId="icu" type="monotone" dataKey="icu" stroke="#2196f3" strokeWidth={1.5} strokeDasharray="4 2" dot={false} isAnimationActive={false} />
          <Tooltip
            contentStyle={{ background: "#161b27", border: "1px solid #1e2d40", fontSize: 10, borderRadius: 6, padding: "4px 8px" }}
            formatter={(v: any, name: string) => [name === "icu" ? `${v}%` : v, name === "icu" ? "ICU Risk" : "NEWS2"]}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
