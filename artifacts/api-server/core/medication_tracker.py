"""Medication Administration Tracker — schedule, due, overdue tracking."""
from __future__ import annotations
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["medications"])

PATIENT_IDS = [f"p{str(i).zfill(3)}" for i in range(1, 9)]

FREQ_HOURS = {"QD": 24, "BID": 12, "TID": 8, "QID": 6, "PRN": None}

_doses: dict[str, list] = {}  # patient_id -> list of dose dicts
_administered: dict[str, dict] = {}  # dose_id -> {administered_time, nurse_id}
_held: dict[str, dict] = {}  # dose_id -> {reason, held_at}


class HoldRequest(BaseModel):
    reason: str


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _generate_schedule(patient) -> list:
    """Generate realistic past + future dose schedule from medications."""
    doses = []
    arrival = datetime.fromisoformat(patient.arrival_time.replace("Z", "+00:00"))
    for med in patient.current_medications:
        freq = med.frequency.upper().split()[0] if med.frequency else "QD"
        interval_hrs = FREQ_HOURS.get(freq)
        if interval_hrs is None:
            continue
        interval = timedelta(hours=interval_hrs)
        # Start from arrival, generate 3 past + 3 future doses
        current_time = _now()
        # First dose at arrival + small offset
        first_dose = arrival + timedelta(minutes=30)
        t = first_dose
        while t < arrival:
            t += interval
        # Go back 2 intervals for past doses
        doses_for_med = []
        check_t = t - interval * 2
        while check_t < current_time + interval * 3:
            doses_for_med.append(check_t)
            check_t += interval
        for scheduled in doses_for_med:
            dose_id = f"dose_{patient.id}_{med.name.replace(' ', '_')}_{int(scheduled.timestamp())}"
            doses.append({
                "dose_id": dose_id,
                "patient_id": patient.id,
                "medication_name": med.name,
                "dose": med.dose,
                "route": med.route,
                "frequency": med.frequency,
                "scheduled_time": scheduled.isoformat(),
            })
    return doses


def _get_status(dose: dict, now: datetime) -> dict:
    dose_id = dose["dose_id"]
    if dose_id in _held:
        return {"status": "HELD", "held_reason": _held[dose_id].get("reason"), "administered_time": None, "minutes_until_due": None}
    if dose_id in _administered:
        return {"status": "ADMINISTERED", "administered_time": _administered[dose_id].get("administered_time"), "held_reason": None, "minutes_until_due": None}
    scheduled = datetime.fromisoformat(dose["scheduled_time"].replace("Z", "+00:00"))
    diff_minutes = (scheduled - now).total_seconds() / 60
    if diff_minutes < -0:  # past due
        if diff_minutes < -30:
            return {"status": "OVERDUE", "administered_time": None, "held_reason": None, "minutes_until_due": int(diff_minutes)}
        else:
            return {"status": "DUE", "administered_time": None, "held_reason": None, "minutes_until_due": int(diff_minutes)}
    elif diff_minutes <= 30:
        return {"status": "DUE", "administered_time": None, "held_reason": None, "minutes_until_due": int(diff_minutes)}
    else:
        return {"status": "UPCOMING", "administered_time": None, "held_reason": None, "minutes_until_due": int(diff_minutes)}


def get_patient_schedule(patient_id: str) -> list:
    if patient_id not in _doses:
        from core.fhir_models import PATIENTS_BY_ID
        patient = PATIENTS_BY_ID.get(patient_id)
        if not patient:
            return []
        _doses[patient_id] = _generate_schedule(patient)
    now = _now()
    result = []
    for dose in sorted(_doses[patient_id], key=lambda d: d["scheduled_time"]):
        status_info = _get_status(dose, now)
        result.append({**dose, **status_info})
    return result


def get_all_overdue() -> list:
    all_overdue = []
    for pid in PATIENT_IDS:
        schedule = get_patient_schedule(pid)
        all_overdue.extend([d for d in schedule if d["status"] == "OVERDUE"])
    return all_overdue


async def check_schedules_continuous():
    await asyncio.sleep(5)
    from core.fhir_models import SYNTHETIC_PATIENTS
    for patient in SYNTHETIC_PATIENTS:
        if patient.id not in _doses:
            _doses[patient.id] = _generate_schedule(patient)
    while True:
        await asyncio.sleep(60)


@router.get("/medications/{patient_id}/schedule")
def get_medication_schedule(patient_id: str):
    return get_patient_schedule(patient_id)


@router.get("/medications/overdue")
def get_overdue_medications():
    return get_all_overdue()


@router.post("/medications/{dose_id}/administer")
def administer_medication(dose_id: str):
    _administered[dose_id] = {
        "administered_time": _now().isoformat(),
        "nurse_id": "RN-auto",
    }
    return {"success": True, "dose_id": dose_id, "administered_time": _administered[dose_id]["administered_time"]}


@router.post("/medications/{dose_id}/hold")
def hold_medication(dose_id: str, req: HoldRequest):
    _held[dose_id] = {"reason": req.reason, "held_at": _now().isoformat()}
    return {"success": True, "dose_id": dose_id}
