"""NEWS2 (National Early Warning Score 2) — exact NHS clinical standard implementation."""
from models.schemas import VitalSigns, NEWS2Result, NEWS2ComponentScores, DeteriorationTrend, RiskLevel
from typing import List


def _score_respiratory_rate(rr: float) -> int:
    if rr <= 8:
        return 3
    elif rr <= 11:
        return 1
    elif rr <= 20:
        return 0
    elif rr <= 24:
        return 2
    else:
        return 3


def _score_spo2(spo2: float) -> int:
    if spo2 <= 91:
        return 3
    elif spo2 <= 93:
        return 2
    elif spo2 <= 95:
        return 1
    else:
        return 0


def _score_systolic_bp(sbp: float) -> int:
    if sbp <= 90:
        return 3
    elif sbp <= 100:
        return 2
    elif sbp <= 110:
        return 1
    elif sbp <= 219:
        return 0
    else:
        return 3


def _score_heart_rate(hr: float) -> int:
    if hr <= 40:
        return 3
    elif hr <= 50:
        return 1
    elif hr <= 90:
        return 0
    elif hr <= 110:
        return 1
    elif hr <= 130:
        return 2
    else:
        return 3


def _score_consciousness(gcs: int) -> int:
    if gcs == 15:
        return 0  # Alert
    elif gcs >= 13:
        return 3  # Confusion
    else:
        return 3  # Pain/Unresponsive


def _score_temperature(temp: float) -> int:
    if temp <= 35.0:
        return 3
    elif temp <= 36.0:
        return 1
    elif temp <= 38.0:
        return 0
    elif temp <= 39.0:
        return 1
    else:
        return 2


def calculate_news2(vitals: VitalSigns) -> NEWS2Result:
    rr_score = _score_respiratory_rate(vitals.respiratory_rate)
    spo2_score = _score_spo2(vitals.spo2)
    sbp_score = _score_systolic_bp(vitals.systolic_bp)
    hr_score = _score_heart_rate(vitals.heart_rate)
    gcs_score = _score_consciousness(vitals.gcs)
    temp_score = _score_temperature(vitals.temperature)

    total = rr_score + spo2_score + sbp_score + hr_score + gcs_score + temp_score

    # Any single parameter at 3 = MEDIUM minimum
    max_single = max(rr_score, spo2_score, sbp_score, hr_score, gcs_score, temp_score)

    if total >= 7:
        risk_level = RiskLevel.HIGH
        recommended_action = "Emergency response — continuous monitoring, senior physician review NOW"
        escalation_required = True
        monitoring_frequency = "Continuous"
    elif total >= 5 or max_single >= 3:
        risk_level = RiskLevel.MEDIUM
        recommended_action = "Urgent review by ward-based doctor within 1 hour"
        escalation_required = True
        monitoring_frequency = "Every 1 hour"
    elif total >= 1:
        risk_level = RiskLevel.LOW
        recommended_action = "Inform registered nurse — increase monitoring frequency"
        escalation_required = False
        monitoring_frequency = "Every 4-6 hours"
    else:
        risk_level = RiskLevel.LOW
        recommended_action = "Continue routine monitoring"
        escalation_required = False
        monitoring_frequency = "Every 12 hours"

    return NEWS2Result(
        score=total,
        risk_level=risk_level,
        component_scores=NEWS2ComponentScores(
            respiratory_rate=rr_score,
            spo2=spo2_score,
            systolic_bp=sbp_score,
            heart_rate=hr_score,
            consciousness=gcs_score,
            temperature=temp_score,
        ),
        recommended_action=recommended_action,
        escalation_required=escalation_required,
        monitoring_frequency=monitoring_frequency,
    )


def detect_deterioration_trend(
    history: List[VitalSigns],
    window_minutes: int = 10,
) -> DeteriorationTrend:
    if len(history) < 3:
        return DeteriorationTrend(
            is_deteriorating=False,
            trend_direction="STABLE",
            rate_of_change={},
            predicted_news_in_5min=0,
            confidence=0.0,
        )

    recent = history[-min(20, len(history)):]
    first = recent[0]
    last = recent[-1]
    n = len(recent)

    def slope(values: List[float]) -> float:
        if n < 2:
            return 0.0
        xs = list(range(n))
        x_mean = sum(xs) / n
        y_mean = sum(values) / n
        num = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, values))
        den = sum((x - x_mean) ** 2 for x in xs)
        return num / den if den != 0 else 0.0

    hr_vals = [v.heart_rate for v in recent]
    rr_vals = [v.respiratory_rate for v in recent]
    spo2_vals = [v.spo2 for v in recent]
    sbp_vals = [v.systolic_bp for v in recent]

    rate_of_change = {
        "heart_rate": slope(hr_vals),
        "respiratory_rate": slope(rr_vals),
        "spo2": slope(spo2_vals),
        "systolic_bp": slope(sbp_vals),
    }

    # Project NEWS2 5 minutes ahead (~100 readings at 3s each ≈ 16 readings)
    future_vitals = VitalSigns(
        patient_id=last.patient_id,
        timestamp=last.timestamp,
        heart_rate=max(20, min(250, last.heart_rate + rate_of_change["heart_rate"] * 16)),
        systolic_bp=max(40, min(280, last.systolic_bp + rate_of_change["systolic_bp"] * 16)),
        diastolic_bp=last.diastolic_bp,
        respiratory_rate=max(2, min(60, last.respiratory_rate + rate_of_change["respiratory_rate"] * 16)),
        spo2=max(70, min(100, last.spo2 + rate_of_change["spo2"] * 16)),
        temperature=last.temperature,
        gcs=last.gcs,
        pain_score=last.pain_score,
    )

    predicted_news = calculate_news2(future_vitals)
    current_news = calculate_news2(last)

    news_delta = predicted_news.score - current_news.score
    is_deteriorating = news_delta > 1

    if news_delta > 2:
        trend_direction = "WORSENING"
    elif news_delta < -2:
        trend_direction = "IMPROVING"
    else:
        trend_direction = "STABLE"

    confidence = min(0.95, 0.5 + (n / 40) * 0.45)

    return DeteriorationTrend(
        is_deteriorating=is_deteriorating,
        trend_direction=trend_direction,
        rate_of_change=rate_of_change,
        predicted_news_in_5min=predicted_news.score,
        confidence=confidence,
    )
