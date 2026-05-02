import { useGetNews2Score, useGetIcuRisk, useGetPatientAlerts, useGetDrugInteractions } from "@workspace/api-client-react";

interface Props {
  patient: any;
  vitals: any;
  onClick: () => void;
}

function VitalChip({ label, value, unit, critical }: { label: string; value: string | number; unit: string; critical: boolean }) {
  return (
    <div className={`rounded p-1 text-center ${critical ? "bg-red-500/15" : "bg-background"}`}>
      <div className={`text-xs font-bold leading-none ${critical ? "text-red-400" : "text-foreground"}`}>{value}</div>
      <div className="text-[9px] text-muted-foreground mt-0.5">{label} {unit}</div>
    </div>
  );
}

const ACUITY_COLORS: Record<number, string> = {
  1: "bg-red-500 text-white",
  2: "bg-orange-500 text-white",
  3: "bg-amber-400 text-black",
  4: "bg-green-500 text-white",
  5: "bg-blue-400 text-white",
};

export default function PatientCard({ patient, vitals, onClick }: Props) {
  const { data: news2 } = useGetNews2Score(patient.id, { query: { refetchInterval: 4000 } });
  const { data: icu } = useGetIcuRisk(patient.id, { query: { refetchInterval: 15000 } });
  const { data: alerts } = useGetPatientAlerts(patient.id, { query: { refetchInterval: 8000 } });
  const { data: interactions } = useGetDrugInteractions(patient.id, { query: { staleTime: 60000 } });

  const unackAlerts = (alerts ?? []).filter((a: any) => !a.acknowledged).length;
  const majorInteractions = (interactions ?? []).filter((i: any) => i.severity === "MAJOR").length;
  const news2Score = news2?.score ?? 0;

  const borderClass =
    news2Score >= 7
      ? "border-red-500/70 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
      : news2Score >= 5
      ? "border-amber-500/60 shadow-[0_0_8px_rgba(245,158,11,0.2)]"
      : "border-border";

  const news2BadgeClass =
    news2Score >= 7
      ? "bg-red-500/20 text-red-400 border border-red-500/40"
      : news2Score >= 5
      ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
      : "bg-green-500/20 text-green-400 border border-green-500/40";

  const icuPct = icu?.percentage ?? 0;
  const icuColor =
    icuPct >= 75 ? "text-red-400" : icuPct >= 50 ? "text-amber-400" : icuPct >= 25 ? "text-blue-400" : "text-green-400";

  const isCritical = (val: number, lo: number, hi: number) => val < lo || val > hi;

  return (
    <div
      className={`rounded-lg bg-card border ${borderClass} p-3 cursor-pointer hover:bg-card/80 transition-all duration-200 select-none`}
      onClick={onClick}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-[9px] font-bold rounded px-1.5 py-0.5 ${ACUITY_COLORS[patient.acuity] ?? ACUITY_COLORS[3]}`}>
              ESI {patient.acuity}
            </span>
            <span className="text-muted-foreground text-[10px]">{patient.bed}</span>
          </div>
          <div className="text-foreground text-xs font-semibold leading-tight">{patient.name}</div>
          <div className="text-muted-foreground text-[10px]">{patient.age}{patient.sex} · {patient.chief_complaint}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {unackAlerts > 0 && (
            <span className="bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
              {unackAlerts}
            </span>
          )}
          {majorInteractions > 0 && (
            <span className="bg-amber-500/20 text-amber-400 text-[9px] font-bold rounded border border-amber-500/40 px-1 h-4 flex items-center">
              ⚠ Rx
            </span>
          )}
        </div>
      </div>

      {/* Vitals grid */}
      <div className="grid grid-cols-3 gap-1 mb-2">
        <VitalChip label="HR" value={vitals?.heart_rate?.toFixed(0) ?? "--"} unit="bpm"
          critical={!!vitals && isCritical(vitals.heart_rate, 50, 110)} />
        <VitalChip label="BP" value={vitals ? `${vitals.systolic_bp?.toFixed(0)}/${vitals.diastolic_bp?.toFixed(0)}` : "--"} unit="mmHg"
          critical={!!vitals && (vitals.systolic_bp < 90 || vitals.systolic_bp > 160)} />
        <VitalChip label="RR" value={vitals?.respiratory_rate?.toFixed(0) ?? "--"} unit="/min"
          critical={!!vitals && isCritical(vitals.respiratory_rate, 12, 20)} />
        <VitalChip label="SpO2" value={vitals ? `${vitals.spo2?.toFixed(0)}%` : "--"} unit=""
          critical={!!vitals && vitals.spo2 < 94} />
        <VitalChip label="Temp" value={vitals?.temperature?.toFixed(1) ?? "--"} unit="°C"
          critical={!!vitals && (vitals.temperature < 36.0 || vitals.temperature > 38.5)} />
        <VitalChip label="GCS" value={vitals?.gcs ?? "--"} unit=""
          critical={!!vitals && vitals.gcs < 13} />
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between pt-1 border-t border-border/50">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${news2BadgeClass}`}>
            NEWS2 {news2Score}
          </span>
          {news2Score >= 7 && <span className="text-red-400 text-[9px] animate-pulse">●</span>}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground text-[9px]">ICU</span>
          <span className={`text-[10px] font-bold ${icuColor}`}>{icuPct}%</span>
        </div>
      </div>
    </div>
  );
}
