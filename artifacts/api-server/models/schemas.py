from pydantic import BaseModel
from typing import Optional, List
from enum import Enum


class HealthStatus(BaseModel):
    status: str


class CodeStatus(str, Enum):
    FULL = "FULL"
    DNR = "DNR"
    DNI = "DNI"


class Sex(str, Enum):
    M = "M"
    F = "F"


class Medication(BaseModel):
    name: str
    dose: str
    route: str
    frequency: str
    started: str


class Patient(BaseModel):
    id: str
    mrn: str
    name: str
    age: int
    sex: Sex
    dob: str
    chief_complaint: str
    arrival_time: str
    bed: str
    attending: str
    code_status: CodeStatus
    allergies: List[str]
    current_medications: List[Medication]
    active_conditions: List[str]
    acuity: int  # 1-5 ESI level


class VitalSigns(BaseModel):
    patient_id: str
    timestamp: str
    heart_rate: float
    systolic_bp: float
    diastolic_bp: float
    respiratory_rate: float
    spo2: float
    temperature: float
    gcs: int
    etco2: Optional[float] = None
    pain_score: int


class LabStatus(str, Enum):
    NORMAL = "NORMAL"
    LOW = "LOW"
    HIGH = "HIGH"
    CRITICAL_LOW = "CRITICAL_LOW"
    CRITICAL_HIGH = "CRITICAL_HIGH"


class LabResult(BaseModel):
    patient_id: str
    timestamp: str
    test_name: str
    value: float
    unit: str
    reference_low: float
    reference_high: float
    status: LabStatus
    delta: Optional[float] = None


class AlertType(str, Enum):
    DETERIORATION = "DETERIORATION"
    DRUG_INTERACTION = "DRUG_INTERACTION"
    CRITICAL_LAB = "CRITICAL_LAB"
    NEWS_ESCALATION = "NEWS_ESCALATION"
    AI_DIAGNOSIS = "AI_DIAGNOSIS"
    ICU_THRESHOLD = "ICU_THRESHOLD"


class AlertSeverity(str, Enum):
    INFO = "INFO"
    WARN = "WARN"
    URGENT = "URGENT"
    CRITICAL = "CRITICAL"


class ClinicalAlert(BaseModel):
    alert_id: str
    patient_id: str
    patient_name: str
    timestamp: str
    alert_type: AlertType
    severity: AlertSeverity
    title: str
    body: str
    acknowledged: bool = False
    news_score: Optional[int] = None


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class NEWS2ComponentScores(BaseModel):
    respiratory_rate: int
    spo2: int
    systolic_bp: int
    heart_rate: int
    consciousness: int
    temperature: int


class NEWS2Result(BaseModel):
    score: int
    risk_level: RiskLevel
    component_scores: NEWS2ComponentScores
    recommended_action: str
    escalation_required: bool
    monitoring_frequency: str


class DeteriorationTrend(BaseModel):
    is_deteriorating: bool
    trend_direction: str  # IMPROVING | STABLE | WORSENING
    rate_of_change: dict
    predicted_news_in_5min: int
    confidence: float


class InteractionSeverity(str, Enum):
    MAJOR = "MAJOR"
    MODERATE = "MODERATE"
    MINOR = "MINOR"


class DrugInteraction(BaseModel):
    drug_a: str
    drug_b: str
    severity: InteractionSeverity
    mechanism: str
    effect: str
    recommendation: str
    monitor: str


class DiagnosisProbability(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class DiagnosisItem(BaseModel):
    rank: int
    diagnosis: str
    icd10_code: str
    probability: DiagnosisProbability
    probability_percent: int
    supporting_evidence: List[str]
    against_evidence: List[str]
    immediate_workup: List[str]
    red_flags: List[str]


class Disposition(str, Enum):
    DISCHARGE = "DISCHARGE"
    OBSERVE = "OBSERVE"
    ADMIT_FLOOR = "ADMIT_FLOOR"
    ADMIT_ICU = "ADMIT_ICU"
    OR = "OR"


class DifferentialDiagnosis(BaseModel):
    patient_id: str
    generated_at: str
    diagnoses: List[DiagnosisItem]
    immediate_actions: List[str]
    disposition_recommendation: Disposition
    time_sensitive: bool
    time_sensitivity_reason: Optional[str] = None


class MDMLevel(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"


class SOAPNote(BaseModel):
    patient_id: str
    timestamp: str
    subjective: str
    objective: str
    assessment: str
    plan: str
    mdm_level: MDMLevel
    attestation: str
    word_count: int
    generated_in_ms: int


class RiskCategory(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    VERY_HIGH = "VERY_HIGH"


class ICUPrediction(BaseModel):
    patient_id: str
    probability: float
    percentage: int
    risk_category: RiskCategory
    key_factors: List[str]
    confidence_interval_low: float
    confidence_interval_high: float
    recommendation: str


class TriagePriorityItem(BaseModel):
    rank: int
    patient_id: str
    name: str
    urgency_reason: str
    recommended_action: str
    time_to_act_minutes: int


class CriticalAction(BaseModel):
    patient_id: str
    action: str
    rationale: str
    time_critical: bool


class PhysicianFocus(BaseModel):
    patient_id: str
    name: str
    reason: str
    specific_concern: str


class DepartmentStatus(str, Enum):
    CONTROLLED = "CONTROLLED"
    BUSY = "BUSY"
    CRITICAL_LOAD = "CRITICAL_LOAD"


class TriageCycle(BaseModel):
    cycle_id: str
    timestamp: str
    priority_ranking: List[TriagePriorityItem]
    critical_actions: List[CriticalAction]
    physician_focus: PhysicianFocus
    stable_patients: List[str]
    department_status: DepartmentStatus
    cycle_summary: str


class ClinicalQueryRequest(BaseModel):
    patient_id: str
    question: str


class ClinicalQueryResponse(BaseModel):
    answer: str
    clinical_basis: str


class DrugCheckRequest(BaseModel):
    patient_id: str
    new_drug: str


class AlertCount(BaseModel):
    count: int
