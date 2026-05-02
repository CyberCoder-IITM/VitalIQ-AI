import { useState } from "react";
import { useGenerateSoapNote } from "@workspace/api-client-react";
import type { SoapNote } from "@workspace/api-client-react";

interface Props { patientId: string; }

const MDM_COLORS: Record<string, string> = {
  HIGH: "bg-red-500/20 text-red-400 border-red-500/40",
  MODERATE: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  LOW: "bg-green-500/20 text-green-400 border-green-500/40",
};

const SECTION_COLORS: Record<string, string> = {
  S: "text-purple-400 border-purple-500/30",
  O: "text-blue-400 border-blue-500/30",
  A: "text-amber-400 border-amber-500/30",
  P: "text-green-400 border-green-500/30",
};

const SECTION_LABELS: Record<string, string> = {
  S: "Subjective",
  O: "Objective",
  A: "Assessment",
  P: "Plan",
};

export default function SOAPNoteWriter({ patientId }: Props) {
  const [note, setNote] = useState<SoapNote | null>(null);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const { mutate: generate, isPending } = useGenerateSoapNote();

  const handleGenerate = () => {
    generate({ patientId }, {
      onSuccess: (data: any) => {
        setNote(data);
        setEdited({});
      },
    });
  };

  const getValue = (key: string, fallback: string) =>
    edited[key] !== undefined ? edited[key] : fallback;

  const handleCopy = () => {
    if (!note) return;
    const text = `SOAP NOTE — Generated ${new Date(note.timestamp).toLocaleString()}

SUBJECTIVE:
${getValue("subjective", note.subjective)}

OBJECTIVE:
${getValue("objective", note.objective)}

ASSESSMENT:
${getValue("assessment", note.assessment)}

PLAN:
${getValue("plan", note.plan)}

MDM Level: ${note.mdm_level}

ATTESTATION:
${note.attestation}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sections: Array<{ key: string; label: keyof typeof SECTION_LABELS }> = [
    { key: "subjective", label: "S" },
    { key: "objective", label: "O" },
    { key: "assessment", label: "A" },
    { key: "plan", label: "P" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-foreground font-semibold text-sm">📝 AI CLINICAL NOTE GENERATOR</h3>
        <div className="flex gap-2">
          {note && (
            <button
              onClick={handleCopy}
              className="text-xs px-3 py-1.5 rounded bg-muted/30 text-muted-foreground border border-border hover:text-foreground transition-colors"
            >
              {copied ? "Copied!" : "Copy Note"}
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={isPending}
            className="text-xs px-3 py-1.5 rounded bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Generating..." : note ? "Regenerate" : "Generate SOAP Note"}
          </button>
        </div>
      </div>

      {isPending && (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <div className="text-muted-foreground text-sm animate-pulse">
            AI is drafting clinical documentation...
          </div>
          <div className="text-muted-foreground/60 text-xs mt-1">
            This may take 15-30 seconds
          </div>
        </div>
      )}

      {!note && !isPending && (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
          Click Generate to create an AI-drafted clinical SOAP note.
        </div>
      )}

      {note && !isPending && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${MDM_COLORS[note.mdm_level] ?? MDM_COLORS.MODERATE}`}>
              MDM: {note.mdm_level}
            </span>
            <span className="text-muted-foreground text-xs">{note.word_count} words · {note.generated_in_ms}ms</span>
            <span className="text-muted-foreground text-xs ml-auto">{new Date(note.timestamp).toLocaleTimeString()}</span>
          </div>

          {sections.map(({ key, label }) => {
            const colorClass = SECTION_COLORS[label];
            return (
              <div key={key} className={`bg-card border border-border rounded-lg overflow-hidden`}>
                <div className={`px-3 py-2 border-b border-border/50 flex items-center gap-2`}>
                  <span className={`text-xs font-bold w-5 h-5 rounded flex items-center justify-center border ${colorClass}`}>
                    {label}
                  </span>
                  <span className="text-muted-foreground text-xs">{SECTION_LABELS[label]}</span>
                </div>
                <textarea
                  className="w-full bg-transparent px-3 py-2 text-xs text-foreground resize-none focus:outline-none focus:bg-muted/10 transition-colors min-h-[80px]"
                  value={getValue(key, (note as any)[key])}
                  onChange={(e) => setEdited((prev) => ({ ...prev, [key]: e.target.value }))}
                  rows={4}
                />
              </div>
            );
          })}

          <div className="bg-muted/10 border border-border/50 rounded-lg p-3 text-xs text-muted-foreground">
            <div className="font-semibold mb-1 text-foreground/60">Attestation</div>
            {note.attestation}
          </div>
        </div>
      )}
    </div>
  );
}
