import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useGetUnacknowledgedCount, useGetLatestTriage } from "@workspace/api-client-react";
import { useClinicalStore, type ColorMode } from "@/store/clinicalStore";
import { useGetAllSepsisStatuses, useGetOverdueMedications } from "@/hooks/usePhase3Api";

const THEMES: { mode: ColorMode; label: string; icon: string; desc: string }[] = [
  { mode: "dark",     icon: "🌑", label: "Dark",     desc: "Navy blue · default" },
  { mode: "midnight", icon: "💚", label: "Midnight", desc: "Black · green terminal" },
  { mode: "light",    icon: "☀️",  label: "Light",    desc: "White · clinical day" },
];

function ThemePicker() {
  const { colorMode, setColorMode } = useClinicalStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = THEMES.find(t => t.mode === colorMode) ?? THEMES[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-muted-foreground bg-card px-2 py-1 rounded transition-colors"
        title="Switch theme"
      >
        <span>{current.icon}</span>
        <span className="hidden md:inline font-medium">{current.label}</span>
        <span className="text-[9px] opacity-60">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-xl overflow-hidden min-w-[168px]">
          <div className="px-3 py-1.5 border-b border-border">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Theme</span>
          </div>
          {THEMES.map((t) => (
            <button
              key={t.mode}
              onClick={() => { setColorMode(t.mode); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/30 ${
                colorMode === t.mode ? "bg-primary/10" : ""
              }`}
            >
              <span className="text-base leading-none">{t.icon}</span>
              <div className="min-w-0">
                <div className={`text-xs font-medium ${colorMode === t.mode ? "text-primary" : "text-foreground"}`}>
                  {t.label}
                  {colorMode === t.mode && <span className="ml-1.5 text-[9px] opacity-70">✓</span>}
                </div>
                <div className="text-[10px] text-muted-foreground">{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const [now, setNow] = useState(new Date());
  const { data: alertCount } = useGetUnacknowledgedCount({ query: { refetchInterval: 5000 } });
  const { data: triage } = useGetLatestTriage({ query: { refetchInterval: 15000 } });
  const { data: sepsisList = [] } = useGetAllSepsisStatuses();
  const { data: overdueMeds = [] } = useGetOverdueMedications();
  const {
    toggleAlertsDrawer, toggleTriageDrawer, setKeyboardShortcutsOpen,
    setCommandCenterOpen, setPresentationModeOpen,
  } = useClinicalStore();
  const [location] = useLocation();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const deptStatus = triage?.department_status ?? "CONTROLLED";
  const deptColors: Record<string, string> = {
    CONTROLLED:    "text-green-400 border-green-400/30 bg-green-400/10",
    BUSY:          "text-amber-400 border-amber-400/30 bg-amber-400/10",
    CRITICAL_LOAD: "text-red-400 border-red-400/30 bg-red-400/10 animate-news-critical",
  };

  const unacknowledgedCount = alertCount?.count ?? 0;
  const sepsisCount    = (sepsisList as any[]).filter(s => s.sepsis_concern).length;
  const overdueMedCount = (overdueMeds as any[]).length;

  return (
    <header className="h-14 bg-card border-b border-border flex items-center px-3 gap-1.5 shrink-0 z-10 overflow-hidden">
      {/* Brand */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-primary font-bold text-lg tracking-tight">VitalIQ</span>
        <span className="text-muted-foreground text-xs border-l border-border pl-2 hidden sm:block">Emergency Department</span>
      </div>

      <div className="flex-1" />

      {/* COMMAND */}
      <button
        onClick={() => setCommandCenterOpen(true)}
        className="flex items-center gap-1 text-xs font-medium text-primary border border-primary/30 bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded transition-colors shrink-0"
        title="Command Center [C]"
      >
        ⚡ <span className="hidden xs:inline">COMMAND</span>
      </button>

      {/* PRESENT */}
      <button
        onClick={() => setPresentationModeOpen(true)}
        className="flex items-center gap-1 text-xs font-medium text-purple-400 border border-purple-400/30 bg-purple-400/10 hover:bg-purple-400/20 px-2 py-1 rounded transition-colors shrink-0"
        title="Presentation Mode [P]"
      >
        📊 <span className="hidden xs:inline">PRESENT</span>
      </button>

      {/* Sepsis — hide on mobile if cluttered */}
      {sepsisCount > 0 && (
        <button className="hidden sm:flex items-center gap-1 text-xs text-amber-400 border border-amber-400/30 bg-amber-400/10 px-2 py-1 rounded animate-pulse shrink-0" title={`${sepsisCount} sepsis concern(s)`}>
          🦠 <span className="font-bold">{sepsisCount}</span>
        </button>
      )}

      {/* Overdue meds — hide on mobile */}
      {overdueMedCount > 0 && (
        <button className="hidden sm:flex items-center gap-1 text-xs text-amber-400 border border-amber-400/30 bg-amber-400/10 px-2 py-1 rounded shrink-0" title={`${overdueMedCount} overdue medication(s)`}>
          💊 <span className="font-bold">{overdueMedCount}</span>
        </button>
      )}

      {/* Dept status — abbreviated on mobile */}
      <div className={`text-xs font-medium px-1.5 py-0.5 rounded border shrink-0 ${deptColors[deptStatus] ?? deptColors.CONTROLLED}`}>
        <span className="hidden sm:inline">{deptStatus.replace("_", " ")}</span>
        <span className="sm:hidden">{deptStatus === "CRITICAL_LOAD" ? "CRIT" : deptStatus === "BUSY" ? "BUSY" : "OK"}</span>
      </div>

      {/* Alerts */}
      <button
        onClick={toggleAlertsDrawer}
        className="flex items-center gap-1 hover:bg-muted/20 px-2 py-1 rounded transition-colors shrink-0"
        title="Alerts [A]"
      >
        {unacknowledgedCount > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse">
            {unacknowledgedCount}
          </span>
        )}
        <span className="text-muted-foreground text-xs hidden sm:inline">ALERTS</span>
      </button>

      {/* Triage — patient pages only, hide text on mobile */}
      {location.startsWith("/patient/") && (
        <button
          onClick={toggleTriageDrawer}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 px-2 py-1 rounded transition-colors shrink-0"
          title="Triage Agent [T]"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          <span className="hidden sm:inline">🤖 TRIAGE</span>
          <span className="sm:hidden">🤖</span>
        </button>
      )}

      {/* Patient count — desktop only */}
      <div className="text-muted-foreground text-xs border-l border-border pl-3 hidden lg:block shrink-0">8 PATIENTS</div>

      {/* AI status — desktop only */}
      <div className="hidden lg:flex items-center gap-1.5 border-l border-border pl-3 shrink-0">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-green-400 text-xs font-medium">AI ACTIVE</span>
      </div>

      {/* Clock — tablet+ */}
      <div className="text-muted-foreground text-xs font-mono border-l border-border pl-3 hidden md:block shrink-0">
        {now.toLocaleTimeString("en-US", { hour12: false })}
      </div>

      {/* Theme picker */}
      <div className="border-l border-border pl-2 shrink-0">
        <ThemePicker />
      </div>

      {/* Help — desktop only */}
      <button
        onClick={() => setKeyboardShortcutsOpen(true)}
        className="w-6 h-6 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground text-xs hidden md:flex items-center justify-center transition-colors shrink-0"
        title="Keyboard shortcuts [?]"
      >
        ?
      </button>
    </header>
  );
}
