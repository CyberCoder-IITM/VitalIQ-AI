"""Synthetic patient vitals generator — 8 patients with realistic physiology and deterioration events."""
import asyncio
import random
import math
from collections import deque
from datetime import datetime, timezone
from typing import Callable, Optional
from models.schemas import VitalSigns, Patient
from core.fhir_models import SYNTHETIC_PATIENTS, PATIENTS_BY_ID


# Baselines per patient id
BASELINES = {
    "p001": dict(hr=88,  sbp=145, dbp=92,  rr=18, spo2=97, temp=37.1, gcs=15, pain=4),
    "p002": dict(hr=112, sbp=98,  dbp=64,  rr=24, spo2=91, temp=38.8, gcs=15, pain=6),
    "p003": dict(hr=96,  sbp=168, dbp=98,  rr=20, spo2=94, temp=38.2, gcs=14, pain=2),
    "p004": dict(hr=102, sbp=118, dbp=76,  rr=16, spo2=99, temp=38.9, gcs=15, pain=7),
    "p005": dict(hr=44,  sbp=88,  dbp=52,  rr=14, spo2=96, temp=36.8, gcs=15, pain=3),
    "p006": dict(hr=118, sbp=142, dbp=88,  rr=22, spo2=95, temp=37.4, gcs=14, pain=2),
    "p007": dict(hr=76,  sbp=132, dbp=84,  rr=14, spo2=98, temp=37.0, gcs=15, pain=5),
    "p008": dict(hr=88,  sbp=156, dbp=94,  rr=18, spo2=93, temp=36.6, gcs=15, pain=3),
}

# Deterioration event definitions per patient
DETERIORATION_EVENTS = {
    "p001": dict(  # ST-elevation
        hr=(130, 145), sbp=(78, 92), dbp=(44, 56), rr=(26, 30), spo2=(87, 91), temp_delta=0.2, gcs=15
    ),
    "p002": dict(  # Bronchospasm
        hr=(138, 150), sbp=(92, 106), dbp=(60, 72), rr=(32, 38), spo2=(80, 86), temp_delta=0.0, gcs=14
    ),
    "p003": dict(  # Hypertensive crisis
        hr=(108, 118), sbp=(218, 235), dbp=(128, 140), rr=(22, 26), spo2=(90, 94), temp_delta=0.0, gcs=11
    ),
    "p004": dict(  # Septic shock
        hr=(118, 128), sbp=(84, 96), dbp=(48, 58), rr=(24, 28), spo2=(92, 95), temp_delta=0.5, gcs=14
    ),
    "p005": dict(  # Complete heart block
        hr=(24, 32), sbp=(68, 80), dbp=(36, 48), rr=(14, 18), spo2=(90, 95), temp_delta=0.0, gcs=14
    ),
    "p006": dict(  # Status epilepticus
        hr=(140, 155), sbp=(140, 158), dbp=(86, 96), rr=(28, 34), spo2=(85, 91), temp_delta=0.3, gcs=6
    ),
    "p007": dict(  # AKI with HTN
        hr=(88, 98), sbp=(178, 195), dbp=(104, 116), rr=(22, 26), spo2=(93, 96), temp_delta=0.1, gcs=15
    ),
    "p008": dict(  # Acute decompensated CHF
        hr=(110, 122), sbp=(82, 96), dbp=(52, 64), rr=(28, 34), spo2=(82, 89), temp_delta=0.0, gcs=14
    ),
}


class PatientVitalsState:
    def __init__(self, patient: Patient):
        self.patient = patient
        self.pid = patient.id
        bl = BASELINES[self.pid]
        self.history: deque[VitalSigns] = deque(maxlen=60)
        self.in_deterioration = False
        self.deterioration_ticks_remaining = 0
        self._baseline = bl
        self._current_hr = float(bl["hr"])
        self._current_sbp = float(bl["sbp"])
        self._current_dbp = float(bl["dbp"])
        self._current_rr = float(bl["rr"])
        self._current_spo2 = float(bl["spo2"])
        self._current_temp = float(bl["temp"])
        self._current_gcs = int(bl["gcs"])
        self._current_pain = int(bl["pain"])

    def _gaussian(self, val: float, sigma: float) -> float:
        return val + random.gauss(0, sigma)

    def tick(self) -> VitalSigns:
        # Check if deterioration event should trigger (3% chance per tick)
        if not self.in_deterioration and random.random() < 0.03:
            self.in_deterioration = True
            self.deterioration_ticks_remaining = random.randint(20, 60)  # 60-180s at 3s ticks

        if self.in_deterioration:
            evt = DETERIORATION_EVENTS[self.pid]
            hr_range = evt["hr"]
            sbp_range = evt["sbp"]
            dbp_range = evt["dbp"]
            rr_range = evt["rr"]
            spo2_range = evt["spo2"]

            # Transition toward deterioration values
            target_hr = random.uniform(*hr_range)
            target_sbp = random.uniform(*sbp_range)
            target_dbp = random.uniform(*dbp_range)
            target_rr = random.uniform(*rr_range)
            target_spo2 = random.uniform(*spo2_range)

            self._current_hr = self._lerp(self._current_hr, target_hr, 0.3) + random.gauss(0, 2)
            self._current_sbp = self._lerp(self._current_sbp, target_sbp, 0.25) + random.gauss(0, 3)
            self._current_dbp = self._lerp(self._current_dbp, target_dbp, 0.25) + random.gauss(0, 2)
            self._current_rr = self._lerp(self._current_rr, target_rr, 0.3) + random.gauss(0, 0.8)
            self._current_spo2 = self._lerp(self._current_spo2, target_spo2, 0.3) + random.gauss(0, 0.5)
            self._current_temp = self._baseline["temp"] + evt.get("temp_delta", 0) + random.gauss(0, 0.05)
            self._current_gcs = evt.get("gcs", self._baseline["gcs"])

            self.deterioration_ticks_remaining -= 1
            if self.deterioration_ticks_remaining <= 0:
                self.in_deterioration = False
        else:
            # Normal physiological noise around baseline
            bl = self._baseline
            self._current_hr = self._gaussian(float(bl["hr"]), 5)
            self._current_sbp = self._gaussian(float(bl["sbp"]), 8)
            self._current_dbp = self._gaussian(float(bl["dbp"]), 4)
            self._current_rr = self._gaussian(float(bl["rr"]), 2)
            self._current_spo2 = self._gaussian(float(bl["spo2"]), 1)
            self._current_temp = self._gaussian(float(bl["temp"]), 0.1)
            self._current_gcs = bl["gcs"]

        # Apply physiological bounds
        hr = max(20.0, min(250.0, self._current_hr))
        sbp = max(40.0, min(280.0, self._current_sbp))
        dbp = max(20.0, min(180.0, self._current_dbp))
        rr = max(2.0, min(60.0, self._current_rr))
        spo2 = max(70.0, min(100.0, self._current_spo2))
        temp = max(33.0, min(42.0, self._current_temp))
        gcs = max(3, min(15, self._current_gcs))

        vitals = VitalSigns(
            patient_id=self.pid,
            timestamp=datetime.now(timezone.utc).isoformat(),
            heart_rate=round(hr, 1),
            systolic_bp=round(sbp, 1),
            diastolic_bp=round(dbp, 1),
            respiratory_rate=round(rr, 1),
            spo2=round(spo2, 1),
            temperature=round(temp, 2),
            gcs=gcs,
            etco2=None,
            pain_score=self._current_pain,
        )
        self.history.append(vitals)
        return vitals

    def _lerp(self, a: float, b: float, t: float) -> float:
        return a + (b - a) * t


class VitalsEngine:
    def __init__(self):
        self._states: dict[str, PatientVitalsState] = {
            p.id: PatientVitalsState(p) for p in SYNTHETIC_PATIENTS
        }
        self._task: Optional[asyncio.Task] = None
        self._subscribers: list[Callable] = []
        # Pre-populate with 20 readings so history is available on startup
        for state in self._states.values():
            for _ in range(20):
                state.tick()

    def subscribe(self, callback: Callable):
        self._subscribers.append(callback)

    def unsubscribe(self, callback: Callable):
        self._subscribers.discard(callback) if hasattr(self._subscribers, 'discard') else None
        if callback in self._subscribers:
            self._subscribers.remove(callback)

    async def _run(self):
        while True:
            for state in self._states.values():
                vitals = state.tick()
                for cb in list(self._subscribers):
                    try:
                        await cb(vitals)
                    except Exception:
                        pass
            await asyncio.sleep(3)

    def start(self):
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._run())

    def get_current_vitals(self, patient_id: str) -> Optional[VitalSigns]:
        state = self._states.get(patient_id)
        if state and state.history:
            return state.history[-1]
        return None

    def get_vitals_history(self, patient_id: str) -> list[VitalSigns]:
        state = self._states.get(patient_id)
        if state:
            return list(state.history)
        return []

    def get_all_current_vitals(self) -> dict[str, VitalSigns]:
        result = {}
        for pid, state in self._states.items():
            if state.history:
                result[pid] = state.history[-1]
        return result

    def is_deteriorating(self, patient_id: str) -> bool:
        state = self._states.get(patient_id)
        return state.in_deterioration if state else False


# Singleton
_engine: Optional[VitalsEngine] = None


def get_vitals_engine() -> VitalsEngine:
    global _engine
    if _engine is None:
        _engine = VitalsEngine()
    return _engine
