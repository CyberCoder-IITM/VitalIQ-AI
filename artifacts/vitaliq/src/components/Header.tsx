import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetUnacknowledgedCount, useGetLatestTriage } from "@workspace/api-client-react";

export default function Header() {
  const [now, setNow] = useState(new Date());
  const { data: alertCount } = useGetUnacknowledgedCount({ query: { refetchInterval: 5000 } });
  const { data: triage } = useGetLatestTriage({ query: { refetchInterval: 15000 } });

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const deptStatus = triage?.department_status ?? "CONTROLLED";
  const deptColors: Record<string, string> = {
    CONTROLLED: "text-green-400 border-green-400/30 bg-green-400/10",
    BUSY: "text-amber-400 border-amber-400/30 bg-amber-400/10",
    CRITICAL_LOAD: "text-red-400 border-red-400/30 bg-red-400/10",
  };

  const unacknowledgedCount = alertCount?.count ?? 0;
  const [, navigate] = useLocation();

  return (
    <header className="h-14 bg-card border-b border-border flex items-center px-4 gap-4 shrink-0">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
        <span className="text-primary font-bold text-lg tracking-tight">VitalIQ</span>
        <span className="text-muted-foreground text-xs border-l border-border pl-2">Emergency Department</span>
      </div>

      <div className="flex-1" />

      <div className={`text-xs font-medium px-2 py-0.5 rounded border ${deptColors[deptStatus] ?? deptColors.CONTROLLED}`}>
        {deptStatus.replace("_", " ")}
      </div>

      <div className="flex items-center gap-1.5">
        {unacknowledgedCount > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse">
            {unacknowledgedCount}
          </span>
        )}
        <span className="text-muted-foreground text-xs">ALERTS</span>
      </div>

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
    </header>
  );
}
