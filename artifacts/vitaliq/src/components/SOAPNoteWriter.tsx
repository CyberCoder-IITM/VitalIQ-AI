import { useState, useEffect } from "react";
import { useGenerateSoapNote } from "@workspace/api-client-react";
import type { SoapNote } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

interface Props { patientId: string; patient?: any; }

const STEPS = ["Reviewing vital signs...", "Analyzing lab results...", "Incorporating differential diagnosis...", "Drafting clinical documentation...", "Applying medical formatting..."];

const SECTION_STYLES: Record<string, { border: string; title: string; letter: string }> = {
  S: { border: "border-l-purple-500", title: "Subjective", letter: "S" },
  O: { border: "border-l-blue-500", title: "Objective", letter: "O" },
  A: { border: "border-l-amber-500", title: "Assessment", letter: "A" },
  P: { border: "border-l-green-500", title: "Plan", letter: "P" },
};

const MDM_BADGE: Record<string, string> = {
  HIGH: "bg-red-500/20 text-red-400 border-red-500/40",
  MODERATE: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  LOW: "bg-green-500/20 text-green-400 border-green-500/40",
};

export default function SOAPNoteWriter({ patientId, patient }: Props) {
  const [note, setNote] = useState<SoapNote | null>(null);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const { mutate: generate, isPending } = useGenerateSoapNote();
  const { toast } = useToast();

  useEffect(() => {
    if (!isPending) return;
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 1100);
    return () => clearInterval(id);
  }, [isPending]);

  const val = (key: string, fallback: string) => edited[key] !== undefined ? edited[key] : fallback;

  const handleGenerate = () => {
    generate({ patientId }, {
      onSuccess: (d: any) => { setNote(d); setEdited({}); }
    });
  };

  const handleCopy = () => {
    if (!note) return;
    const text = `SOAP NOTE\nGenerated: ${new Date(note.timestamp).toLocaleString()}\n\nS (Subjective):\n${val("subjective", note.subjective)}\n\nO (Objective):\n${val("objective", note.objective)}\n\nA (Assessment):\n${val("assessment", note.assessment)}\n\nP (Plan):\n${val("plan", note.plan)}\n\nMDM Level: ${note.mdm_level}\n\nAttestation:\n${note.attestation}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSave = () => {
    toast({ title: "✓ Saved to EHR", description: "Note saved successfully", duration: 2500 });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-foreground font-semibold text-sm">📝 AI CLINICAL NOTE GENERATOR</h3>
          {note && (
            <>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${MDM_BADGE[note.mdm_level] ?? MDM_BADGE.MODERATE}`}>
                MDM: {note.mdm_level}
              </span>
              <span className="text-muted-foreground text-[10px]">{note.word_count} words</span>
            </>
          )}
        </div>
        <button onClick={handleGenerate} disabled={isPending}
          className="text-xs px-3 py-1.5 rounded bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 disabled:opacity-50 transition-colors">
          {isPending ? "Generating..." : note ? "🔄 Regenerate" : "✨ Generate SOAP Note"}
        </button>
      </div>

      {isPending && (
        <div className="bg-card border border-border rounded-lg p-8 text-center space-y-3">
          <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-[progress_5s_ease-in-out_infinite]"
              style={{ animation: "progress 5s ease-in-out infinite", width: `${((step + 1) / STEPS.length) * 100}%`, transition: "width 1s ease-in-out" }} />
          </div>
          <div className="text-foreground text-sm animate-pulse">{STEPS[step]}</div>
          <div className="text-muted-foreground text-xs">~3–5 seconds</div>
        </div>
      )}

      {!note && !isPending && (
        <div className="bg-card border border-border rounded-lg p-10 text-center">
          <div className="text-4xl mb-3 opacity-40">🩺</div>
          <h3 className="text-foreground text-base font-semibold mb-1">Generate AI Clinical Note</h3>
          <p className="text-muted-foreground text-xs mb-4">
            AI will draft a complete SOAP note using current vitals, labs, medications, and differential diagnosis
          </p>
          <button onClick={handleGenerate}
            className="text-sm px-5 py-2 rounded-lg bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors font-semibold">
            ✨ Generate SOAP Note
          </button>
          <div className="text-muted-foreground/60 text-xs mt-2">Estimated time: ~3–5 seconds</div>
        </div>
      )}

      {note && !isPending && (
        <div className="space-y-2">
          {(["S", "O", "A", "P"] as const).map((letter) => {
            const key = letter === "S" ? "subjective" : letter === "O" ? "objective" : letter === "A" ? "assessment" : "plan";
            const style = SECTION_STYLES[letter];
            return (
              <div key={letter} className={`border-l-2 ${style.border} bg-card border border-border rounded-r-lg overflow-hidden`}>
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50 bg-muted/10">
                  <span className="text-xs font-black" style={{
                    color: letter === "S" ? "#9c27b0" : letter === "O" ? "#2196f3" : letter === "A" ? "#ff9800" : "#4caf50"
                  }}>{letter}</span>
                  <span className="text-muted-foreground text-xs">{style.title}</span>
                  <span className="ml-auto text-muted-foreground/50 text-[10px]">{val(key, (note as any)[key]).length} chars</span>
                </div>
                <textarea
                  className="w-full bg-transparent px-3 py-2 text-xs text-foreground resize-y focus:outline-none focus:bg-muted/10 transition-colors min-h-[80px]"
                  style={{ fontFamily: "Georgia, serif", lineHeight: 1.8 }}
                  value={val(key, (note as any)[key])}
                  onChange={(e) => setEdited((p) => ({ ...p, [key]: e.target.value }))}
                  rows={4}
                />
              </div>
            );
          })}

          <div className="bg-muted/20 border border-border/50 rounded-lg p-3 text-[10px] text-muted-foreground">
            <div className="font-semibold text-foreground/60 mb-1">Attestation</div>
            <div>{note.attestation}</div>
            <div className="mt-1">Electronically signed by: Dr. {patient?.attending ?? "Attending"} · {new Date(note.timestamp).toLocaleString()}</div>
          </div>

          <div className="flex gap-2 flex-wrap pt-1">
            <button onClick={handleCopy} className="text-xs px-3 py-1.5 rounded bg-muted/30 text-foreground border border-border hover:bg-muted/50 transition-colors">
              {copied ? "✓ Copied!" : "📋 Copy Note"}
            </button>
            <button onClick={handleSave} className="text-xs px-3 py-1.5 rounded bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 transition-colors">
              💾 Save to Chart
            </button>
            <button onClick={handleGenerate} className="text-xs px-3 py-1.5 rounded bg-muted/30 text-muted-foreground border border-border hover:text-foreground transition-colors">
              🔄 Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
