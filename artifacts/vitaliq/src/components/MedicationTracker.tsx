import { useState } from "react";
import { useGetMedicationSchedule, useAdministerMedication, useHoldMedication } from "@/hooks/usePhase3Api";
import type { MedicationDose } from "@/hooks/usePhase3Api";

interface Props { patientId: string; }

const STATUS_DOT: Record<string, string> = {
  ADMINISTERED: "bg-green-500", UPCOMING: "bg-blue-400", DUE: "bg-amber-400 animate-pulse",
  OVERDUE: "bg-red-500 animate-pulse", HELD: "bg-muted-foreground", REFUSED: "bg-muted-foreground/50",
};
const STATUS_BADGE: Record<string, string> = {
  ADMINISTERED: "bg-green-500/15 text-green-400 border-green-500/30",
  UPCOMING: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  DUE: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  OVERDUE: "bg-red-500/15 text-red-400 border-red-500/30",
  HELD: "bg-muted/30 text-muted-foreground border-border",
  REFUSED: "bg-muted/30 text-muted-foreground/50 border-border",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function HoldModal({ onConfirm, onCancel }: { onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-lg p-4 w-80">
        <div className="text-foreground text-sm font-semibold mb-2">Hold Medication</div>
        <input value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for hold..."
          className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary mb-3" />
        <div className="flex gap-2">
          <button onClick={() => reason.trim() && onConfirm(reason)}
            disabled={!reason.trim()}
            className="flex-1 text-xs py-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded hover:bg-amber-500/30 disabled:opacity-50 transition-colors">
            Hold
          </button>
          <button onClick={onCancel}
            className="flex-1 text-xs py-1.5 bg-muted/30 text-muted-foreground border border-border rounded hover:text-foreground transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MedicationTracker({ patientId }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [holdingDoseId, setHoldingDoseId] = useState<string | null>(null);
  const { data: doses = [], refetch } = useGetMedicationSchedule(patientId, { refetchInterval: 30000 });
  const { mutate: administer } = useAdministerMedication();
  const { mutate: hold } = useHoldMedication();

  const dueCount = (doses as MedicationDose[]).filter(d => d.status === "DUE").length;
  const overdueCount = (doses as MedicationDose[]).filter(d => d.status === "OVERDUE").length;
  const upcomingCount = (doses as MedicationDose[]).filter(d => d.status === "UPCOMING").length;

  const handleAdminister = (dose: MedicationDose) => {
    administer({ doseId: dose.dose_id, patientId }, { onSuccess: () => refetch() });
  };

  const handleHold = (doseId: string, reason: string) => {
    hold({ doseId, patientId, reason }, { onSuccess: () => { refetch(); setHoldingDoseId(null); } });
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
        <div className="flex items-center gap-1.5">
          <span className="text-foreground text-xs font-semibold">💊 MEDICATION SCHEDULE</span>
          {overdueCount > 0 && (
            <span className="bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">{overdueCount} OVERDUE</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Due: {dueCount} | Overdue: {overdueCount} | Upcoming: {upcomingCount}</span>
          <span className="text-muted-foreground text-xs">{collapsed ? "▼" : "▲"}</span>
        </div>
      </div>

      {!collapsed && (
        <div className="divide-y divide-border/30 max-h-80 overflow-y-auto">
          {(doses as MedicationDose[]).length === 0 && (
            <div className="text-muted-foreground text-xs text-center py-4">No scheduled medications</div>
          )}
          {(doses as MedicationDose[]).map((dose) => (
            <div key={dose.dose_id}
              className={`flex items-center gap-2 px-3 py-2 text-xs ${dose.status === "OVERDUE" ? "bg-red-500/8" : dose.status === "DUE" ? "bg-amber-500/5 border-l-2 border-l-amber-500 animate-[pulse_2s_infinite]" : ""}`}>
              <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[dose.status] ?? "bg-muted"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground font-medium">{dose.medication_name}</span>
                  <span className="text-muted-foreground">{dose.dose}</span>
                  <span className="text-muted-foreground/60">{dose.route}</span>
                </div>
                <div className="text-muted-foreground text-[9px] mt-0.5">
                  {dose.status === "ADMINISTERED" && dose.administered_time
                    ? `✓ Given ${formatTime(dose.administered_time)}`
                    : dose.status === "HELD" && dose.held_reason
                    ? `⏸ Held: ${dose.held_reason}`
                    : dose.minutes_until_due !== null
                    ? dose.minutes_until_due < 0
                      ? `Scheduled: ${formatTime(dose.scheduled_time)} — ${Math.abs(dose.minutes_until_due)}m overdue`
                      : `Scheduled: ${formatTime(dose.scheduled_time)} — in ${dose.minutes_until_due}m`
                    : `Scheduled: ${formatTime(dose.scheduled_time)}`}
                </div>
              </div>
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${STATUS_BADGE[dose.status] ?? ""}`}>
                {dose.status === "OVERDUE" ? `OVERDUE ${Math.abs(dose.minutes_until_due ?? 0)}m` : dose.status}
              </span>
              <div className="flex gap-1 shrink-0">
                {(dose.status === "DUE" || dose.status === "OVERDUE") && (
                  <button onClick={() => handleAdminister(dose)}
                    className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${dose.status === "OVERDUE" ? "bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30" : "bg-primary/15 text-primary border-primary/30 hover:bg-primary/25"}`}>
                    ✓ Give
                  </button>
                )}
                {dose.status === "UPCOMING" && (
                  <button onClick={() => setHoldingDoseId(dose.dose_id)}
                    className="text-[9px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-amber-400 transition-colors">
                    ⏸
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {holdingDoseId && (
        <HoldModal onConfirm={(reason) => handleHold(holdingDoseId, reason)} onCancel={() => setHoldingDoseId(null)} />
      )}
    </div>
  );
}
