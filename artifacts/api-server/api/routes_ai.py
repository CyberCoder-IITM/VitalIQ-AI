import asyncio
import os
import json
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

router = APIRouter(tags=["ai"])


def _try_gemini(prompt: str) -> str | None:
    """Attempt an AI call; return text or None if quota/error."""
    try:
        import google.genai as genai
        base_url = os.environ.get("AI_INTEGRATIONS_GEMINI_BASE_URL", "")
        api_key = os.environ.get("AI_INTEGRATIONS_GEMINI_API_KEY", "")
        if not base_url:
            return None
        client = genai.Client(
            api_key=api_key,
            http_options={"base_url": base_url},
        )
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        return response.text
    except Exception:
        return None


# ── Deterministic clinical query engine ─────────────────────────────────────

def _build_clinical_context(patient_id: str):
    patient = PATIENTS_BY_ID.get(patient_id)
    if not patient:
        return None, None, None, None, None
    engine = get_vitals_engine()
    vitals = engine.get_current_vitals(patient_id)
    news2 = calculate_news2(vitals) if vitals else None
    labs = get_labs_for_patient(patient_id)
    interactions = check_interactions(patient.current_medications)
    return patient, vitals, news2, labs, interactions


def _answer_drug_interactions(patient, interactions) -> tuple[str, str]:
    if not interactions:
        meds = ", ".join(m.name for m in patient.current_medications) or "none listed"
        return (
            f"{patient.name} has no significant drug interactions detected among their current medications ({meds}).",
            "Systematic pairwise interaction checking against clinical drug interaction database."
        )
    major = [i for i in interactions if i.severity.value == "MAJOR"]
    moderate = [i for i in interactions if i.severity.value == "MODERATE"]
    most_danger = major[0] if major else moderate[0]
    other_count = len(interactions) - 1
    detail = (
        f"The most dangerous interaction for {patient.name} is "
        f"**{most_danger.drug_a} + {most_danger.drug_b}** (severity: {most_danger.severity.value}). "
        f"Mechanism: {most_danger.mechanism}. "
        f"Effect: {most_danger.effect}. "
        f"Recommendation: {most_danger.recommendation}."
    )
    if other_count > 0:
        detail += f" There are {other_count} additional interaction(s) — check the Drug Safety tab for the full list."
    basis = f"Clinical pharmacology interaction database. Monitor: {most_danger.monitor}."
    return detail, basis


def _answer_discharge_safety(patient, vitals, news2, labs, interactions) -> tuple[str, str]:
    concerns = []
    if news2 and news2.score >= 5:
        concerns.append(f"NEWS2 score {news2.score} ({news2.risk_level.value}) is above safe discharge threshold of <3")
    if vitals:
        if vitals.spo2 < 94:
            concerns.append(f"SpO₂ {vitals.spo2:.0f}% (threshold: ≥94%)")
        if vitals.systolic_bp < 90:
            concerns.append(f"Systolic BP {vitals.systolic_bp:.0f} mmHg (hypotension)")
        if vitals.heart_rate > 120:
            concerns.append(f"HR {vitals.heart_rate:.0f} bpm (persistent tachycardia)")
        if vitals.respiratory_rate > 20:
            concerns.append(f"RR {vitals.respiratory_rate:.0f}/min (tachypnoea)")
    major_interactions = [i for i in (interactions or []) if i.severity.value == "MAJOR"]
    if major_interactions:
        concerns.append(f"{len(major_interactions)} MAJOR drug interaction(s) unresolved")
    critical_labs = [l for l in (labs or []) if l.status.value in ("CRITICAL_HIGH", "CRITICAL_LOW")]
    if critical_labs:
        concerns.append(f"{len(critical_labs)} critical lab value(s): {', '.join(l.test_name for l in critical_labs[:3])}")

    if not concerns:
        answer = f"{patient.name} has stable vitals (NEWS2 {news2.score if news2 else 'N/A'}, no critical flags) and no major drug interactions. Discharge may be appropriate pending clinical judgment and social circumstances."
        basis = "NEWS2 <3 with normal vital signs supports low-risk discharge per NICE NG94 guidelines."
    else:
        answer = f"{patient.name} is **NOT safe for immediate discharge**. Active concerns: {'; '.join(concerns)}. Address these before considering disposition."
        basis = "NEWS2 ≥5 triggers mandatory senior clinical review before any disposition decision (NICE NG94, NEWS2 national guidelines)."
    return answer, basis


def _answer_news2(patient, vitals, news2) -> tuple[str, str]:
    if not news2 or not vitals:
        return (f"NEWS2 data is not yet available for {patient.name}.",
                "NEWS2 requires complete vital signs.")
    contributors = []
    if news2.resp_rate_score > 0:
        contributors.append(f"RR {vitals.respiratory_rate:.0f}/min (+{news2.resp_rate_score})")
    if news2.spo2_score > 0:
        contributors.append(f"SpO₂ {vitals.spo2:.0f}% (+{news2.spo2_score})")
    if news2.bp_score > 0:
        contributors.append(f"BP {vitals.systolic_bp:.0f} (+{news2.bp_score})")
    if news2.hr_score > 0:
        contributors.append(f"HR {vitals.heart_rate:.0f} (+{news2.hr_score})")
    if news2.temp_score > 0:
        contributors.append(f"Temp {vitals.temperature:.1f}°C (+{news2.temp_score})")
    if news2.consciousness_score > 0:
        contributors.append(f"GCS {vitals.gcs} (+{news2.consciousness_score})")
    contrib_str = ", ".join(contributors) or "all parameters within normal range"
    answer = (
        f"{patient.name}'s NEWS2 score is **{news2.score}** ({news2.risk_level.value} risk). "
        f"Scoring breakdown: {contrib_str}. "
        f"{news2.recommendation}"
    )
    thresholds = "NEWS2 0-4: low risk. 5-6: medium (urgent review). 7+: high (emergency response). Any single score ≥3: continuous monitoring."
    return answer, f"Royal College of Physicians NEWS2 scoring system. {thresholds}"


def _answer_troponin(patient, labs) -> tuple[str, str]:
    trop_labs = [l for l in (labs or []) if "troponin" in l.test_name.lower()]
    if not trop_labs:
        return (
            f"No troponin result is currently available for {patient.name}. Ensure high-sensitivity troponin (hs-cTnI or hs-cTnT) has been sent.",
            "Serial troponin at 0h and 3h (ESC 0/3h algorithm) or 0h and 1h (ESC 0/1h algorithm) is the standard ED rule-out strategy."
        )
    trop = trop_labs[0]
    is_critical = trop.status.value in ("CRITICAL_HIGH",)
    is_high = trop.status.value in ("HIGH",)
    if is_critical:
        answer = (
            f"**Yes — {patient.name}'s troponin is critically elevated** at {trop.value} {trop.unit}. "
            f"This is significantly above the 99th percentile URL. In the context of {patient.chief_complaint}, "
            f"acute MI cannot be excluded. Activate the ACS pathway: 12-lead ECG, aspirin 300mg, cardiology consult, "
            f"serial ECGs, consider anticoagulation."
        )
    elif is_high:
        answer = (
            f"{patient.name}'s troponin is elevated at {trop.value} {trop.unit} (above normal range). "
            f"This warrants serial measurement (repeat at 3h or 1h per local protocol). Consider ACS, myocarditis, "
            f"PE, and demand ischaemia given the clinical picture of {patient.chief_complaint}."
        )
    else:
        answer = (
            f"{patient.name}'s troponin is {trop.value} {trop.unit} ({trop.status.value}). "
            f"A single negative result does not exclude NSTEMI — a serial sample at 3 hours (or 1 hour if using high-sensitivity assay) is required for a complete rule-out."
        )
    return answer, "ESC 2023 NSTEMI guidelines: 0h/1h or 0h/3h algorithm with hs-cTn. 99th percentile URL as diagnostic threshold."


def _answer_tachycardia(patient, vitals, labs, interactions) -> tuple[str, str]:
    if not vitals:
        return (f"Vitals not yet available for {patient.name}.", "")
    hr = vitals.heart_rate
    causes = []
    if vitals.temperature > 38.0:
        causes.append(f"fever ({vitals.temperature:.1f}°C) — sepsis/infection screen recommended")
    if vitals.spo2 < 94:
        causes.append(f"hypoxaemia (SpO₂ {vitals.spo2:.0f}%) — compensatory tachycardia")
    if vitals.systolic_bp < 100:
        causes.append(f"hypotension ({vitals.systolic_bp:.0f} mmHg) — hypovolaemia or obstructive cause")
    if vitals.respiratory_rate > 20:
        causes.append(f"tachypnoea (RR {vitals.respiratory_rate:.0f}) — consider PE, pneumothorax, or metabolic acidosis")
    pain_meds = [m for m in patient.current_medications if "pain" in m.name.lower() or "morphine" in m.name.lower()]
    if not pain_meds and "pain" in patient.chief_complaint.lower():
        causes.append("uncontrolled pain (no analgesic charted)")
    stimulant_interactions = [i for i in (interactions or []) if "stimulant" in i.effect.lower() or "heart rate" in i.effect.lower()]
    if stimulant_interactions:
        causes.append(f"drug interaction ({stimulant_interactions[0].drug_a} + {stimulant_interactions[0].drug_b})")
    cause_str = "; ".join(causes) if causes else "no obvious reversible cause identified from current data — consider primary arrhythmia (SVT, AF, AF with RVR), anxiety, anaemia, or PE"
    answer = (
        f"{patient.name}'s HR is **{hr:.0f} bpm** (presenting complaint: {patient.chief_complaint}). "
        f"Most likely contributors: {cause_str}. "
        f"Workup: 12-lead ECG to characterise rhythm, check FBC for anaemia, "
        f"consider D-dimer/CTPA if PE suspected."
    )
    return answer, "Systematic approach to tachycardia: 12-lead ECG, treat reversible causes (5H5T), rhythm-specific management per ALS/ACLS."


def _answer_icu(patient, vitals, news2) -> tuple[str, str]:
    predictor = get_predictor()
    if vitals and news2:
        icu_pred = predictor.predict(vitals, patient, news2)
        pct = icu_pred.percentage
        risk = icu_pred.risk_level
        factors = ", ".join(icu_pred.driving_factors[:3]) if icu_pred.driving_factors else "see full ICU predictor"
        answer = (
            f"{patient.name}'s ICU admission risk is **{pct}% ({risk})**. "
            f"Key drivers: {factors}. "
            f"{icu_pred.recommendation}"
        )
        basis = "Validated ED ICU risk model integrating NEWS2, vital sign trends, age, and comorbidities."
    else:
        answer = f"ICU risk data not yet available for {patient.name}. Ensure vital signs are current."
        basis = "ICU predictor requires complete vital sign data."
    return answer, basis


def _answer_sepsis(patient, vitals, labs) -> tuple[str, str]:
    qsofa = 0
    criteria = []
    if vitals:
        if vitals.respiratory_rate >= 22:
            qsofa += 1
            criteria.append(f"RR ≥22 ({vitals.respiratory_rate:.0f}/min)")
        if vitals.systolic_bp <= 100:
            qsofa += 1
            criteria.append(f"SBP ≤100 ({vitals.systolic_bp:.0f} mmHg)")
        if vitals.gcs < 15:
            qsofa += 1
            criteria.append(f"GCS <15 ({vitals.gcs})")
    lactate_labs = [l for l in (labs or []) if "lactate" in l.test_name.lower()]
    lactate_note = ""
    if lactate_labs:
        lact = lactate_labs[0]
        if float(str(lact.value).replace(">","").replace("<","")) > 2.0:
            lactate_note = f" Lactate {lact.value} {lact.unit} is elevated — if ≥2 mmol/L, Sepsis-3 criteria are met even with qSOFA <2."
    if qsofa >= 2:
        answer = (
            f"**Sepsis concern for {patient.name}.** qSOFA score {qsofa}/3: {'; '.join(criteria)}. "
            f"Sepsis-3 criteria likely met. Initiate sepsis bundle: blood cultures ×2 before antibiotics, "
            f"broad-spectrum antibiotics within 1 hour, 30mL/kg crystalloid bolus, urine output monitoring, "
            f"repeat lactate at 2h.{lactate_note}"
        )
        basis = "Sepsis-3 (Singer 2016): qSOFA ≥2 + suspected infection = sepsis. Surviving Sepsis Campaign 2021 hour-1 bundle."
    elif qsofa == 1:
        answer = (
            f"{patient.name} has 1 qSOFA criterion ({criteria[0] if criteria else 'see vitals'}). "
            f"Sepsis not confirmed, but remain vigilant. Check temperature, WBC, CRP. "
            f"If clinical suspicion persists, send cultures and consider early antibiotics.{lactate_note}"
        )
        basis = "qSOFA <2 does not exclude sepsis if clinical suspicion is high. SOFA score may be more specific."
    else:
        answer = f"{patient.name} has 0 qSOFA criteria. Sepsis is unlikely based on current vital signs, but re-assess if condition changes.{lactate_note}"
        basis = "qSOFA 0: low likelihood of sepsis-related organ dysfunction."
    return answer, basis


def _answer_generic(question: str, patient, vitals, news2, labs, interactions) -> tuple[str, str]:
    """Keyword-driven routing for questions not matching specific handlers."""
    q = question.lower()

    if any(w in q for w in ["medication", "med ", "drug ", "prescription", "dose"]):
        meds = patient.current_medications
        if not meds:
            return (f"{patient.name} has no current medications charted.", "Check pharmacy/nursing records for completeness.")
        med_list = "; ".join(f"{m.name} {m.dose} {m.route} {m.frequency}" for m in meds)
        return (
            f"{patient.name}'s current medications: {med_list}. "
            f"Total {len(meds)} agent(s) charted. Check Drug Safety tab for interactions.",
            "Review prescribed medication list for completeness and reconciliation."
        )

    if any(w in q for w in ["lab", "blood", "result", "test", "value"]):
        if not labs:
            return (f"No lab results are currently available for {patient.name}.", "Labs may be pending.")
        abnormal = [l for l in labs if l.status.value not in ("NORMAL",)]
        if not abnormal:
            return (
                f"All {len(labs)} lab results for {patient.name} are within normal limits.",
                "Routine lab interpretation against reference ranges."
            )
        abn_str = "; ".join(f"{l.test_name}: {l.value} {l.unit} [{l.status.value}]" for l in abnormal[:5])
        return (
            f"{patient.name} has {len(abnormal)} abnormal lab value(s): {abn_str}. See the Lab Trends tab for the full panel.",
            "Interpret in clinical context — single values rarely diagnostic in isolation."
        )

    if any(w in q for w in ["blood pressure", "bp", "hypotension", "hypertension", "sbp"]):
        if not vitals:
            return ("Vitals unavailable.", "")
        bp = f"{vitals.systolic_bp:.0f}/{vitals.diastolic_bp:.0f} mmHg"
        concern = ""
        if vitals.systolic_bp < 90:
            concern = " This is clinically significant hypotension — consider fluid resuscitation (500mL crystalloid bolus), vasopressors if not responding, and urgent senior review."
        elif vitals.systolic_bp > 180:
            concern = " Hypertensive emergency: assess for end-organ damage (neuro, cardiac, renal). Consider IV labetalol or GTN infusion if symptomatic."
        return (f"{patient.name}'s current BP is {bp}.{concern}", "BP interpretation per AHA/ESC hypertension guidelines and Sepsis-3 MAP targets.")

    if any(w in q for w in ["oxygen", "spo2", "saturation", "hypoxia", "breathing"]):
        if not vitals:
            return ("Vitals unavailable.", "")
        spo2 = f"{vitals.spo2:.0f}%"
        rr = f"{vitals.respiratory_rate:.0f}/min"
        concern = ""
        if vitals.spo2 < 88:
            concern = f" Critical hypoxaemia — high-flow oxygen immediately, consider NIV/intubation. Differential: PE, pneumothorax, severe pneumonia, acute pulmonary oedema."
        elif vitals.spo2 < 94:
            concern = f" Target SpO₂ 94-98% in most patients (88-92% in COPD). Titrate supplemental oxygen."
        return (f"{patient.name}'s SpO₂ is {spo2} (RR {rr}).{concern}", "BTS oxygen guidelines 2017; target ranges vary by underlying condition.")

    if any(w in q for w in ["gcs", "consciousness", "alert", "confusion", "mental", "neuro"]):
        if not vitals:
            return ("Vitals unavailable.", "")
        gcs = vitals.gcs
        concern = ""
        if gcs <= 8:
            concern = " GCS ≤8: airway at risk — consider anaesthetic review, RSI, and CT head."
        elif gcs < 15:
            concern = f" Impaired consciousness. Consider CT head, glucose, electrolytes, sepsis screen, toxicology."
        return (f"{patient.name}'s GCS is {gcs}/15.{concern}", "GCS <15 warrants investigation; GCS ≤8 = airway compromise threshold.")

    # Fallback: general summary
    vital_str = ""
    if vitals:
        vital_str = (f"HR {vitals.heart_rate:.0f}, BP {vitals.systolic_bp:.0f}/{vitals.diastolic_bp:.0f}, "
                     f"SpO₂ {vitals.spo2:.0f}%, RR {vitals.respiratory_rate:.0f}, Temp {vitals.temperature:.1f}°C, GCS {vitals.gcs}")
    abnormal_labs = [l for l in (labs or []) if l.status.value not in ("NORMAL",)]
    major_ix = [i for i in (interactions or []) if i.severity.value == "MAJOR"]
    answer = (
        f"Summary for {patient.name} ({patient.age}{patient.sex.value}, {patient.chief_complaint}): "
        f"NEWS2 {news2.score if news2 else 'N/A'} ({news2.risk_level.value if news2 else '—'}). "
        f"Vitals: {vital_str}. "
        f"{len(abnormal_labs)} abnormal lab(s), {len(major_ix)} major drug interaction(s). "
        f"For specific clinical guidance, ask about: drug interactions, discharge safety, NEWS2, troponin, tachycardia, sepsis, ICU risk."
    )
    return answer, "Clinical data summary from live patient record."


def _deterministic_query(question: str, patient_id: str) -> ClinicalQueryResponse:
    patient, vitals, news2, labs, interactions = _build_clinical_context(patient_id)
    if not patient:
        return ClinicalQueryResponse(
            answer="Patient not found.",
            clinical_basis="",
        )

    q = question.lower()

    if any(w in q for w in ["drug interaction", "interaction", "dangerous drug", "most dangerous", "medication interaction", "drug safety"]):
        answer, basis = _answer_drug_interactions(patient, interactions)
    elif any(w in q for w in ["discharge", "safe to go home", "safe for discharge", "go home", "leave"]):
        answer, basis = _answer_discharge_safety(patient, vitals, news2, labs, interactions)
    elif any(w in q for w in ["news2", "news score", "national early warning", "escalation score"]):
        answer, basis = _answer_news2(patient, vitals, news2)
    elif any(w in q for w in ["troponin", "tropo", "hs-ctn", "ckmb", "cardiac enzyme", "ami", "stemi", "nstemi", "acs", "heart attack"]):
        answer, basis = _answer_troponin(patient, labs)
    elif any(w in q for w in ["tachycardia", "fast heart", "high heart rate", "hr ", "heart rate", "pulse", "palpitation"]):
        answer, basis = _answer_tachycardia(patient, vitals, labs, interactions)
    elif any(w in q for w in ["icu", "intensive care", "critical care", "itu", "admit", "admission risk"]):
        answer, basis = _answer_icu(patient, vitals, news2)
    elif any(w in q for w in ["sepsis", "infection", "bacteraemia", "bacteremia", "qsofa", "sofa", "septic"]):
        answer, basis = _answer_sepsis(patient, vitals, labs)
    elif any(w in q for w in ["biggest risk", "main risk", "most worried", "most dangerous", "worst", "urgent", "priority"]):
        # Triage-style "what's most urgent" question
        risks = []
        if news2 and news2.score >= 7:
            risks.append(f"critically elevated NEWS2 {news2.score} — emergency response required")
        if vitals and vitals.spo2 < 88:
            risks.append(f"severe hypoxaemia (SpO₂ {vitals.spo2:.0f}%)")
        if vitals and vitals.systolic_bp < 90:
            risks.append(f"hypotension (SBP {vitals.systolic_bp:.0f} mmHg)")
        major_ix = [i for i in (interactions or []) if i.severity.value == "MAJOR"]
        if major_ix:
            risks.append(f"MAJOR drug interaction: {major_ix[0].drug_a} + {major_ix[0].drug_b} — {major_ix[0].effect}")
        crit_labs = [l for l in (labs or []) if l.status.value in ("CRITICAL_HIGH", "CRITICAL_LOW")]
        if crit_labs:
            risks.append(f"critical lab value: {crit_labs[0].test_name} {crit_labs[0].value} {crit_labs[0].unit}")
        if not risks:
            risks.append(f"no immediate life threats identified — NEWS2 {news2.score if news2 else 'N/A'} is {news2.risk_level.value if news2 else 'unknown'}, continue monitoring")
        answer = f"The biggest current risk for {patient.name}: {'; '.join(risks)}."
        basis = "Risk stratification based on vital sign thresholds, NEWS2, drug interaction database, and critical lab flags."
    else:
        answer, basis = _answer_generic(question, patient, vitals, news2, labs, interactions)

    return ClinicalQueryResponse(answer=answer, clinical_basis=basis)


# ── Routes ───────────────────────────────────────────────────────────────────

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

    # Always use the deterministic engine — it's fast, data-driven, and quota-free.
    # Attempt an AI enhancement on top if quota is available.
    base = _deterministic_query(req.question, req.patient_id)

    try:
        _, vitals, news2, labs, interactions = _build_clinical_context(req.patient_id)
        meds_str = ", ".join(f"{m.name} {m.dose}" for m in patient.current_medications) or "None"
        labs_str = "; ".join(f"{l.test_name}: {l.value} {l.unit} [{l.status.value}]" for l in (labs or [])[:6]) or "Pending"
        ix_str = "; ".join(f"{i.drug_a}+{i.drug_b} ({i.severity.value})" for i in (interactions or [])[:3]) or "None"
        context_prompt = f"""You are a clinical decision support AI in an ED.
Patient: {patient.name}, {patient.age}{patient.sex.value}, {patient.chief_complaint}
NEWS2: {news2.score if news2 else 'N/A'} | Vitals: HR {vitals.heart_rate:.0f}, BP {vitals.systolic_bp:.0f}/{vitals.diastolic_bp:.0f}, SpO2 {vitals.spo2:.0f}%, Temp {vitals.temperature:.1f}C, GCS {vitals.gcs}
Medications: {meds_str}
Labs: {labs_str}
Interactions: {ix_str}
Question: {req.question}
Answer in 2-4 sentences. Be specific. Respond as JSON: {{"answer": "...", "clinical_basis": "..."}}"""

        ai_text = _try_gemini(context_prompt)
        if ai_text:
            ai_text = ai_text.strip()
            if ai_text.startswith("```"):
                parts = ai_text.split("```")
                ai_text = parts[1] if len(parts) > 1 else ai_text
                if ai_text.startswith("json"):
                    ai_text = ai_text[4:]
            data = json.loads(ai_text.strip())
            return ClinicalQueryResponse(
                answer=data.get("answer", base.answer),
                clinical_basis=data.get("clinical_basis", base.clinical_basis),
            )
    except Exception:
        pass

    return base
