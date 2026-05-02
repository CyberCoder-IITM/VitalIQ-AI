"""AI Triage Agent — analyzes all 8 patients and generates priority ranking every 15 seconds."""
import json
import os
import time
import uuid
import asyncio
from datetime import datetime, timezone
from typing import Optional
import google.generativeai as genai

from models.schemas import (
    Patient, VitalSigns, NEWS2Result,
    TriageCycle, TriagePriorityItem, CriticalAction,
    PhysicianFocus, DepartmentStatus,
)
from core.fhir_models import SYNTHETIC_PATIENTS, PATIENTS_BY_ID

_configured = False


def _configure_genai():
    global _configured
    if _configured:
        return
    base_url = os.environ.get("AI_INTEGRATIONS_GEMINI_BASE_URL", "")
    api_key = os.environ.get("AI_INTEGRATIONS_GEMINI_API_KEY", "")
    if base_url:
        genai.configure(
            api_key=api_key,
            transport="rest",
            client_options={"api_endpoint": base_url},
        )
    else:
        genai.configure(api_key=api_key)
    _configured = True


_triage_history: list[TriageCycle] = []
_MAX_HISTORY = 20
_last_cycle_time = 0.0
_CYCLE_INTERVAL = 15  # seconds


def _fallback_triage(
    all_vitals: dict[str, VitalSigns],
    all_news2: dict[str, NEWS2Result],
) -> TriageCycle:
    """Deterministic fallback triage when AI is unavailable."""
    patient_scores = []
    for patient in SYNTHETIC_PATIENTS:
        v = all_vitals.get(patient.id)
        n = all_news2.get(patient.id)
        if v and n:
            patient_scores.append((n.score, patient))

    patient_scores.sort(key=lambda x: x[0], reverse=True)

    priority_ranking = []
    for i, (score, patient) in enumerate(patient_scores[:8]):
        n = all_news2.get(patient.id)
        v = all_vitals.get(patient.id)
        urgency = f"NEWS2 score {score}"
        if n and n.risk_level.value == "HIGH":
            urgency = f"NEWS2 {score} — HIGH RISK: {n.recommended_action}"
        elif v and v.spo2 < 90:
            urgency = f"SpO2 critical at {v.spo2:.0f}%"
        priority_ranking.append(TriagePriorityItem(
            rank=i + 1,
            patient_id=patient.id,
            name=patient.name,
            urgency_reason=urgency,
            recommended_action=n.recommended_action if n else "Assess immediately",
            time_to_act_minutes=5 if score >= 7 else (30 if score >= 5 else 60),
        ))

    top = patient_scores[0][1] if patient_scores else SYNTHETIC_PATIENTS[0]
    top_news = all_news2.get(top.id)
    high_risk_count = sum(1 for s, _ in patient_scores if s >= 5)
    dept_status = DepartmentStatus.CRITICAL_LOAD if high_risk_count >= 3 else (
        DepartmentStatus.BUSY if high_risk_count >= 1 else DepartmentStatus.CONTROLLED
    )

    stable = [
        p.id for p in SYNTHETIC_PATIENTS
        if all_news2.get(p.id) and all_news2[p.id].score <= 2
    ]

    return TriageCycle(
        cycle_id=str(uuid.uuid4()),
        timestamp=datetime.now(timezone.utc).isoformat(),
        priority_ranking=priority_ranking,
        critical_actions=[CriticalAction(
            patient_id=top.id,
            action=top_news.recommended_action if top_news else "Immediate assessment",
            rationale=f"NEWS2 score {patient_scores[0][0] if patient_scores else 0}",
            time_critical=True,
        )],
        physician_focus=PhysicianFocus(
            patient_id=top.id,
            name=top.name,
            reason="Highest NEWS2 Score",
            specific_concern=f"{top.chief_complaint} — NEWS2 {patient_scores[0][0] if patient_scores else 0}",
        ),
        stable_patients=stable,
        department_status=dept_status,
        cycle_summary=f"{high_risk_count} high-acuity patients. {dept_status.value} status.",
    )


async def run_triage_cycle(
    all_vitals: dict[str, VitalSigns],
    all_news2: dict[str, NEWS2Result],
    force: bool = False,
) -> TriageCycle:
    global _last_cycle_time

    now = time.time()
    if not force and _triage_history and (now - _last_cycle_time) < _CYCLE_INTERVAL:
        return _triage_history[-1]

    _configure_genai()

    patients_data = []
    for patient in SYNTHETIC_PATIENTS:
        v = all_vitals.get(patient.id)
        n = all_news2.get(patient.id)
        if v and n:
            patients_data.append({
                "id": patient.id,
                "name": patient.name,
                "age": patient.age,
                "sex": patient.sex.value,
                "bed": patient.bed,
                "chief_complaint": patient.chief_complaint,
                "acuity_esi": patient.acuity,
                "code_status": patient.code_status.value,
                "conditions": patient.active_conditions,
                "medications_count": len(patient.current_medications),
                "vitals": {
                    "HR": f"{v.heart_rate:.0f}",
                    "BP": f"{v.systolic_bp:.0f}/{v.diastolic_bp:.0f}",
                    "RR": f"{v.respiratory_rate:.0f}",
                    "SpO2": f"{v.spo2:.0f}%",
                    "Temp": f"{v.temperature:.1f}°C",
                    "GCS": v.gcs,
                },
                "news2_score": n.score,
                "news2_risk": n.risk_level.value,
                "news2_action": n.recommended_action,
            })

    prompt = f"""You are an emergency medicine AI triage agent managing an ED with 8 patients simultaneously.
Your job is to help the attending physician prioritize their attention RIGHT NOW.

CURRENT ED STATUS ({len(patients_data)} patients):
{json.dumps(patients_data, indent=2)}

Analyze each patient's acuity, vital signs, NEWS2 score, and clinical trajectory. Determine:
1. Priority ranking (1 = needs physician NOW)
2. Critical actions required in the next 5 minutes
3. Who the physician should be physically standing next to right now
4. Overall department status

Respond in EXACT JSON format (no markdown, no code blocks):
{{
  "priority_ranking": [
    {{
      "rank": 1,
      "patient_id": "p001",
      "name": "string",
      "urgency_reason": "string — specific clinical reason",
      "recommended_action": "specific action string",
      "time_to_act_minutes": 5
    }}
  ],
  "critical_actions": [
    {{
      "patient_id": "p001",
      "action": "specific action string",
      "rationale": "why now",
      "time_critical": true
    }}
  ],
  "physician_focus": {{
    "patient_id": "p001",
    "name": "Patient Name",
    "reason": "Specific brief reason",
    "specific_concern": "specific clinical concern"
  }},
  "stable_patients": ["p007", "p004"],
  "department_status": "CONTROLLED|BUSY|CRITICAL_LOAD",
  "cycle_summary": "One sentence department overview for the attending"
}}

department_status:
- CONTROLLED: all patients stable, NEWS2 all < 3
- BUSY: 1-2 medium risk patients, manageable
- CRITICAL_LOAD: 3+ high-risk patients, physician overwhelmed

Return all 8 patients in priority_ranking. Be specific with clinical reasoning. Return valid JSON only."""

    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        raw = response.text.strip()

        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        data = json.loads(raw)

        priority_ranking = []
        for item in data.get("priority_ranking", []):
            priority_ranking.append(TriagePriorityItem(
                rank=item.get("rank", len(priority_ranking) + 1),
                patient_id=item.get("patient_id", ""),
                name=item.get("name", ""),
                urgency_reason=item.get("urgency_reason", ""),
                recommended_action=item.get("recommended_action", ""),
                time_to_act_minutes=int(item.get("time_to_act_minutes", 60)),
            ))

        critical_actions = []
        for action in data.get("critical_actions", []):
            critical_actions.append(CriticalAction(
                patient_id=action.get("patient_id", ""),
                action=action.get("action", ""),
                rationale=action.get("rationale", ""),
                time_critical=bool(action.get("time_critical", False)),
            ))

        focus_data = data.get("physician_focus", {})
        physician_focus = PhysicianFocus(
            patient_id=focus_data.get("patient_id", SYNTHETIC_PATIENTS[0].id),
            name=focus_data.get("name", SYNTHETIC_PATIENTS[0].name),
            reason=focus_data.get("reason", "Highest acuity"),
            specific_concern=focus_data.get("specific_concern", "Requires immediate assessment"),
        )

        dept_str = data.get("department_status", "CONTROLLED").upper()
        dept_map = {
            "CONTROLLED": DepartmentStatus.CONTROLLED,
            "BUSY": DepartmentStatus.BUSY,
            "CRITICAL_LOAD": DepartmentStatus.CRITICAL_LOAD,
        }
        dept_status = dept_map.get(dept_str, DepartmentStatus.BUSY)

        stable_patients = [p for p in data.get("stable_patients", []) if p in PATIENTS_BY_ID]

        cycle = TriageCycle(
            cycle_id=str(uuid.uuid4()),
            timestamp=datetime.now(timezone.utc).isoformat(),
            priority_ranking=priority_ranking,
            critical_actions=critical_actions,
            physician_focus=physician_focus,
            stable_patients=stable_patients,
            department_status=dept_status,
            cycle_summary=data.get("cycle_summary", "Department status update complete."),
        )

    except Exception:
        cycle = _fallback_triage(all_vitals, all_news2)

    _triage_history.append(cycle)
    if len(_triage_history) > _MAX_HISTORY:
        _triage_history.pop(0)
    _last_cycle_time = time.time()
    return cycle


def get_triage_history() -> list[TriageCycle]:
    return list(_triage_history)


def get_latest_triage() -> Optional[TriageCycle]:
    return _triage_history[-1] if _triage_history else None
