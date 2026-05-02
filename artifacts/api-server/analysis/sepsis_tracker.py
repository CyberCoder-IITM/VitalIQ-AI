"""Sepsis-3 Bundle Tracker — qSOFA screening and bundle compliance."""
from __future__ import annotations
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["sepsis"])

PATIENT_IDS = [f"p{str(i).zfill(3)}" for i in range(1, 9)]

BUNDLE_1HR_ITEMS = [
    {"item_id": "lactate", "item": "Measure lactate level"},
    {"item_id": "cultures", "item": "Obtain blood cultures before antibiotics"},
    {"item_id": "antibiotics", "item": "Administer broad-spectrum antibiotics"},
    {"item_id": "fluids", "item": "Begin 30mL/kg crystalloid for hypotension/lactate ≥4"},
    {"item_id": "vasopressors", "item": "Apply vasopressors if MAP <65 despite fluids"},
]
BUNDLE_3HR_ITEMS = [
    {"item_id": "volume_status", "item": "Reassess volume status"},
    {"item_id": "tissue_perfusion", "item": "Reassess tissue perfusion"},
    {"item_id": "documentation", "item": "Document reassessment findings"},
]


class SepsisTracker:
    def __init__(self):
        self._status: dict[str, dict] = {}
        self._recognition_times: dict[str, str] = {}
        self._bundle_completions: dict[str, dict[str, dict]] = {}

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _get_bundle_items(self, pid: str, items: list, hours: int) -> list:
        completions = self._bundle_completions.get(pid, {})
        result = []
        rec_time = self._recognition_times.get(pid)
        for base in items:
            item_id = base["item_id"]
            comp = completions.get(item_id)
            completed = comp is not None
            completed_at = comp.get("completed_at") if comp else None
            overdue = False
            time_to_complete = None
            if rec_time and not completed:
                elapsed = (datetime.now(timezone.utc) - datetime.fromisoformat(
                    rec_time.replace("Z", "+00:00"))).total_seconds() / 60
                overdue = elapsed > (hours * 60)
                time_to_complete = max(0, int(hours * 60 - elapsed))
            elif rec_time and completed and completed_at:
                try:
                    recognition_dt = datetime.fromisoformat(rec_time.replace("Z", "+00:00"))
                    completed_dt = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
                    time_to_complete = int((completed_dt - recognition_dt).total_seconds() / 60)
                except Exception:
                    time_to_complete = None
            result.append({
                "item_id": item_id,
                "item": base["item"],
                "completed": completed,
                "completed_at": completed_at,
                "time_to_complete": time_to_complete,
                "overdue": overdue,
            })
        return result

    def evaluate_patient(self, patient_id: str, vitals, labs: list | None = None) -> dict:
        criteria = []
        score = 0
        if vitals.respiratory_rate >= 22:
            score += 1
            criteria.append(f"RR ≥22 ({vitals.respiratory_rate:.0f}/min)")
        if vitals.gcs < 15:
            score += 1
            criteria.append(f"Altered mentation (GCS {vitals.gcs})")
        if vitals.systolic_bp <= 100:
            score += 1
            criteria.append(f"SBP ≤100 ({vitals.systolic_bp:.0f}mmHg)")

        concern = score >= 2
        confirmed = False
        if concern:
            temp_crit = vitals.temperature > 38.3 or vitals.temperature < 36.0
            wbc_crit = False
            if labs:
                wbc = next((l for l in labs if "WBC" in l.test_name), None)
                if wbc:
                    wbc_crit = wbc.value > 12 or wbc.value < 4
            confirmed = temp_crit or wbc_crit

        if concern and patient_id not in self._recognition_times:
            self._recognition_times[patient_id] = self._now()

        rec_time = self._recognition_times.get(patient_id)
        time_since_recognition = None
        if rec_time:
            time_since_recognition = int(
                (datetime.now(timezone.utc) - datetime.fromisoformat(
                    rec_time.replace("Z", "+00:00"))).total_seconds() / 60
            )

        bundle_1hr = self._get_bundle_items(patient_id, BUNDLE_1HR_ITEMS, 1)
        bundle_3hr = self._get_bundle_items(patient_id, BUNDLE_3HR_ITEMS, 3)

        all_items = bundle_1hr + bundle_3hr
        completed_count = sum(1 for i in all_items if i["completed"])
        compliance = completed_count / len(all_items) if all_items else 0.0

        cms_risk = concern and time_since_recognition is not None and time_since_recognition > 60 and compliance < 0.8

        result = {
            "patient_id": patient_id,
            "qsofa_score": score,
            "qsofa_criteria_met": criteria,
            "sepsis_concern": concern,
            "sepsis_confirmed": confirmed,
            "bundle_1hr": bundle_1hr,
            "bundle_3hr": bundle_3hr,
            "time_since_recognition": time_since_recognition,
            "recognition_time": rec_time,
            "bundle_compliance": round(compliance, 2),
            "cms_penalty_risk": cms_risk,
            "alert_generated": concern,
        }
        self._status[patient_id] = result
        return result

    def complete_bundle_item(self, patient_id: str, item_id: str) -> bool:
        if patient_id not in self._bundle_completions:
            self._bundle_completions[patient_id] = {}
        self._bundle_completions[patient_id][item_id] = {"completed_at": self._now()}
        return True

    async def run_continuous(self):
        from core.vitals_engine import get_vitals_engine
        from core.lab_data import get_labs_for_patient
        await asyncio.sleep(10)
        while True:
            try:
                engine = get_vitals_engine()
                all_vitals = engine.get_all_current_vitals()
                for pid, vitals in all_vitals.items():
                    labs = get_labs_for_patient(pid)
                    self.evaluate_patient(pid, vitals, labs)
            except Exception:
                pass
            await asyncio.sleep(30)


sepsis_tracker = SepsisTracker()


@router.get("/sepsis/all")
def get_all_sepsis():
    return list(sepsis_tracker._status.values())


@router.get("/sepsis/{patient_id}")
def get_sepsis_status(patient_id: str):
    status = sepsis_tracker._status.get(patient_id)
    if status:
        return status
    from core.vitals_engine import get_vitals_engine
    from core.lab_data import get_labs_for_patient
    engine = get_vitals_engine()
    vitals = engine.get_current_vitals(patient_id)
    if not vitals:
        raise HTTPException(status_code=503, detail="Vitals not available")
    labs = get_labs_for_patient(patient_id)
    return sepsis_tracker.evaluate_patient(patient_id, vitals, labs)


@router.post("/sepsis/{patient_id}/bundle/{item_id}/complete")
def complete_bundle_item(patient_id: str, item_id: str):
    success = sepsis_tracker.complete_bundle_item(patient_id, item_id)
    return {"success": success, "item_id": item_id}
