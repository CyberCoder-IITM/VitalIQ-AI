"""Auto-generates clinical SOAP notes from patient data using Gemini."""
import json
import os
import time
from datetime import datetime, timezone
import google.generativeai as genai

from models.schemas import (
    Patient, VitalSigns, LabResult, DifferentialDiagnosis,
    NEWS2Result, SOAPNote, MDMLevel,
)

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


ATTESTATION_TEMPLATE = (
    "I have personally evaluated this patient, reviewed all available data, and agree with the documentation above. "
    "This note represents my independent medical decision-making. "
    "Patient was seen and examined by me, and all clinical decisions were made under my direct supervision."
)


def _word_count(text: str) -> int:
    return len(text.split())


async def generate_soap_note(
    patient: Patient,
    vitals: VitalSigns,
    labs: list[LabResult],
    differential: DifferentialDiagnosis,
    news2: NEWS2Result,
) -> SOAPNote:
    _configure_genai()
    start_ms = int(time.time() * 1000)

    meds_str = "; ".join(f"{m.name} {m.dose} {m.route} {m.frequency}" for m in patient.current_medications) or "None"
    labs_str = "\n".join(
        f"  {lr.test_name}: {lr.value} {lr.unit} (ref {lr.reference_low}-{lr.reference_high}) [{lr.status.value}]"
        for lr in labs[:12]
    ) if labs else "  Pending"

    dx_list = "\n".join(
        f"  {d.rank}. {d.diagnosis} ({d.icd10_code}) — {d.probability.value} probability ({d.probability_percent}%)"
        for d in differential.diagnoses[:3]
    )

    patient_json = {
        "id": patient.id,
        "name": patient.name,
        "age": patient.age,
        "sex": patient.sex.value,
        "chief_complaint": patient.chief_complaint,
        "bed": patient.bed,
        "arrival_time": patient.arrival_time,
        "code_status": patient.code_status.value,
        "allergies": patient.allergies,
        "medications": meds_str,
        "conditions": patient.active_conditions,
        "vitals": {
            "HR": f"{vitals.heart_rate:.0f} bpm",
            "BP": f"{vitals.systolic_bp:.0f}/{vitals.diastolic_bp:.0f} mmHg",
            "RR": f"{vitals.respiratory_rate:.0f}/min",
            "SpO2": f"{vitals.spo2:.0f}%",
            "Temp": f"{vitals.temperature:.1f}°C",
            "GCS": vitals.gcs,
            "Pain": f"{vitals.pain_score}/10",
        },
        "news2_score": news2.score,
        "news2_risk": news2.risk_level.value,
        "labs": labs_str,
        "differential": dx_list,
        "disposition": differential.disposition_recommendation.value,
    }

    prompt = f"""You are an experienced emergency medicine physician writing a clinical SOAP note for the medical record.
Write in professional medical documentation style. Use standard medical abbreviations.

PATIENT DATA:
{json.dumps(patient_json, indent=2)}

The note must be:
- Clinically accurate and complete
- Appropriate for medicolegal documentation
- Written as if by the attending physician  
- Include specific values from the vitals and labs
- Written in 3rd person ("The patient presents with...")

Format EXACTLY as JSON (no markdown, no code blocks):
{{
  "subjective": "Complete narrative of chief complaint, HPI, symptoms, pertinent positives and negatives",
  "objective": "Complete vitals, pertinent lab results, relevant physical exam findings",
  "assessment": "Clinical reasoning and differential diagnosis with working diagnosis",
  "plan": "Specific workup ordered, treatments initiated, disposition plan, follow-up instructions",
  "mdm_level": "LOW|MODERATE|HIGH"
}}

MDM Level criteria:
- LOW: straightforward problem, 1-2 diagnoses, self-limited, minimal risk management
- MODERATE: multiple diagnoses, prescription drug management, new presenting problem with uncertain prognosis
- HIGH: complex diagnoses, life-threatening condition, threat to function, ICU-level decisions required

Return valid JSON only."""

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

        mdm_str = data.get("mdm_level", "MODERATE").upper()
        mdm_map = {"LOW": MDMLevel.LOW, "MODERATE": MDMLevel.MODERATE, "HIGH": MDMLevel.HIGH}
        mdm = mdm_map.get(mdm_str, MDMLevel.MODERATE)

        subj = data.get("subjective", "")
        obj = data.get("objective", "")
        assess = data.get("assessment", "")
        plan = data.get("plan", "")

        generated_in_ms = int(time.time() * 1000) - start_ms
        total_words = _word_count(subj) + _word_count(obj) + _word_count(assess) + _word_count(plan)

        return SOAPNote(
            patient_id=patient.id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            subjective=subj,
            objective=obj,
            assessment=assess,
            plan=plan,
            mdm_level=mdm,
            attestation=ATTESTATION_TEMPLATE,
            word_count=total_words,
            generated_in_ms=generated_in_ms,
        )

    except Exception:
        # Fallback SOAP note
        generated_in_ms = int(time.time() * 1000) - start_ms
        subj = (
            f"{patient.name} is a {patient.age}-year-old {patient.sex.value} who presents to the emergency department "
            f"with a chief complaint of {patient.chief_complaint}. Patient arrived at {patient.arrival_time}."
        )
        obj = (
            f"VITAL SIGNS: HR {vitals.heart_rate:.0f} bpm, BP {vitals.systolic_bp:.0f}/{vitals.diastolic_bp:.0f} mmHg, "
            f"RR {vitals.respiratory_rate:.0f}/min, SpO2 {vitals.spo2:.0f}%, Temp {vitals.temperature:.1f}°C, GCS {vitals.gcs}. "
            f"NEWS2 Score: {news2.score} ({news2.risk_level.value} risk). "
            f"MEDICATIONS: {meds_str}. ALLERGIES: {', '.join(patient.allergies) or 'NKDA'}."
        )
        assess = f"Working diagnosis: {differential.diagnoses[0].diagnosis if differential.diagnoses else patient.chief_complaint}. " + "; ".join(
            f"{d.rank}. {d.diagnosis}" for d in differential.diagnoses[:3]
        )
        plan = (
            f"Disposition recommendation: {differential.disposition_recommendation.value}. "
            "Initiate workup as indicated. Continue monitoring. Reassess as clinical situation evolves."
        )
        total_words = _word_count(subj) + _word_count(obj) + _word_count(assess) + _word_count(plan)
        return SOAPNote(
            patient_id=patient.id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            subjective=subj,
            objective=obj,
            assessment=assess,
            plan=plan,
            mdm_level=MDMLevel.MODERATE,
            attestation=ATTESTATION_TEMPLATE,
            word_count=total_words,
            generated_in_ms=generated_in_ms,
        )
