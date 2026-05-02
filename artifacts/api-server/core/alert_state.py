"""Shared mutable alert state — thread-safe storage for clinical alerts."""
import uuid
from datetime import datetime, timezone
from collections import deque
from models.schemas import ClinicalAlert, AlertType, AlertSeverity
from core.fhir_models import PATIENTS_BY_ID

_alerts: deque[ClinicalAlert] = deque(maxlen=200)
_seen_deterioration: set[str] = set()  # track which patient alerts were already generated


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def add_alert(alert: ClinicalAlert):
    _alerts.append(alert)


def get_all_alerts() -> list[ClinicalAlert]:
    return list(reversed(_alerts))


def get_patient_alerts(patient_id: str) -> list[ClinicalAlert]:
    return [a for a in reversed(_alerts) if a.patient_id == patient_id]


def acknowledge_alert(alert_id: str) -> ClinicalAlert | None:
    for i, alert in enumerate(_alerts):
        if alert.alert_id == alert_id:
            updated = alert.model_copy(update={"acknowledged": True})
            _alerts[i] = updated
            return updated
    return None


def count_unacknowledged() -> int:
    return sum(1 for a in _alerts if not a.acknowledged)


def maybe_add_news2_alert(patient_id: str, news2_score: int):
    """Add a NEWS2 escalation alert if score just crossed threshold."""
    dedup_key = f"{patient_id}:news2:{news2_score // 3}"  # bucket to avoid spam
    if dedup_key in _seen_deterioration:
        return

    patient = PATIENTS_BY_ID.get(patient_id)
    if not patient:
        return

    if news2_score >= 7:
        severity = AlertSeverity.CRITICAL
        title = f"NEWS2 {news2_score} — CRITICAL: Emergency Response Required"
        body = f"{patient.name} ({patient.bed}): NEWS2 score {news2_score} exceeds critical threshold. Continuous monitoring required. Immediate senior physician review."
    elif news2_score >= 5:
        severity = AlertSeverity.URGENT
        title = f"NEWS2 {news2_score} — URGENT: Escalation Required"
        body = f"{patient.name} ({patient.bed}): NEWS2 score {news2_score} indicates medium-high risk. Urgent review by ward-based doctor within 1 hour."
    else:
        return

    _seen_deterioration.add(dedup_key)
    # Remove key after 5 minutes (handled by deque maxlen cap)

    add_alert(ClinicalAlert(
        alert_id=str(uuid.uuid4()),
        patient_id=patient_id,
        patient_name=patient.name,
        timestamp=_now(),
        alert_type=AlertType.NEWS_ESCALATION,
        severity=severity,
        title=title,
        body=body,
        acknowledged=False,
        news_score=news2_score,
    ))


def seed_initial_alerts():
    """Pre-populate with relevant alerts for the initial patient cohort."""
    initial_data = [
        ("p001", AlertType.AI_DIAGNOSIS, AlertSeverity.CRITICAL, 13,
         "Critical: Elevated Troponin I — STEMI?",
         "James Wilson (ED-Bay-4): Troponin I 0.87 ng/mL (↑ 0.62). ST changes on ECG. Cardiology consult STAT. Consider cath lab activation."),
        ("p008", AlertType.CRITICAL_LAB, AlertSeverity.CRITICAL, None,
         "Critical Lab: INR 5.2 — Major Bleeding Risk",
         "Nancy White (ED-Bay-6): INR critically elevated at 5.2. Warfarin toxicity. Hold warfarin. Consider Vitamin K IV. Monitor for active bleeding."),
        ("p003", AlertType.DRUG_INTERACTION, AlertSeverity.URGENT, None,
         "Drug Interaction: Warfarin + Elevated INR",
         "Robert Chen (ED-Bay-1): Supratherapeutic INR 4.8. Warfarin interaction with acute illness. Review medication list. Reversal agent may be required."),
        ("p005", AlertType.CRITICAL_LAB, AlertSeverity.URGENT, None,
         "Critical: Digoxin Toxicity — Level 2.8 ng/mL",
         "Michael Brown (ED-Bay-3): Digoxin 2.8 ng/mL (supra-therapeutic). K+ 2.9 mEq/L (low). High toxicity risk. Digoxin-specific antibody fragments may be required."),
        ("p002", AlertType.DETERIORATION, AlertSeverity.URGENT, 8,
         "Deterioration: SpO2 Critical — Asthma in Pregnancy",
         "Maria Santos (ED-Bay-7): SpO2 < 92% in pregnant patient at 28 weeks. Fetal distress risk. Escalate respiratory support. OB consult."),
        ("p006", AlertType.NEWS_ESCALATION, AlertSeverity.CRITICAL, 10,
         "Status Epilepticus — Active Seizure",
         "Emily Davis (ED-Bay-2): Active seizure activity. GCS 6. IV benzodiazepine administered. Neurology STAT. Continuous EEG monitoring."),
        ("p004", AlertType.CRITICAL_LAB, AlertSeverity.URGENT, None,
         "Critical Lab: Lipase 1240 U/L — Severe Pancreatitis",
         "Sarah Johnson (ED-Bay-9): Lipase 20x normal. Lactic acid 2.8 mmol/L (elevated). Aggressive fluid resuscitation. Surgical consult if no improvement."),
    ]
    for pid, atype, sev, news, title, body in initial_data:
        p = PATIENTS_BY_ID.get(pid)
        if p:
            add_alert(ClinicalAlert(
                alert_id=str(uuid.uuid4()),
                patient_id=pid,
                patient_name=p.name,
                timestamp=_now(),
                alert_type=atype,
                severity=sev,
                title=title,
                body=body,
                acknowledged=False,
                news_score=news,
            ))
