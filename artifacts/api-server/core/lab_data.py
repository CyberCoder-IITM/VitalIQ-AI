"""Synthetic lab results for each of the 8 patients."""
from datetime import datetime, timedelta, timezone
from models.schemas import LabResult, LabStatus


def _ts(minutes_ago: int = 0) -> str:
    dt = datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)
    return dt.isoformat()


def _make_lab(patient_id: str, test: str, value: float, unit: str,
              lo: float, hi: float, mins_ago: int = 45,
              delta: float | None = None) -> LabResult:
    if value < lo * 0.8:
        status = LabStatus.CRITICAL_LOW
    elif value < lo:
        status = LabStatus.LOW
    elif value > hi * 1.2:
        status = LabStatus.CRITICAL_HIGH
    elif value > hi:
        status = LabStatus.HIGH
    else:
        status = LabStatus.NORMAL
    return LabResult(
        patient_id=patient_id,
        timestamp=_ts(mins_ago),
        test_name=test,
        value=round(value, 2),
        unit=unit,
        reference_low=lo,
        reference_high=hi,
        status=status,
        delta=round(delta, 2) if delta is not None else None,
    )


def get_labs_for_patient(patient_id: str) -> list[LabResult]:
    data: dict[str, list[LabResult]] = {
        "p001": [  # James Wilson — chest pain
            _make_lab("p001", "Troponin I", 0.87, "ng/mL", 0.0, 0.04, 30, delta=0.62),
            _make_lab("p001", "CK-MB", 18.4, "ng/mL", 0.0, 6.3, 30),
            _make_lab("p001", "BNP", 284, "pg/mL", 0.0, 100, 45),
            _make_lab("p001", "Glucose", 214, "mg/dL", 70, 100, 45, delta=+22),
            _make_lab("p001", "Creatinine", 1.4, "mg/dL", 0.7, 1.2, 45),
            _make_lab("p001", "K+", 4.2, "mEq/L", 3.5, 5.0, 45),
            _make_lab("p001", "Na+", 138, "mEq/L", 136, 145, 45),
            _make_lab("p001", "WBC", 11.8, "K/uL", 4.5, 11.0, 45, delta=+1.2),
            _make_lab("p001", "Hgb", 13.2, "g/dL", 13.5, 17.5, 45),
            _make_lab("p001", "PLT", 245, "K/uL", 150, 400, 45),
            _make_lab("p001", "INR", 1.1, "ratio", 0.9, 1.1, 45),
            _make_lab("p001", "HbA1c", 8.4, "%", 0, 5.7, 120),
        ],
        "p002": [  # Maria Santos — SOB, pregnant asthmatic
            _make_lab("p002", "Peak Flow", 220, "L/min", 380, 500, 15),
            _make_lab("p002", "ABG pH", 7.47, "", 7.35, 7.45, 20),
            _make_lab("p002", "pCO2", 30, "mmHg", 35, 45, 20),
            _make_lab("p002", "pO2", 62, "mmHg", 80, 100, 20, delta=-8),
            _make_lab("p002", "HCO3", 21, "mEq/L", 22, 26, 20),
            _make_lab("p002", "WBC", 14.2, "K/uL", 4.5, 11.0, 40),
            _make_lab("p002", "Hgb", 11.1, "g/dL", 11.0, 16.0, 40),
            _make_lab("p002", "Glucose", 95, "mg/dL", 70, 100, 40),
            _make_lab("p002", "Na+", 137, "mEq/L", 136, 145, 40),
            _make_lab("p002", "K+", 3.6, "mEq/L", 3.5, 5.0, 40),
            _make_lab("p002", "Magnesium", 1.6, "mg/dL", 1.7, 2.2, 40),
        ],
        "p003": [  # Robert Chen — AMS, elderly on warfarin
            _make_lab("p003", "INR", 4.8, "ratio", 0.9, 1.1, 60, delta=+2.1),
            _make_lab("p003", "Na+", 129, "mEq/L", 136, 145, 60),
            _make_lab("p003", "Ammonia", 88, "umol/L", 11, 51, 60),
            _make_lab("p003", "Glucose", 58, "mg/dL", 70, 100, 60),
            _make_lab("p003", "Creatinine", 2.1, "mg/dL", 0.7, 1.2, 60),
            _make_lab("p003", "BUN", 42, "mg/dL", 7, 20, 60),
            _make_lab("p003", "WBC", 18.4, "K/uL", 4.5, 11.0, 60),
            _make_lab("p003", "Hgb", 11.4, "g/dL", 13.5, 17.5, 60),
            _make_lab("p003", "TSH", 8.2, "mIU/L", 0.4, 4.0, 60),
            _make_lab("p003", "Urinalysis WBC", 50, "cells/hpf", 0, 5, 60),
        ],
        "p004": [  # Sarah Johnson — abdominal pain
            _make_lab("p004", "Lipase", 1240, "U/L", 0, 60, 30, delta=+480),
            _make_lab("p004", "WBC", 16.8, "K/uL", 4.5, 11.0, 30),
            _make_lab("p004", "Hgb", 12.8, "g/dL", 11.0, 16.0, 30),
            _make_lab("p004", "CRP", 142, "mg/L", 0, 5, 30),
            _make_lab("p004", "Creatinine", 1.0, "mg/dL", 0.5, 1.1, 30),
            _make_lab("p004", "Calcium", 7.8, "mg/dL", 8.5, 10.5, 30),
            _make_lab("p004", "ALT", 68, "U/L", 7, 40, 30),
            _make_lab("p004", "AST", 52, "U/L", 10, 40, 30),
            _make_lab("p004", "Bilirubin Total", 2.4, "mg/dL", 0.2, 1.2, 30),
            _make_lab("p004", "Lactic Acid", 2.8, "mmol/L", 0.5, 2.2, 30, delta=+0.8),
        ],
        "p005": [  # Michael Brown — syncope, complete heart block
            _make_lab("p005", "Digoxin Level", 2.8, "ng/mL", 0.8, 2.0, 20, delta=+0.9),
            _make_lab("p005", "K+", 2.9, "mEq/L", 3.5, 5.0, 20, delta=-0.6),
            _make_lab("p005", "Mg2+", 1.4, "mg/dL", 1.7, 2.2, 20),
            _make_lab("p005", "Na+", 133, "mEq/L", 136, 145, 20),
            _make_lab("p005", "BUN", 28, "mg/dL", 7, 20, 20),
            _make_lab("p005", "Creatinine", 1.6, "mg/dL", 0.7, 1.2, 20),
            _make_lab("p005", "Troponin I", 0.02, "ng/mL", 0.0, 0.04, 20),
            _make_lab("p005", "TSH", 0.08, "mIU/L", 0.4, 4.0, 20),
            _make_lab("p005", "Hgb", 10.8, "g/dL", 13.5, 17.5, 20),
        ],
        "p006": [  # Emily Davis — seizure
            _make_lab("p006", "Sodium", 128, "mEq/L", 136, 145, 15),
            _make_lab("p006", "Glucose", 44, "mg/dL", 70, 100, 15),
            _make_lab("p006", "Levetiracetam Level", 28, "mcg/mL", 20, 40, 15),
            _make_lab("p006", "Lactic Acid", 4.2, "mmol/L", 0.5, 2.2, 15, delta=+1.8),
            _make_lab("p006", "WBC", 13.6, "K/uL", 4.5, 11.0, 15),
            _make_lab("p006", "Creatinine", 0.8, "mg/dL", 0.5, 1.1, 15),
            _make_lab("p006", "Prolactin", 68, "ng/mL", 2, 20, 15),
            _make_lab("p006", "urine hCG", 0, "mIU/mL", 0, 5, 15),
        ],
        "p007": [  # Thomas Lee — back pain, CKD
            _make_lab("p007", "Creatinine", 3.2, "mg/dL", 0.7, 1.2, 90, delta=+0.8),
            _make_lab("p007", "BUN", 68, "mg/dL", 7, 20, 90),
            _make_lab("p007", "eGFR", 22, "mL/min/1.73m2", 60, 999, 90),
            _make_lab("p007", "K+", 5.6, "mEq/L", 3.5, 5.0, 90, delta=+0.4),
            _make_lab("p007", "Bicarbonate", 18, "mEq/L", 22, 29, 90),
            _make_lab("p007", "Phosphorus", 6.8, "mg/dL", 2.5, 4.5, 90),
            _make_lab("p007", "Hemoglobin", 9.4, "g/dL", 13.5, 17.5, 90),
            _make_lab("p007", "PTH", 284, "pg/mL", 15, 65, 90),
            _make_lab("p007", "Urinalysis protein", 300, "mg/dL", 0, 14, 90),
        ],
        "p008": [  # Nancy White — fall, CHF on warfarin
            _make_lab("p008", "INR", 5.2, "ratio", 0.9, 1.1, 40, delta=+1.8),
            _make_lab("p008", "BNP", 2840, "pg/mL", 0, 100, 40),
            _make_lab("p008", "Troponin I", 0.06, "ng/mL", 0.0, 0.04, 40, delta=+0.04),
            _make_lab("p008", "Na+", 126, "mEq/L", 136, 145, 40),
            _make_lab("p008", "K+", 3.0, "mEq/L", 3.5, 5.0, 40),
            _make_lab("p008", "Creatinine", 2.4, "mg/dL", 0.5, 1.1, 40),
            _make_lab("p008", "Digoxin Level", 2.4, "ng/mL", 0.8, 2.0, 40),
            _make_lab("p008", "Hgb", 8.8, "g/dL", 11.0, 16.0, 40, delta=-1.2),
            _make_lab("p008", "Albumin", 2.6, "g/dL", 3.5, 5.0, 40),
            _make_lab("p008", "ABG pH", 7.31, "", 7.35, 7.45, 40),
            _make_lab("p008", "pO2", 56, "mmHg", 80, 100, 40),
        ],
    }
    return data.get(patient_id, [])
