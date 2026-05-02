import asyncio
from fastapi import APIRouter, HTTPException
from models.schemas import (
    DifferentialDiagnosis, SOAPNote, ICUPrediction,
    TriageCycle, TriagePriorityItem, ClinicalQueryRequest, ClinicalQueryResponse,
)
from core.fhir_models import PATIENTS_BY_ID, SYNTHETIC_PATIENTS
from core.vitals_engine import get_vitals_engine
from core.deterioration import calculate_news2
from core.lab_data import get_labs_for_patient
from core.drug_interactions import check_interactions
from ai.diagnosis_engine import generate_differential
from ai.note_generator import generate_soap_note
from ai.icu_predictor import get_predictor
from ai.triage_agent import run_triage_cycle, get_triage_history, get_latest_triage
import os
import json
import google.generativeai as genai

router = APIRouter(tags=["ai"])

_genai_configured = False


def _configure_genai():
    global _genai_configured
    if _genai_configured:
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
    _genai_configured = True


@router.post("/ai/diagnosis/{patient_id}", response_model=DifferentialDiagnosis)
async def generate_diagnosis_endpoint(patient_id: str):
    patient = PATIENTS_BY_ID.get(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    engine = get_vitals_engine()
    vitals = engine.get_current_vitals(patient_id)
    if not vitals:
        raise HTTPException(status_code=503, detail="Vitals not available yet")

    news2 = calculate_news2(vitals)
    labs = get_labs_for_patient(patient_id)
    interactions = check_interactions(patient.current_medications)

    return await generate_differential(patient, vitals, labs, news2, interactions, force=True)


@router.post("/ai/soap/{patient_id}", response_model=SOAPNote)
async def generate_soap_endpoint(patient_id: str):
    patient = PATIENTS_BY_ID.get(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    engine = get_vitals_engine()
    vitals = engine.get_current_vitals(patient_id)
    if not vitals:
        raise HTTPException(status_code=503, detail="Vitals not available yet")

    news2 = calculate_news2(vitals)
    labs = get_labs_for_patient(patient_id)
    interactions = check_interactions(patient.current_medications)
    differential = await generate_differential(patient, vitals, labs, news2, interactions)

    return await generate_soap_note(patient, vitals, labs, differential, news2)


@router.get("/ai/icu-risk/{patient_id}", response_model=ICUPrediction)
def get_icu_risk(patient_id: str):
    patient = PATIENTS_BY_ID.get(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    engine = get_vitals_engine()
    vitals = engine.get_current_vitals(patient_id)
    if not vitals:
        raise HTTPException(status_code=503, detail="Vitals not available yet")

    news2 = calculate_news2(vitals)
    predictor = get_predictor()
    return predictor.predict(vitals, patient, news2)


@router.get("/ai/triage/latest", response_model=TriageCycle)
async def get_latest_triage_endpoint():
    latest = get_latest_triage()
    if latest:
        return latest

    engine = get_vitals_engine()
    all_vitals = engine.get_all_current_vitals()
    all_news2 = {pid: calculate_news2(v) for pid, v in all_vitals.items()}
    return await run_triage_cycle(all_vitals, all_news2, force=True)


@router.get("/ai/triage/history", response_model=list[TriageCycle])
def get_triage_history_endpoint():
    return get_triage_history()


@router.get("/ai/triage/priority", response_model=list[TriagePriorityItem])
async def get_triage_priority():
    latest = get_latest_triage()
    if not latest:
        engine = get_vitals_engine()
        all_vitals = engine.get_all_current_vitals()
        all_news2 = {pid: calculate_news2(v) for pid, v in all_vitals.items()}
        latest = await run_triage_cycle(all_vitals, all_news2, force=True)
    return latest.priority_ranking


@router.post("/ai/query", response_model=ClinicalQueryResponse)
async def clinical_query_endpoint(req: ClinicalQueryRequest):
    patient = PATIENTS_BY_ID.get(req.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    _configure_genai()

    engine = get_vitals_engine()
    vitals = engine.get_current_vitals(req.patient_id)
    news2 = calculate_news2(vitals) if vitals else None
    labs = get_labs_for_patient(req.patient_id)

    context = f"""Patient: {patient.name}, {patient.age}{patient.sex.value}, {patient.chief_complaint}
Conditions: {', '.join(patient.active_conditions) or 'None'}
Medications: {', '.join(m.name + ' ' + m.dose for m in patient.current_medications) or 'None'}
NEWS2: {news2.score if news2 else 'N/A'} ({news2.risk_level.value if news2 else 'N/A'})
Vitals: HR {vitals.heart_rate:.0f}, BP {vitals.systolic_bp:.0f}/{vitals.diastolic_bp:.0f}, SpO2 {vitals.spo2:.0f}%, Temp {vitals.temperature:.1f}C, GCS {vitals.gcs}
Notable Labs: {'; '.join(f"{lr.test_name}: {lr.value} {lr.unit} [{lr.status.value}]" for lr in labs[:5]) if labs else "Pending"}"""

    prompt = f"""You are a clinical decision support AI in an emergency department.

Patient Context:
{context}

Clinical Question: {req.question}

Provide a concise, evidence-based answer (3-5 sentences). Include relevant drug doses, thresholds, or guidelines as appropriate.

Respond in JSON format:
{{
  "answer": "direct answer to the question",
  "clinical_basis": "evidence basis, guideline reference, or pharmacological rationale"
}}"""

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
        return ClinicalQueryResponse(
            answer=data.get("answer", "Unable to process query."),
            clinical_basis=data.get("clinical_basis", ""),
        )
    except Exception:
        return ClinicalQueryResponse(
            answer=f"I was unable to generate a response for the query: '{req.question}'",
            clinical_basis="AI service temporarily unavailable. Please consult clinical references.",
        )
