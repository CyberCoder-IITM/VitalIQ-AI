from fastapi import APIRouter, HTTPException
from models.schemas import DrugInteraction, DrugCheckRequest
from core.fhir_models import PATIENTS_BY_ID
from core.drug_interactions import check_interactions, check_new_drug, INTERACTION_DATABASE

router = APIRouter(tags=["drugs"])


@router.get("/drugs/interactions/{patient_id}", response_model=list[DrugInteraction])
def get_drug_interactions(patient_id: str):
    patient = PATIENTS_BY_ID.get(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return check_interactions(patient.current_medications)


@router.post("/drugs/check", response_model=list[DrugInteraction])
def check_new_drug_endpoint(req: DrugCheckRequest):
    patient = PATIENTS_BY_ID.get(req.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return check_new_drug(req.new_drug, patient.current_medications)


@router.get("/drugs/database", response_model=list[DrugInteraction])
def get_drug_database():
    return list(INTERACTION_DATABASE.values())
