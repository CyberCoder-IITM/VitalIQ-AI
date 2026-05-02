import { useClinicalStore } from "@/store/clinicalStore";

const SHORTCUTS = [
  { key: "B", desc: "Back to patient board" },
  { key: "1–8", desc: "Navigate to patient 1–8" },
  { key: "A", desc: "Toggle alerts drawer" },
  { key: "T", desc: "Toggle triage agent drawer" },
  { key: "D", desc: "Switch to AI Diagnosis tab" },
  { key: "N", desc: "Switch to SOAP Note tab" },
  { key: "L", desc: "Switch to Lab Trends tab" },
  { key: "/", desc: "Focus clinical query input" },
  { key: "Esc", desc: "Close drawers / modals" },
  { key: "?", desc: "Show this help" },
];

export default function KeyboardShortcutsModal() {
  const { setKeyboardShortcutsOpen } = useClinicalStore();
  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
      onClick={() => setKeyboardShortcutsOpen(false)}
    >
      <div
        className="bg-card border border-border rounded-xl p-5 w-80 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-foreground font-semibold text-sm">Keyboard Shortcuts</span>
          <button onClick={() => setKeyboardShortcutsOpen(false)} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map(({ key, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">{desc}</span>
              <kbd className="text-[10px] bg-muted/40 border border-border px-2 py-0.5 rounded font-mono text-foreground">{key}</kbd>
            </div>
          ))}
        </div>
        <div className="mt-4 text-muted-foreground text-[10px] text-center">
          Shortcuts disabled when focused in text fields
        </div>
      </div>
    </div>
  );
}
