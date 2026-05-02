"""SBAR Clinical Handoff Generator using Gemini AI."""
from __future__ import annotations
import json
import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["ai"])

_genai_configured = False


def _configure_genai():
    global _genai_configured
    if _genai_configured:
        return
    import google.generativeai as genai
    base_url = os.environ.get("AI_INTEGRATIONS_GEMINI_BASE_URL", "")
    api_key = os.environ.get("AI_INTEGRATIONS_GEMINI_API_KEY", "")
    if base_url:
        genai.configure(api_key=api_key, transport="rest",
                        client_options={"api_endpoint": base_url})
    else:
        genai.configure(api_key=api_key)
    _genai_configured = True


class HandoffRequest(BaseModel):
    outgoing_provider: str = "Dr. Attending"


async def _generate_sbar(patient_id: str, outgoing_provider: str) -> dict:
    import google.generativeai as genai
    from core.fhir_models import PATIENTS_BY_ID
    from core.vitals_engine import get_vitals_engine
    from core.deterioration import calculate_news2
    from core.lab_data import get_labs_for_patient
    from core.drug_interactions import check_interactions
    from core.alert_state import get_patient_alerts
    from ai.icu_predictor import get_predictor

    patient = PATIENTS_BY_ID.get(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    engine = get_vitals_engine()
    vitals = engine.get_current_vitals(patient_id)
    news2 = calculate_news2(vitals) if vitals else None
    labs = get_labs_for_patient(patient_id)
    interactions = check_interactions(patient.current_medications)
    alerts = get_patient_alerts(patient_id)
    predictor = get_predictor()
    icu = predictor.predict(vitals, patient, news2) if vitals and news2 else None

    critical_labs = [l for l in labs if l.status.value in ("CRITICAL_HIGH", "CRITICAL_LOW")]
    major_interactions = [i for i in interactions if i.severity.value == "MAJOR"]
    active_alerts = [a for a in alerts if not a.acknowledged][:3]

    now_iso = datetime.now(timezone.utc).isoformat()
    ed_hours = (datetime.now(timezone.utc) - datetime.fromisoformat(
        patient.arrival_time.replace("Z", "+00:00"))).total_seconds() / 3600
    urgency = "EMERGENT" if (news2 and news2.score >= 7) else "URGENT" if (news2 and news2.score >= 5) else "ROUTINE"

    context = f"""Patient: {patient.name}, {patient.age}{patient.sex.value}, {patient.chief_complaint}
Bed: {patient.bed} | Attending: {patient.attending} | Code: {patient.code_status.value}
Arrival: {ed_hours:.1f} hours ago
Conditions: {', '.join(patient.active_conditions) or 'None documented'}
Medications: {', '.join(m.name + ' ' + m.dose + ' ' + m.route for m in patient.current_medications[:5]) or 'None'}
Allergies: {', '.join(patient.allergies) or 'NKDA'}
NEWS2: {news2.score if news2 else 'N/A'} ({news2.risk_level.value if news2 else 'N/A'})
Vitals: HR {vitals.heart_rate:.0f}bpm, BP {vitals.systolic_bp:.0f}/{vitals.diastolic_bp:.0f}mmHg, RR {vitals.respiratory_rate:.0f}/min, SpO2 {vitals.spo2:.0f}%, Temp {vitals.temperature:.1f}C, GCS {vitals.gcs}
ICU Risk: {icu.percentage if icu else 'N/A'}% ({icu.risk_category.value if icu else 'N/A'})
Critical Labs: {'; '.join(f"{l.test_name}: {l.value} {l.unit}" for l in critical_labs) or 'None'}
Drug Interactions: {'; '.join(f"{i.drug_a}/{i.drug_b} [{i.severity.value}]" for i in major_interactions) or 'None'}
Active Alerts: {'; '.join(a.title for a in active_alerts) or 'None'}
Outgoing provider: {outgoing_provider}
Urgency: {urgency}"""

    prompt = f"""You are generating an SBAR clinical handoff report for an emergency department physician.
Write in first-person physician voice. Be specific — use actual values from the data. Use real clinical terminology.

Patient Data:
{context}

Generate a complete SBAR handoff. Format as JSON:
{{
  "situation": "2-3 sentences: Dr. [name], I'm calling about [patient]. Current clinical status in one sentence.",
  "background": "Patient history, key medications, allergies, arrival circumstances, top 3 objective findings.",
  "assessment": "Clinical impression: top diagnosis, NEWS2 score, ICU probability, deterioration risk if relevant, drug interactions.",
  "recommendation": "Specific actions needed. What you need the receiving provider to do. End with: Do you have any questions?",
  "urgency": "{urgency}",
  "key_concerns": ["concern 1", "concern 2", "concern 3"],
  "pending_items": ["pending item 1", "pending item 2", "pending item 3"],
  "verbal_summary": "30-second spoken summary in natural English. No jargon. What the next provider needs to know immediately."
}}"""

    _configure_genai()
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
        return {
            "patient_id": patient_id,
            "generated_at": now_iso,
            "outgoing_provider": outgoing_provider,
            "situation": data.get("situation", ""),
            "background": data.get("background", ""),
            "assessment": data.get("assessment", ""),
            "recommendation": data.get("recommendation", ""),
            "urgency": data.get("urgency", urgency),
            "key_concerns": data.get("key_concerns", []),
            "pending_items": data.get("pending_items", []),
            "verbal_summary": data.get("verbal_summary", ""),
        }
    except Exception as e:
        return {
            "patient_id": patient_id,
            "generated_at": now_iso,
            "outgoing_provider": outgoing_provider,
            "situation": f"I'm calling about {patient.name}, {patient.age}{patient.sex.value} in {patient.bed} presenting with {patient.chief_complaint}. Patient has been in the ED for {ed_hours:.1f} hours.",
            "background": f"Patient has {', '.join(patient.active_conditions[:2]) or 'no significant history'}. Current medications include {', '.join(m.name for m in patient.current_medications[:3]) or 'none'}. NEWS2 is {news2.score if news2 else 'unknown'}.",
            "assessment": f"Clinical concern for {patient.chief_complaint}. NEWS2 {news2.score if news2 else 'N/A'}, ICU risk {icu.percentage if icu else 'N/A'}%.",
            "recommendation": "Recommend continued monitoring and reassessment. Do you have any questions?",
            "urgency": urgency,
            "key_concerns": [f"NEWS2 {news2.score if news2 else 0}", f"ICU risk {icu.percentage if icu else 0}%", f"{len(active_alerts)} unacknowledged alerts"],
            "pending_items": ["Review pending labs", "Reassess vitals in 15 minutes", "Update care plan"],
            "verbal_summary": f"Patient {patient.name}, {patient.age}{patient.sex.value}, {patient.chief_complaint}, {ed_hours:.1f} hours in ED. NEWS2 {news2.score if news2 else 0}. ICU risk {icu.percentage if icu else 0}%.",
        }


@router.post("/ai/handoff/{patient_id}")
async def generate_handoff(patient_id: str, req: HandoffRequest = HandoffRequest()):
    from analysis.clinical_timeline import clinical_timeline
    result = await _generate_sbar(patient_id, req.outgoing_provider)
    try:
        clinical_timeline.add_event(patient_id, "HANDOFF", "SBAR Handoff Generated",
                                    f"Handoff generated by {req.outgoing_provider}",
                                    "INFO", "AI", {"urgency": result["urgency"]})
    except Exception:
        pass
    return result


@router.get("/ai/handoff/department")
async def generate_department_handoff():
    from core.fhir_models import SYNTHETIC_PATIENTS
    results = []
    for patient in SYNTHETIC_PATIENTS:
        try:
            result = await _generate_sbar(patient.id, "Outgoing Attending")
            results.append(result)
        except Exception:
            pass
    return results


@router.get("/ai/command/prediction")
async def get_command_prediction():
    import google.generativeai as genai
    from core.fhir_models import SYNTHETIC_PATIENTS
    from core.vitals_engine import get_vitals_engine
    from core.deterioration import calculate_news2
    from ai.deterioration_forecaster import deterioration_forecaster

    engine = get_vitals_engine()
    all_vitals = engine.get_all_current_vitals()
    summaries = []
    for p in SYNTHETIC_PATIENTS:
        v = all_vitals.get(p.id)
        if v:
            n2 = calculate_news2(v)
            fc = deterioration_forecaster.forecast_cache.get(p.id, {})
            summaries.append(
                f"{p.name} ({p.bed}): NEWS2={n2.score}, HR={v.heart_rate:.0f}, "
                f"Forecast={fc.get('intervention_window', 'STABLE')}"
            )

    prompt = f"""You are a charge nurse AI analyzing the emergency department. Current patient status:
{chr(10).join(summaries)}

Provide a brief 3-sentence prediction for the next hour: which patients are most likely to deteriorate, expected ICU transfers, and anticipated discharges. Be specific with patient names and clinical reasoning."""

    _configure_genai()
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        return {"prediction": response.text.strip(), "generated_at": datetime.now(timezone.utc).isoformat()}
    except Exception:
        return {"prediction": "AI prediction temporarily unavailable.", "generated_at": datetime.now(timezone.utc).isoformat()}
