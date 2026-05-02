"""AI differential diagnosis generator using Gemini via Replit AI proxy."""
import json
import os
import time
from datetime import datetime, timezone
from typing import Optional
import google.generativeai as genai

from models.schemas import (
    Patient, VitalSigns, LabResult, NEWS2Result, DrugInteraction,
    DifferentialDiagnosis, DiagnosisItem, DiagnosisProbability, Disposition,
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


# Cache: patient_id -> (timestamp, NEWS2 score, DifferentialDiagnosis)
_cache: dict[str, tuple[float, int, DifferentialDiagnosis]] = {}
_CACHE_TTL = 120  # seconds
_NEWS2_CHANGE_THRESHOLD = 2


def _needs_regeneration(patient_id: str, current_news2: int) -> bool:
    if patient_id not in _cache:
        return True
    ts, cached_news2, _ = _cache[patient_id]
    if time.time() - ts > _CACHE_TTL:
        return True
    if abs(current_news2 - cached_news2) > _NEWS2_CHANGE_THRESHOLD:
        return True
    return False


def _fallback_diagnosis(patient: Patient, vitals: VitalSigns) -> DifferentialDiagnosis:
    """Deterministic fallback when AI is unavailable."""
    return DifferentialDiagnosis(
        patient_id=patient.id,
        generated_at=datetime.now(timezone.utc).isoformat(),
        diagnoses=[
            DiagnosisItem(
                rank=1,
                diagnosis=f"Primary diagnosis for {patient.chief_complaint}",
                icd10_code="R00.0",
                probability=DiagnosisProbability.HIGH,
                probability_percent=60,
                supporting_evidence=[f"Chief complaint: {patient.chief_complaint}", f"Age {patient.age}"],
                against_evidence=[],
                immediate_workup=["CBC", "CMP", "ECG", "Chest X-ray"],
                red_flags=["Monitor NEWS2 score", "Watch for hemodynamic instability"],
            )
        ],
        immediate_actions=["Establish IV access", "Continuous monitoring", "Senior review"],
        disposition_recommendation=Disposition.OBSERVE,
        time_sensitive=vitals.spo2 < 90 or vitals.systolic_bp < 90,
        time_sensitivity_reason="Critical vital signs require urgent attention" if (vitals.spo2 < 90 or vitals.systolic_bp < 90) else None,
    )


async def generate_differential(
    patient: Patient,
    current_vitals: VitalSigns,
    lab_results: list[LabResult],
    news2: NEWS2Result,
    interactions: list[DrugInteraction],
    force: bool = False,
) -> DifferentialDiagnosis:
    if not force and not _needs_regeneration(patient.id, news2.score):
        _, _, cached = _cache[patient.id]
        return cached

    _configure_genai()

    meds_str = ", ".join(f"{m.name} {m.dose} {m.route}" for m in patient.current_medications) or "None"
    conditions_str = ", ".join(patient.active_conditions) or "None"
    allergies_str = ", ".join(patient.allergies) or "NKDA"
    labs_str = "; ".join(
        f"{lr.test_name}: {lr.value} {lr.unit} [{lr.status.value}]" for lr in lab_results[:10]
    ) if lab_results else "Pending"
    interactions_str = "; ".join(
        f"{i.drug_a} + {i.drug_b} ({i.severity.value})" for i in interactions
    ) if interactions else "None detected"

    prompt = f"""You are an expert emergency medicine physician at a Level 1 trauma center. Generate a differential diagnosis.

PATIENT: {patient.age}{patient.sex.value}, {patient.chief_complaint}
Bed: {patient.bed} | MRN: {patient.mrn} | Code: {patient.code_status.value}

VITAL SIGNS:
HR: {current_vitals.heart_rate:.0f} bpm | BP: {current_vitals.systolic_bp:.0f}/{current_vitals.diastolic_bp:.0f} mmHg
RR: {current_vitals.respiratory_rate:.0f}/min | SpO2: {current_vitals.spo2:.0f}% | Temp: {current_vitals.temperature:.1f}°C | GCS: {current_vitals.gcs}
NEWS2 Score: {news2.score} ({news2.risk_level.value})

MEDICATIONS: {meds_str}
CONDITIONS: {conditions_str}
ALLERGIES: {allergies_str}

LAB RESULTS: {labs_str}

DRUG INTERACTIONS DETECTED: {interactions_str}

Respond in this EXACT JSON format only:
{{
  "diagnoses": [
    {{
      "rank": 1,
      "diagnosis": "string",
      "icd10_code": "string",
      "probability": "HIGH|MEDIUM|LOW",
      "probability_percent": 65,
      "supporting_evidence": ["string"],
      "against_evidence": ["string"],
      "immediate_workup": ["string"],
      "red_flags": ["string"]
    }}
  ],
  "immediate_actions": ["string"],
  "disposition_recommendation": "DISCHARGE|OBSERVE|ADMIT_FLOOR|ADMIT_ICU|OR",
  "time_sensitive": true,
  "time_sensitivity_reason": "string or null"
}}

Provide 3-5 diagnoses ranked by probability. Be specific. Use real medical terminology. ICD-10 codes must be accurate.
CRITICAL: Return valid JSON only. No markdown. No code blocks."""

    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        raw = response.text.strip()

        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        data = json.loads(raw)

        diagnoses = []
        for d in data.get("diagnoses", []):
            prob_str = d.get("probability", "LOW").upper()
            prob_map = {"HIGH": DiagnosisProbability.HIGH, "MEDIUM": DiagnosisProbability.MEDIUM, "LOW": DiagnosisProbability.LOW}
            diagnoses.append(DiagnosisItem(
                rank=d.get("rank", len(diagnoses) + 1),
                diagnosis=d.get("diagnosis", "Unknown"),
                icd10_code=d.get("icd10_code", "R69"),
                probability=prob_map.get(prob_str, DiagnosisProbability.LOW),
                probability_percent=min(99, max(1, int(d.get("probability_percent", 30)))),
                supporting_evidence=d.get("supporting_evidence", []),
                against_evidence=d.get("against_evidence", []),
                immediate_workup=d.get("immediate_workup", []),
                red_flags=d.get("red_flags", []),
            ))

        disp_str = data.get("disposition_recommendation", "OBSERVE").upper()
        disp_map = {
            "DISCHARGE": Disposition.DISCHARGE,
            "OBSERVE": Disposition.OBSERVE,
            "ADMIT_FLOOR": Disposition.ADMIT_FLOOR,
            "ADMIT_ICU": Disposition.ADMIT_ICU,
            "OR": Disposition.OR,
        }

        result = DifferentialDiagnosis(
            patient_id=patient.id,
            generated_at=datetime.now(timezone.utc).isoformat(),
            diagnoses=diagnoses,
            immediate_actions=data.get("immediate_actions", []),
            disposition_recommendation=disp_map.get(disp_str, Disposition.OBSERVE),
            time_sensitive=bool(data.get("time_sensitive", False)),
            time_sensitivity_reason=data.get("time_sensitivity_reason"),
        )

        _cache[patient.id] = (time.time(), news2.score, result)
        return result

    except Exception as e:
        # Return fallback on any AI error
        fallback = _fallback_diagnosis(patient, current_vitals)
        _cache[patient.id] = (time.time(), news2.score, fallback)
        return fallback
