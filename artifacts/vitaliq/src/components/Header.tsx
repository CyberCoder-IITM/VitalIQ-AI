import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetUnacknowledgedCount, useGetLatestTriage } from "@workspace/api-client-react";
import { useClinicalStore } from "@/store/clinicalStore";
import { useGetAllSepsisStatuses, useGetOverdueMedications } from "@/hooks/usePhase3Api";

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
    CONTROLLED: "text-green-400 border-green-400/30 bg-green-400/10",
    BUSY: "text-amber-400 border-amber-400/30 bg-amber-400/10",
    CRITICAL_LOAD: "text-red-400 border-red-400/30 bg-red-400/10 animate-news-critical",
  };

  const unacknowledgedCount = alertCount?.count ?? 0;
  const sepsisCount = (sepsisList as any[]).filter(s => s.sepsis_concern).length;
  const overdueMedCount = (overdueMeds as any[]).length;

  return (
    <header className="h-14 bg-card border-b border-border flex items-center px-4 gap-2 shrink-0 z-10">
      <div className="flex items-center gap-2">
        <span className="text-primary font-bold text-lg tracking-tight">VitalIQ</span>
        <span className="text-muted-foreground text-xs border-l border-border pl-2">Emergency Department</span>
      </div>

      <div className="flex-1" />

      {/* Command Center */}
      <button
        onClick={() => setCommandCenterOpen(true)}
        className="flex items-center gap-1 text-xs font-medium text-primary border border-primary/30 bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded transition-colors"
        title="Command Center [C]"
      >
        ⚡ COMMAND
      </button>

      {/* Presentation Mode */}
      <button
        onClick={() => setPresentationModeOpen(true)}
        className="flex items-center gap-1 text-xs font-medium text-purple-400 border border-purple-400/30 bg-purple-400/10 hover:bg-purple-400/20 px-2 py-1 rounded transition-colors"
        title="Presentation Mode [P]"
      >
        📊 PRESENT
      </button>

      {/* Sepsis indicator */}
      {sepsisCount > 0 && (
        <button
          className="flex items-center gap-1 text-xs text-amber-400 border border-amber-400/30 bg-amber-400/10 px-2 py-1 rounded animate-pulse"
          title={`${sepsisCount} sepsis concern(s)`}
        >
          🦠 <span className="font-bold">{sepsisCount}</span>
        </button>
      )}

      {/* Overdue meds indicator */}
      {overdueMedCount > 0 && (
        <button
          className="flex items-center gap-1 text-xs text-amber-400 border border-amber-400/30 bg-amber-400/10 px-2 py-1 rounded"
          title={`${overdueMedCount} overdue medication(s)`}
        >
          💊 <span className="font-bold">{overdueMedCount}</span>
        </button>
      )}

      <div className={`text-xs font-medium px-2 py-0.5 rounded border ${deptColors[deptStatus] ?? deptColors.CONTROLLED}`}>
        {deptStatus.replace("_", " ")}
      </div>

      <button
        onClick={toggleAlertsDrawer}
        className="flex items-center gap-1.5 hover:bg-muted/20 px-2 py-1 rounded transition-colors"
        title="Alerts [A]"
      >
        {unacknowledgedCount > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse">
            {unacknowledgedCount}
          </span>
        )}
        <span className="text-muted-foreground text-xs">ALERTS</span>
      </button>

      {location.startsWith("/patient/") && (
        <button
          onClick={toggleTriageDrawer}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 px-2 py-1 rounded transition-colors"
          title="Triage Agent [T]"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          🤖 TRIAGE
        </button>
      )}

      <div className="text-muted-foreground text-xs border-l border-border pl-3">
        8 PATIENTS
      </div>

      <div className="flex items-center gap-1.5 border-l border-border pl-3">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-green-400 text-xs font-medium">AI ACTIVE</span>
      </div>

      <div className="text-muted-foreground text-xs font-mono border-l border-border pl-3">
        {now.toLocaleTimeString("en-US", { hour12: false })}
      </div>

      <button
        onClick={() => setKeyboardShortcutsOpen(true)}
        className="w-6 h-6 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground text-xs flex items-center justify-center transition-colors ml-1"
        title="Keyboard shortcuts [?]"
      >
        ?
      </button>
    </header>
  );
}
