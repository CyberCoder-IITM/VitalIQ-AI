import asyncio
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from models.schemas import VitalSigns, NEWS2Result
from core.vitals_engine import get_vitals_engine
from core.deterioration import calculate_news2
from core.lab_data import get_labs_for_patient
from core.fhir_models import PATIENTS_BY_ID

router = APIRouter(tags=["vitals"])


@router.get("/vitals/all/current")
def get_all_current_vitals():
    engine = get_vitals_engine()
    return engine.get_all_current_vitals()


@router.get("/vitals/{patient_id}/current", response_model=VitalSigns)
def get_current_vitals(patient_id: str):
    engine = get_vitals_engine()
    vitals = engine.get_current_vitals(patient_id)
    if not vitals:
        raise HTTPException(status_code=404, detail="Patient not found or no vitals yet")
    return vitals


@router.get("/vitals/{patient_id}/history", response_model=list[VitalSigns])
def get_vitals_history(patient_id: str):
    engine = get_vitals_engine()
    history = engine.get_vitals_history(patient_id)
    if patient_id not in PATIENTS_BY_ID:
        raise HTTPException(status_code=404, detail="Patient not found")
    return history


@router.get("/vitals/{patient_id}/news2", response_model=NEWS2Result)
def get_news2_score(patient_id: str):
    engine = get_vitals_engine()
    vitals = engine.get_current_vitals(patient_id)
    if not vitals:
        raise HTTPException(status_code=404, detail="Patient not found or no vitals yet")
    return calculate_news2(vitals)


@router.get("/vitals/{patient_id}/labs")
def get_lab_results(patient_id: str):
    if patient_id not in PATIENTS_BY_ID:
        raise HTTPException(status_code=404, detail="Patient not found")
    return get_labs_for_patient(patient_id)


@router.get("/vitals/{patient_id}/stream")
async def stream_patient_vitals(patient_id: str):
    if patient_id not in PATIENTS_BY_ID:
        raise HTTPException(status_code=404, detail="Patient not found")

    async def generate():
        engine = get_vitals_engine()
        yield f"data: {json.dumps({'type': 'connected', 'patient_id': patient_id})}\n\n"
        while True:
            await asyncio.sleep(3)
            vitals = engine.get_current_vitals(patient_id)
            if vitals:
                yield f"data: {vitals.model_dump_json()}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/vitals/all/stream")
async def stream_all_vitals():
    async def generate():
        engine = get_vitals_engine()
        yield f"data: {json.dumps({'type': 'connected'})}\n\n"
        while True:
            await asyncio.sleep(3)
            all_vitals = engine.get_all_current_vitals()
            for pid, v in all_vitals.items():
                payload = {"patient_id": pid, "vitals": json.loads(v.model_dump_json())}
                yield f"data: {json.dumps(payload)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
