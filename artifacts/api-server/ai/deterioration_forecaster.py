"""Deterioration Forecaster — predicts patient deterioration 5-10 min ahead."""
from __future__ import annotations
import asyncio
import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter

router = APIRouter(tags=["forecast"])

PATIENT_IDS = [f"p{str(i).zfill(3)}" for i in range(1, 9)]


def _linear_slope(values: list) -> float:
    n = len(values)
    if n < 2:
        return 0.0
    x_mean = (n - 1) / 2.0
    y_mean = sum(values) / n
    num = sum((i - x_mean) * (v - y_mean) for i, v in enumerate(values))
    den = sum((i - x_mean) ** 2 for i in range(n))
    return num / den if den != 0 else 0.0


def _direction(slope: float, threshold: float = 0.2) -> str:
    if slope > threshold:
        return "WORSENING"
    if slope < -threshold:
        return "IMPROVING"
    return "STABLE"


class DeteriorationForecaster:
    def __init__(self):
        self.vitals_history: dict[str, deque] = {pid: deque(maxlen=20) for pid in PATIENT_IDS}
        self.news2_history: dict[str, deque] = {pid: deque(maxlen=20) for pid in PATIENT_IDS}
        self.forecast_cache: dict[str, dict] = {}

    def forecast_patient(self, patient_id: str) -> Optional[dict]:
        v_hist = list(self.vitals_history.get(patient_id, deque()))
        n_hist = list(self.news2_history.get(patient_id, deque()))
        if len(v_hist) < 3 or not n_hist:
            return None

        def series(key: str) -> list:
            return [float(getattr(v, key, 0) or 0) for v in v_hist]

        hr_s = series("heart_rate")
        sbp_s = series("systolic_bp")
        rr_s = series("respiratory_rate")
        spo2_s = series("spo2")
        temp_s = series("temperature")
        gcs_s = series("gcs")

        hr_slope = _linear_slope(hr_s[-10:])
        sbp_slope = _linear_slope(sbp_s[-10:])
        rr_slope = _linear_slope(rr_s[-10:])
        spo2_slope = _linear_slope(spo2_s[-10:])
        temp_slope = _linear_slope(temp_s[-10:])
        gcs_slope = _linear_slope(gcs_s[-10:])

        news2_vals = [float(x) for x in n_hist]
        news2_slope = _linear_slope(news2_vals) if len(news2_vals) >= 3 else 0.0
        news2_accel = 0.0
        if len(news2_vals) >= 6:
            half = len(news2_vals) // 2
            s1 = _linear_slope(news2_vals[:half])
            s2 = _linear_slope(news2_vals[half:])
            news2_accel = s2 - s1

        current_news2 = int(n_hist[-1])
        predicted_5 = max(0, min(20, int(current_news2 + news2_slope * 10 + 0.5 * news2_accel * 100)))
        predicted_10 = max(0, min(20, int(current_news2 + news2_slope * 20 + 0.5 * news2_accel * 400)))

        if news2_slope > 0.3:
            trajectory = "RAPIDLY_RISING"
        elif news2_slope > 0.05:
            trajectory = "RISING"
        elif news2_slope < -0.3:
            trajectory = "RAPIDLY_FALLING"
        elif news2_slope < -0.05:
            trajectory = "FALLING"
        else:
            trajectory = "STABLE"

        cv = v_hist[-1]
        hr = float(cv.heart_rate)
        sbp = float(cv.systolic_bp)
        rr = float(cv.respiratory_rate)
        spo2 = float(cv.spo2)
        temp = float(cv.temperature)
        gcs = float(cv.gcs)

        # Pattern detection
        sepsis_p = 0.0
        if hr > 100 and rr > 22 and (temp > 38.3 or temp < 36.0):
            base = 0.5
            if hr_slope > 0: base += 0.15
            if rr_slope > 0: base += 0.15
            if temp_slope > 0 or temp_slope < 0: base += 0.1
            sepsis_p = min(1.0, base)

        resp_p = 0.0
        if spo2 < 94 and rr > 25:
            base = 0.5
            if spo2_slope < 0: base += 0.25
            if rr_slope > 0: base += 0.15
            resp_p = min(1.0, base)

        shock_p = 0.0
        if sbp < 100 and hr > 100:
            shock_idx = hr / max(sbp, 1)
            base = min(0.75, shock_idx * 0.4)
            if sbp_slope < -2: base += 0.2
            shock_p = min(1.0, base)

        neuro_p = 0.0
        if gcs_slope < -0.3:
            base = 0.4
            if hr > 100 or sbp < 90: base += 0.3
            neuro_p = min(1.0, base)

        cardiac_p = 0.0
        if (hr < 40 or hr > 150) and sbp < 80:
            base = 0.6
            if news2_slope > 0.5: base += 0.3
            cardiac_p = min(1.0, base)

        patterns = {
            "sepsis": round(sepsis_p, 2),
            "respiratory_failure": round(resp_p, 2),
            "hemodynamic_shock": round(shock_p, 2),
            "neuro_deterioration": round(neuro_p, 2),
            "cardiac_arrest_risk": round(cardiac_p, 2),
        }

        dominant = max(patterns, key=lambda k: patterns[k])
        dominant_prob = patterns[dominant]

        time_to_crit: Optional[float] = None
        if news2_slope > 0.01 and current_news2 < 7:
            readings_to_7 = (7 - current_news2) / news2_slope
            time_to_crit = round(readings_to_7 * 3 / 60, 1)

        if current_news2 >= 7:
            iw = "ACT NOW"
        elif dominant_prob > 0.6 and current_news2 < 7:
            if time_to_crit is not None and time_to_crit < 5:
                iw = "ACT NOW"
            elif time_to_crit is not None and time_to_crit < 10:
                iw = "ACT WITHIN 10 MIN"
            elif time_to_crit is not None and time_to_crit < 20:
                iw = "MONITOR CLOSELY"
            else:
                iw = "STABLE"
        else:
            iw = "STABLE"

        def vf(current_val: float, slope: float) -> dict:
            return {
                "current": round(current_val, 1),
                "predicted_5min": round(current_val + slope * 100, 1),
                "slope": round(slope, 4),
                "direction": _direction(slope),
            }

        confidence = min(0.95, 0.5 + len(v_hist) * 0.025)

        if dominant_prob > 0.6:
            pname = dominant.replace("_", " ").title()
            basis = f"{pname} pattern detected ({int(dominant_prob * 100)}% probability). NEWS2 {trajectory.lower().replace('_', ' ')}."
        elif trajectory in ("RISING", "RAPIDLY_RISING"):
            basis = f"NEWS2 score {trajectory.lower().replace('_', ' ')} (slope={news2_slope:.3f}/reading). Monitor closely."
        else:
            basis = f"Patient stable. NEWS2 {current_news2}/20, trajectory {trajectory.lower().replace('_', ' ')}."

        return {
            "patient_id": patient_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "current_news2": current_news2,
            "predicted_news2_5min": predicted_5,
            "predicted_news2_10min": predicted_10,
            "news2_trajectory": trajectory,
            "news2_history": [int(x) for x in n_hist],
            "vital_forecasts": {
                "heart_rate": vf(hr, hr_slope),
                "systolic_bp": vf(sbp, sbp_slope),
                "respiratory_rate": vf(rr, rr_slope),
                "spo2": vf(spo2, spo2_slope),
                "temperature": vf(temp, temp_slope),
                "gcs": vf(gcs, gcs_slope),
            },
            "patterns": patterns,
            "dominant_pattern": dominant if dominant_prob > 0.3 else None,
            "dominant_pattern_probability": round(dominant_prob, 2),
            "intervention_window": iw,
            "time_to_critical_minutes": time_to_crit,
            "confidence": round(confidence, 2),
            "forecast_basis": basis,
        }

    async def run_continuous(self):
        from core.vitals_engine import get_vitals_engine
        from core.deterioration import calculate_news2
        from analysis.clinical_timeline import clinical_timeline
        while True:
            try:
                engine = get_vitals_engine()
                all_vitals = engine.get_all_current_vitals()
                for pid, vitals in all_vitals.items():
                    if pid not in self.vitals_history:
                        self.vitals_history[pid] = deque(maxlen=20)
                        self.news2_history[pid] = deque(maxlen=20)
                    self.vitals_history[pid].append(vitals)
                    news2 = calculate_news2(vitals)
                    self.news2_history[pid].append(news2.score)
                    result = self.forecast_patient(pid)
                    if result:
                        prev = self.forecast_cache.get(pid, {})
                        self.forecast_cache[pid] = result
                        if (result["intervention_window"] == "ACT NOW" and
                                prev.get("intervention_window") != "ACT NOW"):
                            try:
                                clinical_timeline.add_event(
                                    pid, "FORECAST_CRITICAL",
                                    f"AI Forecast: ACT NOW",
                                    result["forecast_basis"],
                                    "CRITICAL", "AI",
                                    {"intervention_window": "ACT NOW",
                                     "news2": result["current_news2"]}
                                )
                            except Exception:
                                pass
            except Exception:
                pass
            await asyncio.sleep(15)


deterioration_forecaster = DeteriorationForecaster()


@router.get("/forecast/all", tags=["forecast"])
def get_all_forecasts():
    return list(deterioration_forecaster.forecast_cache.values())


@router.get("/forecast/critical", tags=["forecast"])
def get_critical_forecasts():
    return [f for f in deterioration_forecaster.forecast_cache.values()
            if f.get("intervention_window") != "STABLE"]


@router.get("/forecast/{patient_id}", tags=["forecast"])
def get_forecast(patient_id: str):
    cached = deterioration_forecaster.forecast_cache.get(patient_id)
    if cached:
        return cached
    return {
        "patient_id": patient_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "current_news2": 0,
        "predicted_news2_5min": 0,
        "predicted_news2_10min": 0,
        "news2_trajectory": "STABLE",
        "news2_history": [],
        "vital_forecasts": {},
        "patterns": {"sepsis": 0, "respiratory_failure": 0, "hemodynamic_shock": 0,
                     "neuro_deterioration": 0, "cardiac_arrest_risk": 0},
        "dominant_pattern": None,
        "dominant_pattern_probability": 0,
        "intervention_window": "STABLE",
        "time_to_critical_minutes": None,
        "confidence": 0,
        "forecast_basis": "Insufficient data for forecast.",
    }
