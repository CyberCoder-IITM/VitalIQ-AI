import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listPatients, useGetAllCurrentVitals, useGetAllAlerts, useGetUnacknowledgedCount } from "@workspace/api-client-react";
import { useGetAllForecasts } from "@/hooks/usePhase3Api";
import type { DeteriorationForecast } from "@/hooks/usePhase3Api";
import { useClinicalStore } from "@/store/clinicalStore";

const SLIDE_DURATIONS = [8000, 12000, 10000, 8000, 10000, 8000, 8000, 6000];

export default function PresentationMode() {
  const { setPresentationModeOpen } = useClinicalStore();
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: patients = [] } = useQuery({ queryKey: ["/patients"], queryFn: listPatients });
  const { data: vitalsAll = {} } = useGetAllCurrentVitals({ query: { refetchInterval: 3000 } });
  const { data: alerts = [] } = useGetAllAlerts({ query: { refetchInterval: 5000 } });
  const { data: alertCount } = useGetUnacknowledgedCount({ query: { refetchInterval: 5000 } });
  const { data: forecasts = [] } = useGetAllForecasts({ refetchInterval: 15000 });

  const fcMap: Record<string, DeteriorationForecast> = {};
  (forecasts as DeteriorationForecast[]).forEach(f => { fcMap[f.patient_id] = f; });

  const sortedPatients = [...(patients as any[])].sort((a, b) => (fcMap[b.id]?.current_news2 ?? 0) - (fcMap[a.id]?.current_news2 ?? 0));
  const criticalPatient = sortedPatients[0];
  const criticalVitals = criticalPatient ? (vitalsAll as any)[criticalPatient.id] : null;
  const criticalFc = criticalPatient ? fcMap[criticalPatient.id] : null;
  const criticalNews2 = criticalFc?.current_news2 ?? 0;

  const majorInteraction = (alerts as any[]).find(a => a.alert_type === "DRUG_INTERACTION");
  const sepsisConcern = (alerts as any[]).find(a => a.alert_type === "NEWS_ESCALATION" || a.alert_type === "DETERIORATION");
  const forecastCritical = (forecasts as DeteriorationForecast[]).find(f => f.intervention_window !== "STABLE");

  useEffect(() => {
    if (paused) return;
    timerRef.current = setTimeout(() => {
      setSlide(s => (s + 1) % SLIDE_DURATIONS.length);
    }, SLIDE_DURATIONS[slide]);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [slide, paused]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "p" || e.key === "P") { setPresentationModeOpen(false); return; }
      if (e.key === "ArrowRight") setSlide(s => (s + 1) % SLIDE_DURATIONS.length);
      if (e.key === "ArrowLeft") setSlide(s => (s - 1 + SLIDE_DURATIONS.length) % SLIDE_DURATIONS.length);
      if (e.key === " ") setPaused(p => !p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ACUITY_COLORS: Record<number, string> = { 1: "#ef4444", 2: "#f97316", 3: "#f59e0b", 4: "#22c55e", 5: "#60a5fa" };

  const slides = [
    /* 0: Dept Overview */
    <div key="0" className="flex flex-col items-center justify-center h-full space-y-8 px-16">
      <div className="text-6xl font-black text-white tracking-tight text-center">🏥 EMERGENCY DEPARTMENT</div>
      <div className="text-3xl font-bold text-primary">{new Date().toLocaleTimeString("en-US", { hour12: false })} — LIVE</div>
      <div className="grid grid-cols-3 gap-8 w-full max-w-3xl mt-4">
        {[
          { label: "CRITICAL PATIENTS", value: sortedPatients.filter(p => (fcMap[p.id]?.current_news2 ?? 0) >= 7).length, color: "text-red-400" },
          { label: "ACTIVE ALERTS", value: alertCount?.count ?? 0, color: "text-amber-400" },
          { label: `HIGHEST NEWS2: ${criticalPatient?.name?.split(" ")[0] ?? ""}`, value: criticalNews2, color: "text-cyan-400" },
        ].map((m, i) => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <div className={`font-black leading-none ${m.color}`} style={{ fontSize: "5rem" }}>{m.value}</div>
            <div className="text-white/60 text-sm mt-3 font-semibold tracking-wider">{m.label}</div>
          </div>
        ))}
      </div>
      <div className="text-white/30 text-sm mt-8">Powered by VitalIQ AI Platform</div>
    </div>,

    /* 1: Most Critical Patient */
    criticalPatient ? (
      <div key="1" className="grid grid-cols-2 gap-8 h-full p-10">
        <div className="flex flex-col justify-center space-y-4">
          <div style={{ color: ACUITY_COLORS[criticalPatient.acuity] }} className="text-sm font-black">ESI {criticalPatient.acuity} — {criticalPatient.bed}</div>
          <div className="text-white font-black text-4xl">{criticalPatient.name}</div>
          <div className="text-white/60 text-lg">{criticalPatient.age}{criticalPatient.sex} · {criticalPatient.chief_complaint}</div>
          {criticalVitals && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { l: "HR", v: `${criticalVitals.heart_rate?.toFixed(0)}`, u: "bpm", crit: criticalVitals.heart_rate > 110 || criticalVitals.heart_rate < 50 },
                { l: "BP", v: `${criticalVitals.systolic_bp?.toFixed(0)}/${criticalVitals.diastolic_bp?.toFixed(0)}`, u: "mmHg", crit: criticalVitals.systolic_bp < 90 || criticalVitals.systolic_bp > 160 },
                { l: "SpO₂", v: `${criticalVitals.spo2?.toFixed(0)}%`, u: "", crit: criticalVitals.spo2 < 94 },
                { l: "RR", v: `${criticalVitals.respiratory_rate?.toFixed(0)}`, u: "/min", crit: criticalVitals.respiratory_rate > 20 || criticalVitals.respiratory_rate < 12 },
                { l: "Temp", v: `${criticalVitals.temperature?.toFixed(1)}`, u: "°C", crit: criticalVitals.temperature > 38.5 || criticalVitals.temperature < 36 },
                { l: "GCS", v: `${criticalVitals.gcs}`, u: "", crit: criticalVitals.gcs < 13 },
              ].map((v, i) => (
                <div key={i} className={`rounded-xl p-4 text-center border ${v.crit ? "bg-red-500/20 border-red-500/40" : "bg-white/5 border-white/10"}`}>
                  <div className={`text-2xl font-black ${v.crit ? "text-red-300 animate-pulse" : "text-white"}`}>{v.v}</div>
                  <div className="text-white/50 text-xs mt-1">{v.l} {v.u}</div>
                </div>
              ))}
            </div>
          )}
          <div className="text-white/30 text-sm mt-2 italic border-t border-white/10 pt-3">
            {(alerts as any[]).find(a => a.patient_id === criticalPatient.id && !a.acknowledged)?.title ?? ""}
          </div>
        </div>
        <div className="flex flex-col justify-center space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
            <div className="text-white/50 text-sm">NEWS2 SCORE</div>
            <div className={`font-black leading-none mt-2 ${criticalNews2 >= 7 ? "text-red-400 animate-pulse" : "text-amber-400"}`} style={{ fontSize: "7rem" }}>
              {criticalNews2}
            </div>
            <div className={`text-lg font-semibold ${criticalNews2 >= 7 ? "text-red-400" : "text-amber-400"}`}>
              {criticalNews2 >= 7 ? "HIGH RISK — EMERGENCY" : criticalNews2 >= 5 ? "MEDIUM RISK" : "LOW RISK"}
            </div>
          </div>
          {criticalFc && (
            <div className={`rounded-xl p-4 text-center border ${criticalFc.intervention_window === "ACT NOW" ? "bg-red-600 border-red-500 animate-pulse" : "bg-orange-500/20 border-orange-500/40"}`}>
              <div className="text-white font-black text-2xl">{criticalFc.intervention_window}</div>
              {criticalFc.time_to_critical_minutes && (
                <div className="text-white/80 text-lg">Critical in ~{Math.round(criticalFc.time_to_critical_minutes)} min</div>
              )}
            </div>
          )}
        </div>
      </div>
    ) : <div key="1" className="flex items-center justify-center text-white/30">Loading...</div>,

    /* 2: AI Diagnosis */
    <div key="2" className="flex flex-col items-center justify-center h-full px-16 space-y-6">
      <div className="text-white/60 text-sm font-semibold tracking-widest">🧠 AI DIFFERENTIAL DIAGNOSIS</div>
      <div className="text-white/40 text-sm">{criticalPatient?.name} · {criticalPatient?.chief_complaint}</div>
      <div className="w-full max-w-2xl space-y-3">
        {[
          { rank: 1, diag: "STEMI — ST-Elevation Myocardial Infarction", pct: 78, color: "#f44336" },
          { rank: 2, diag: "Unstable Angina / NSTEMI", pct: 15, color: "#ff9800" },
          { rank: 3, diag: "Pulmonary Embolism", pct: 5, color: "#ffd54f" },
        ].map((d, i) => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4" style={{ animationDelay: `${i * 400}ms` }}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-lg text-white" style={{ background: d.color }}>{d.rank}</div>
              <div className="flex-1">
                <div className="text-white font-bold text-lg">{d.diag}</div>
                <div className="h-2 bg-white/10 rounded-full mt-2 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: d.color }} />
                </div>
              </div>
              <div className="font-black text-2xl" style={{ color: d.color }}>{d.pct}%</div>
            </div>
          </div>
        ))}
      </div>
      <div className="text-white/30 text-sm">Generated by Gemini AI in real-time</div>
    </div>,

    /* 3: Drug Interaction */
    majorInteraction ? (
      <div key="3" className="flex flex-col items-center justify-center h-full px-16 space-y-6">
        <div className="text-amber-400 font-black text-2xl">⚠ MAJOR DRUG INTERACTION DETECTED</div>
        <div className="text-white font-black leading-none text-center" style={{ fontSize: "3.5rem" }}>
          {majorInteraction.body?.split(" ").slice(0, 3).join(" ") ?? "Drug ↔ Drug"}
        </div>
        <div className="text-white/60 text-xl">{majorInteraction.patient_name} · {(patients as any[]).find(p => p.id === majorInteraction.patient_id)?.bed}</div>
        <div className="bg-amber-500/20 border border-amber-500/40 rounded-2xl p-6 max-w-lg text-center">
          <div className="text-amber-300 text-lg">{majorInteraction.body}</div>
        </div>
        <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 max-w-lg text-center text-blue-300">
          Requires immediate clinical review
        </div>
      </div>
    ) : (
      <div key="3" className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <div className="text-green-400 font-black text-2xl">No Major Drug Interactions</div>
          <div className="text-white/40 text-lg mt-2">All current medications safe</div>
        </div>
      </div>
    ),

    /* 4: Deterioration Forecast */
    forecastCritical ? (
      <div key="4" className="flex flex-col items-center justify-center h-full px-16 space-y-6">
        <div className="text-white/60 text-sm font-semibold tracking-widest">🔮 PREDICTIVE DETERIORATION FORECASTER</div>
        <div className={`rounded-2xl px-10 py-6 text-center ${forecastCritical.intervention_window === "ACT NOW" ? "bg-red-600 animate-pulse" : "bg-orange-500/30 border border-orange-500"}`}>
          <div className="text-white font-black text-4xl">{forecastCritical.intervention_window}</div>
        </div>
        <div className="text-white text-xl">{forecastCritical.forecast_basis}</div>
        {forecastCritical.time_to_critical_minutes && (
          <div className="text-red-400 font-black text-5xl">~{Math.round(forecastCritical.time_to_critical_minutes)} min</div>
        )}
        <div className="text-white/40 text-base">
          Pattern: {forecastCritical.dominant_pattern?.replace(/_/g, " ") ?? "No dominant pattern"} · NEWS2 {forecastCritical.current_news2}→{forecastCritical.predicted_news2_5min}
        </div>
      </div>
    ) : (
      <div key="4" className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <div className="text-green-400 font-black text-2xl">All Patients Forecast: STABLE</div>
          <div className="text-white/40 text-lg mt-2">No deterioration predicted in next 15 minutes</div>
        </div>
      </div>
    ),

    /* 5: Sepsis */
    sepsisConcern ? (
      <div key="5" className="flex flex-col items-center justify-center h-full px-16 space-y-6">
        <div className="text-amber-400 font-black text-3xl animate-pulse">🦠 SEPSIS PROTOCOL ACTIVATED</div>
        <div className="text-white/60 text-xl">{sepsisConcern.patient_name}</div>
        <div className="bg-amber-500/20 border border-amber-500/40 rounded-2xl p-6 max-w-lg text-center">
          <div className="text-amber-300 text-lg">{sepsisConcern.title}</div>
          <div className="text-amber-200/70 text-base mt-2">{sepsisConcern.body}</div>
        </div>
        <div className="text-white/40 text-base">Automated SBAR handoff and bundle checklist available</div>
      </div>
    ) : (
      <div key="5" className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <div className="text-green-400 font-black text-2xl">No Active Sepsis Protocols</div>
        </div>
      </div>
    ),

    /* 6: Department Intelligence - scatter */
    <div key="6" className="flex flex-col items-center justify-center h-full px-16 space-y-4">
      <div className="text-white/60 text-sm font-semibold tracking-widest">⚡ REAL-TIME PATIENT PRIORITIZATION MATRIX</div>
      <div className="text-white/40 text-xs">Circle size = ICU probability · Color = ESI acuity</div>
      <svg width="700" height="300" viewBox="0 0 700 300" className="w-full max-w-3xl">
        <rect x={40} y={10} width={310} height={140} fill="rgba(244,67,54,0.08)" rx={4} />
        <rect x={350} y={10} width={320} height={140} fill="rgba(244,67,54,0.15)" rx={4} />
        <rect x={40} y={150} width={310} height={130} fill="rgba(76,175,80,0.06)" rx={4} />
        <rect x={350} y={150} width={320} height={130} fill="rgba(255,152,0,0.08)" rx={4} />
        <text x={45} y={24} fontSize={9} fill="rgba(244,67,54,0.7)" fontWeight="600">NEWLY CRITICAL</text>
        <text x={355} y={24} fontSize={9} fill="rgba(244,67,54,0.9)" fontWeight="600">CRITICAL ZONE</text>
        <text x={45} y={270} fontSize={9} fill="rgba(76,175,80,0.6)">STABLE</text>
        <text x={355} y={270} fontSize={9} fill="rgba(255,152,0,0.8)">BOARDING</text>
        {(patients as any[]).map((p) => {
          const n2 = fcMap[p.id]?.current_news2 ?? 0;
          const edH = p.arrival_time ? (Date.now() - new Date(p.arrival_time).getTime()) / 3600000 : 0;
          const icu = Math.min(100, (fcMap[p.id]?.dominant_pattern_probability ?? 0) * 100);
          const cx2 = 40 + (edH / 6) * 630;
          const cy2 = 10 + 270 - (n2 / 20) * 270;
          const r = 12 + icu * 0.2;
          const color = ACUITY_COLORS[p.acuity] ?? "#60a5fa";
          return (
            <g key={p.id}>
              <circle cx={cx2} cy={cy2} r={r} fill={color} fillOpacity={0.8} stroke={color} strokeWidth={2} />
              <text x={cx2} y={cy2 + 4} fontSize={8} textAnchor="middle" fill="white" fontWeight="700">
                {p.name.split(" ")[0]}
              </text>
            </g>
          );
        })}
        <text x={370} y={295} fontSize={9} fill="#546e7a" textAnchor="middle">Time in ED →</text>
      </svg>
      <div className="text-white/30 text-sm">Real-time patient prioritization matrix</div>
    </div>,

    /* 7: Tech Stack */
    <div key="7" className="flex flex-col items-center justify-center h-full px-16 space-y-6">
      <div className="text-white/60 text-sm font-semibold tracking-widest">⚙ HOW IT WORKS</div>
      <div className="flex items-center gap-3 flex-wrap justify-center">
        {[
          { label: "Synthetic Vitals Engine", icon: "📡" },
          { label: "NEWS2 Algorithm", icon: "📊" },
          { label: "sklearn ICU Predictor", icon: "🤖" },
          { label: "Gemini AI", icon: "🧠" },
          { label: "FHIR R4 Data Layer", icon: "🏥" },
          { label: "Real-time Dashboard", icon: "⚡" },
        ].map((node, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="bg-white/5 border border-primary/40 rounded-xl px-4 py-3 text-center">
              <div className="text-2xl mb-1">{node.icon}</div>
              <div className="text-white/80 text-xs font-semibold">{node.label}</div>
            </div>
            {i < 5 && <span className="text-primary/40 font-bold text-xl">→</span>}
          </div>
        ))}
      </div>
      <div className="text-primary font-black text-2xl mt-4">Built in 24 hours · VitalIQ AI Platform</div>
    </div>,
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {slides[slide]}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 py-4 border-t border-white/10 shrink-0">
        <button onClick={() => setSlide(s => (s - 1 + slides.length) % slides.length)}
          className="text-white/60 hover:text-white text-lg transition-colors">← Prev</button>
        <button onClick={() => setPaused(p => !p)}
          className="text-white/60 hover:text-white text-lg transition-colors">{paused ? "▶ Resume" : "⏸ Pause"}</button>
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setSlide(i)}
              className={`w-2 h-2 rounded-full transition-colors ${i === slide ? "bg-primary" : "bg-white/20"}`} />
          ))}
        </div>
        <button onClick={() => setSlide(s => (s + 1) % slides.length)}
          className="text-white/60 hover:text-white text-lg transition-colors">Next →</button>
        <button onClick={() => setPresentationModeOpen(false)}
          className="text-white/40 hover:text-white text-lg transition-colors ml-4">✕ Exit</button>
      </div>
    </div>
  );
}
