import { useState, useEffect } from "react";
import { useGenerateHandoff, useGenerateDepartmentHandoff } from "@/hooks/usePhase3Api";
import type { SBARHandoff } from "@/hooks/usePhase3Api";

interface Props { patientId?: string; patientName?: string; news2?: number; onClose: () => void; }

const URGENCY_STYLE = {
  EMERGENT: "bg-red-600 text-white",
  URGENT: "bg-amber-500 text-black",
  ROUTINE: "bg-green-600 text-white",
};
const SBAR_STYLES = {
  situation: { border: "border-l-red-500", title: "S — SITUATION", letter: "S", color: "text-red-400" },
  background: { border: "border-l-blue-500", title: "B — BACKGROUND", letter: "B", color: "text-blue-400" },
  assessment: { border: "border-l-amber-500", title: "A — ASSESSMENT", letter: "A", color: "text-amber-400" },
  recommendation: { border: "border-l-green-500", title: "R — RECOMMENDATION", letter: "R", color: "text-green-400" },
};

export default function HandoffGenerator({ patientId, patientName, news2, onClose }: Props) {
  const [outgoing, setOutgoing] = useState("Dr. Attending");
  const [handoff, setHandoff] = useState<SBARHandoff | null>(null);
  const [editedSections, setEditedSections] = useState<Record<string, string>>({});
  const [deptHandoffs, setDeptHandoffs] = useState<SBARHandoff[] | null>(null);
  const [activePatientIdx, setActivePatientIdx] = useState(0);
  const [pendingChecked, setPendingChecked] = useState<Record<number, boolean>>({});
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const isDept = !patientId;

  const { mutate: generate, isPending } = useGenerateHandoff();
  const { mutate: generateDept, isPending: isDeptPending } = useGenerateDepartmentHandoff();

  const autoUrgency = news2 !== undefined
    ? news2 >= 7 ? "EMERGENT" : news2 >= 5 ? "URGENT" : "ROUTINE"
    : "ROUTINE";

  useEffect(() => {
    if (isDept) {
      generateDept(undefined, { onSuccess: (d) => setDeptHandoffs(d) });
    }
  }, []);

  const handleGenerate = () => {
    if (!patientId) return;
    generate({ patientId, outgoing_provider: outgoing }, {
      onSuccess: (d) => { setHandoff(d); setEditedSections({}); },
    });
  };

  const sectionVal = (key: string, fallback: string) =>
    editedSections[key] !== undefined ? editedSections[key] : fallback;

  const handleCopy = (h: SBARHandoff) => {
    const text = `SBAR CLINICAL HANDOFF\n${"=".repeat(40)}\nURGENCY: ${h.urgency}\nGenerated: ${new Date(h.generated_at).toLocaleString()}\nProvider: ${h.outgoing_provider}\n\nSITUATION:\n${sectionVal("situation", h.situation)}\n\nBACKGROUND:\n${sectionVal("background", h.background)}\n\nASSESSMENT:\n${sectionVal("assessment", h.assessment)}\n\nRECOMMENDATION:\n${sectionVal("recommendation", h.recommendation)}\n\nKEY CONCERNS:\n${h.key_concerns.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\nPENDING:\n${h.pending_items.map((p, i) => `☐ ${p}`).join("\n")}\n\n30-SECOND SUMMARY:\n${h.verbal_summary}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleReadAloud = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    if (isSpeaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const activeHandoff = isDept ? (deptHandoffs?.[activePatientIdx] ?? null) : handoff;
  const isLoading = isPending || isDeptPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-xl w-[720px] max-h-[88vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-foreground font-bold text-base">📋 Clinical Handoff Generator</h2>
            <p className="text-muted-foreground text-xs mt-0.5">SBAR Format — Evidence-based handoff protocol</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
        </div>

        {/* Dept patient tabs */}
        {isDept && deptHandoffs && (
          <div className="flex gap-0 border-b border-border overflow-x-auto shrink-0">
            {deptHandoffs.map((h, i) => (
              <button key={h.patient_id} onClick={() => setActivePatientIdx(i)}
                className={`px-3 py-1.5 text-[10px] font-semibold border-b-2 transition-colors whitespace-nowrap ${i === activePatientIdx ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                <span className={`w-2 h-2 rounded-full inline-block mr-1 ${h.urgency === "EMERGENT" ? "bg-red-500" : h.urgency === "URGENT" ? "bg-amber-500" : "bg-green-500"}`} />
                {h.patient_id.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Pre-generate state */}
          {!isDept && !handoff && !isLoading && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold px-2 py-1 rounded ${URGENCY_STYLE[autoUrgency]}`}>
                  {autoUrgency} — Pre-selected (NEWS2 {news2 ?? 0})
                </span>
                <span className="text-muted-foreground text-xs">{patientName}</span>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Outgoing Provider</label>
                <input value={outgoing} onChange={(e) => setOutgoing(e.target.value)}
                  className="bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary w-full max-w-xs" />
              </div>
              <button onClick={handleGenerate}
                className="px-5 py-2.5 bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 rounded-lg text-sm font-semibold transition-colors">
                ✨ Generate SBAR Handoff
              </button>
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="text-5xl animate-pulse">🏥</div>
              <div className="text-foreground text-sm animate-pulse">
                {isDept ? "Generating handoffs for all 8 patients..." : "Generating clinical handoff..."}
              </div>
              <div className="text-muted-foreground text-xs">Powered by Gemini AI · ~5-10 seconds</div>
            </div>
          )}

          {/* Generated state */}
          {activeHandoff && !isLoading && (
            <div className="space-y-3">
              <div className={`w-full py-3 rounded-lg text-center text-lg font-black ${URGENCY_STYLE[activeHandoff.urgency]}`}>
                {activeHandoff.urgency} HANDOFF
              </div>

              {(["situation", "background", "assessment", "recommendation"] as const).map((key) => {
                const style = SBAR_STYLES[key];
                return (
                  <div key={key} className={`border-l-2 ${style.border} bg-background border border-border rounded-r-lg overflow-hidden`}>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/10 border-b border-border/30">
                      <span className={`text-xs font-black ${style.color}`}>{style.letter}</span>
                      <span className="text-muted-foreground text-xs">{style.title}</span>
                    </div>
                    <textarea
                      className="w-full bg-transparent px-3 py-2 text-xs text-foreground resize-y focus:outline-none min-h-[70px]"
                      style={{ fontFamily: "Georgia, serif", lineHeight: 1.8 }}
                      value={sectionVal(key, activeHandoff[key])}
                      onChange={(e) => setEditedSections(p => ({ ...p, [key]: e.target.value }))}
                      rows={3}
                    />
                  </div>
                );
              })}

              {activeHandoff.key_concerns.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <div className="text-amber-400 text-xs font-bold mb-2">KEY CONCERNS</div>
                  {activeHandoff.key_concerns.map((c, i) => (
                    <div key={i} className="text-amber-300 text-xs flex gap-1.5"><span>•</span>{c}</div>
                  ))}
                </div>
              )}

              {activeHandoff.pending_items.length > 0 && (
                <div className="bg-card border border-border rounded-lg p-3">
                  <div className="text-foreground text-xs font-bold mb-2">PENDING ITEMS</div>
                  {activeHandoff.pending_items.map((p, i) => (
                    <label key={i} className="flex items-center gap-2 text-xs text-foreground/80 mb-1 cursor-pointer">
                      <input type="checkbox" checked={!!pendingChecked[i]}
                        onChange={() => setPendingChecked(prev => ({ ...prev, [i]: !prev[i] }))}
                        className="accent-primary" />
                      <span className={pendingChecked[i] ? "line-through text-muted-foreground" : ""}>{p}</span>
                    </label>
                  ))}
                </div>
              )}

              <div className="bg-muted/20 border border-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-foreground text-xs font-bold">🎙 30-SECOND SPOKEN SUMMARY</span>
                  <button onClick={() => handleReadAloud(activeHandoff.verbal_summary)}
                    className={`text-[10px] px-2 py-1 rounded border transition-colors ${isSpeaking ? "bg-red-500/20 text-red-400 border-red-500/40" : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"}`}>
                    {isSpeaking ? "⏹ Stop" : "🔊 Read Aloud"}
                  </button>
                </div>
                <p className="text-foreground text-sm leading-relaxed" style={{ fontFamily: "Georgia, serif" }}>
                  {activeHandoff.verbal_summary}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        {activeHandoff && !isLoading && (
          <div className="flex gap-2 flex-wrap px-5 py-3 border-t border-border shrink-0">
            <button onClick={() => handleCopy(activeHandoff)}
              className="text-xs px-3 py-1.5 rounded bg-muted/30 text-foreground border border-border hover:bg-muted/50 transition-colors">
              {copied ? "✓ Copied!" : "📋 Copy SBAR"}
            </button>
            <button onClick={() => { const sub = encodeURIComponent(`SBAR Handoff — ${patientName ?? "Department"}`); const body = encodeURIComponent(`SBAR HANDOFF\n\nSituation: ${activeHandoff.situation}\n\nBackground: ${activeHandoff.background}\n\nAssessment: ${activeHandoff.assessment}\n\nRecommendation: ${activeHandoff.recommendation}`); window.location.href = `mailto:?subject=${sub}&body=${body}`; }}
              className="text-xs px-3 py-1.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 transition-colors">
              📧 Email
            </button>
            <button onClick={() => window.print()}
              className="text-xs px-3 py-1.5 rounded bg-muted/30 text-foreground border border-border hover:bg-muted/50 transition-colors">
              🖨 Print
            </button>
            {!isDept && (
              <button onClick={handleGenerate}
                className="text-xs px-3 py-1.5 rounded bg-muted/30 text-muted-foreground border border-border hover:text-foreground transition-colors">
                🔄 Regenerate
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
