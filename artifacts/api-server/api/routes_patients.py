from fastapi import APIRouter, HTTPException
from models.schemas import Patient
from core.fhir_models import SYNTHETIC_PATIENTS, PATIENTS_BY_ID

router = APIRouter(tags=["patients"])


@router.get("/patients", response_model=list[Patient])
def list_patients():
    return SYNTHETIC_PATIENTS


@router.get("/patients/{patient_id}", response_model=Patient)
def get_patient(patient_id: str):
    patient = PATIENTS_BY_ID.get(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    return patient
