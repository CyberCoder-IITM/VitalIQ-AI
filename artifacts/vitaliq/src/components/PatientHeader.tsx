import { useEffect, useState } from "react";
import { useGetPatient } from "@workspace/api-client-react";
import { useClinicalStore } from "@/store/clinicalStore";

interface Props { patientId: string; onBack: () => void; }

const ACUITY_BORDER: Record<number, string> = {
  1: "border-red-500", 2: "border-orange-500", 3: "border-amber-400",
  4: "border-green-500", 5: "border-blue-400",
};
const ACUITY_BG: Record<number, string> = {
  1: "bg-red-500 text-white", 2: "bg-orange-500 text-white", 3: "bg-amber-400 text-black",
  4: "bg-green-500 text-white", 5: "bg-blue-400 text-white",
};

function useTimeInED(arrivalTime?: string) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    if (!arrivalTime) return;
    const update = () => {
      const diff = Date.now() - new Date(arrivalTime).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setElapsed(`${h}h ${m}m`);
    };
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, [arrivalTime]);
  return elapsed;
}

export default function PatientHeader({ patientId, onBack }: Props) {
  const { data: patient } = useGetPatient(patientId);
  const { setHandoffPatientId } = useClinicalStore();
  const [allergiesOpen, setAllergiesOpen] = useState(false);
  const timeInED = useTimeInED(patient?.arrival_time);

  const borderColor = ACUITY_BORDER[patient?.acuity ?? 3] ?? "border-border";
  const edHours = patient?.arrival_time
    ? Math.floor((Date.now() - new Date(patient.arrival_time).getTime()) / 3600000)
    : 0;
  const arrivalColor = edHours > 4 ? "text-red-400" : edHours > 2 ? "text-amber-400" : "text-green-400";

  return (
    <div className={`bg-[hsl(220,28%,10%)] border-b-2 ${borderColor} shrink-0`}>
      <div className="flex items-center px-4 py-2 gap-3 min-w-0">
        <button
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground text-xs flex items-center gap-1 transition-colors shrink-0"
        >
          ← All Patients
        </button>

        <div className="w-px h-5 bg-border shrink-0" />

        <div className="flex items-center gap-2 min-w-0">
          <span className="text-foreground font-bold text-sm">{patient?.name ?? "..."}</span>
          <span className="text-muted-foreground text-xs">{patient?.age}{patient?.sex}</span>
          <span className="text-muted-foreground text-[10px] font-mono bg-muted/30 px-1.5 py-0.5 rounded">
            MRN-{patientId?.slice(-5)?.toUpperCase() ?? "00000"}
          </span>
        </div>

        <div className="w-px h-5 bg-border shrink-0" />

        <div className="flex items-center gap-2 text-xs min-w-0">
          <span className="text-muted-foreground">{patient?.chief_complaint}</span>
          <span className="text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">{patient?.bed}</span>
          {timeInED && (
            <span className={`text-[10px] ${arrivalColor}`}>⏱ {timeInED}</span>
          )}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${ACUITY_BG[patient?.acuity ?? 3] ?? ACUITY_BG[3]}`}>
            ESI {patient?.acuity}
          </span>

          <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
            patient?.code_status === "FULL"
              ? "text-green-400 border-green-400/30 bg-green-400/10"
              : patient?.code_status === "DNR"
              ? "text-red-400 border-red-400/30 bg-red-400/10"
              : "text-amber-400 border-amber-400/30 bg-amber-400/10"
          }`}>
            {patient?.code_status ?? "FULL"}
          </span>

          <span className="text-muted-foreground text-xs flex items-center gap-1">
            🩺 <span>{patient?.attending}</span>
          </span>

          <button
            onClick={() => setHandoffPatientId(patientId)}
            className="text-[10px] text-teal-400 border border-teal-400/30 bg-teal-400/10 px-1.5 py-0.5 rounded hover:bg-teal-400/20 transition-colors"
            title="Generate SBAR Handoff"
          >
            📋 Handoff
          </button>

          {(patient?.allergies?.length ?? 0) > 0 && (
            <button
              onClick={() => setAllergiesOpen(!allergiesOpen)}
              className="text-[10px] text-red-400 border border-red-400/30 bg-red-400/10 px-1.5 py-0.5 rounded hover:bg-red-400/20 transition-colors"
            >
              ⚠ Allergies ({patient?.allergies?.length})
            </button>
          )}
        </div>
      </div>

      {allergiesOpen && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {(patient?.allergies ?? []).map((a: string, i: number) => (
            <span key={i} className="text-[10px] bg-red-500/15 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full">
              {a}
            </span>
          ))}
          {(patient?.conditions ?? []).map((c: string, i: number) => (
            <span key={i} className="text-[10px] bg-muted/30 text-muted-foreground border border-border px-2 py-0.5 rounded-full">
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
