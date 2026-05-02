"""Session Recorder — risk snapshot history per patient."""
from __future__ import annotations
import asyncio
from collections import deque
from datetime import datetime, timezone
from fastapi import APIRouter

router = APIRouter(tags=["history"])

PATIENT_IDS = [f"p{str(i).zfill(3)}" for i in range(1, 9)]

_snapshots: dict[str, deque] = {pid: deque(maxlen=120) for pid in PATIENT_IDS}


async def run_continuous():
    from core.vitals_engine import get_vitals_engine
    from core.deterioration import calculate_news2
    from core.alert_state import get_patient_alerts
    from ai.icu_predictor import get_predictor
    from ai.deterioration_forecaster import deterioration_forecaster

    await asyncio.sleep(12)
    while True:
        try:
            engine = get_vitals_engine()
            all_vitals = engine.get_all_current_vitals()
            predictor = get_predictor()
            from core.fhir_models import PATIENTS_BY_ID
            for pid, vitals in all_vitals.items():
                patient = PATIENTS_BY_ID.get(pid)
                if not patient:
                    continue
                news2 = calculate_news2(vitals)
                icu = predictor.predict(vitals, patient, news2)
                alerts = get_patient_alerts(pid)
                unack = sum(1 for a in alerts if not a.acknowledged)
                fc = deterioration_forecaster.forecast_cache.get(pid, {})
                snapshot = {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "news2": news2.score,
                    "icu_probability": icu.probability,
                    "dominant_pattern": fc.get("dominant_pattern"),
                    "pattern_probability": fc.get("dominant_pattern_probability", 0.0),
                    "alert_count": unack,
                    "intervention_window": fc.get("intervention_window", "STABLE"),
                }
                if pid not in _snapshots:
                    _snapshots[pid] = deque(maxlen=120)
                _snapshots[pid].append(snapshot)
        except Exception:
            pass
        await asyncio.sleep(30)


@router.get("/history/{patient_id}/risk")
def get_risk_history(patient_id: str):
    return list(_snapshots.get(patient_id, deque()))
