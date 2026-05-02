"""Drug interaction checker using real clinical interaction database."""
from models.schemas import DrugInteraction, InteractionSeverity, Medication
from typing import List, Tuple


def _key(a: str, b: str) -> Tuple[str, str]:
    return tuple(sorted([a.lower().strip(), b.lower().strip()]))


INTERACTION_DATABASE: dict[Tuple[str, str], DrugInteraction] = {
    _key("warfarin", "ibuprofen"): DrugInteraction(
        drug_a="Warfarin",
        drug_b="Ibuprofen",
        severity=InteractionSeverity.MAJOR,
        mechanism="NSAIDs inhibit platelet aggregation and may displace warfarin from protein binding sites",
        effect="Significantly increased bleeding risk, possible GI hemorrhage",
        recommendation="Avoid combination. Use acetaminophen for analgesia if needed.",
        monitor="INR closely if combination unavoidable",
    ),
    _key("digoxin", "furosemide"): DrugInteraction(
        drug_a="Digoxin",
        drug_b="Furosemide",
        severity=InteractionSeverity.MODERATE,
        mechanism="Furosemide causes hypokalemia which potentiates digoxin toxicity",
        effect="Increased risk of digoxin toxicity: arrhythmias, nausea, visual disturbances",
        recommendation="Monitor serum potassium and digoxin levels. Supplement K+ as needed.",
        monitor="Serum K+, digoxin levels, ECG",
    ),
    _key("metoprolol", "digoxin"): DrugInteraction(
        drug_a="Metoprolol",
        drug_b="Digoxin",
        severity=InteractionSeverity.MODERATE,
        mechanism="Additive AV node depression",
        effect="Risk of severe bradycardia and heart block",
        recommendation="Monitor heart rate closely. Reduce doses if HR < 50 bpm.",
        monitor="Heart rate, ECG",
    ),
    _key("warfarin", "amiodarone"): DrugInteraction(
        drug_a="Warfarin",
        drug_b="Amiodarone",
        severity=InteractionSeverity.MAJOR,
        mechanism="Amiodarone inhibits CYP2C9 metabolism of warfarin",
        effect="2-3x increase in INR, major bleeding risk",
        recommendation="Reduce warfarin dose by 30-50%. Monitor INR weekly initially.",
        monitor="INR twice weekly for first month",
    ),
    _key("levetiracetam", "carbamazepine"): DrugInteraction(
        drug_a="Levetiracetam",
        drug_b="Carbamazepine",
        severity=InteractionSeverity.MODERATE,
        mechanism="Carbamazepine induces CYP450 enzymes reducing levetiracetam levels",
        effect="Reduced seizure control",
        recommendation="May need to increase levetiracetam dose",
        monitor="Seizure frequency, drug levels",
    ),
    _key("lisinopril", "spironolactone"): DrugInteraction(
        drug_a="Lisinopril",
        drug_b="Spironolactone",
        severity=InteractionSeverity.MAJOR,
        mechanism="Both ACE inhibitors and K+-sparing diuretics increase serum potassium",
        effect="Life-threatening hyperkalemia (K+ > 6.0 mEq/L), fatal arrhythmias",
        recommendation="Avoid in renal impairment. Monitor K+ levels closely if used together.",
        monitor="Serum K+, renal function every 1-2 weeks initially",
    ),
    _key("lisinopril", "amiloride"): DrugInteraction(
        drug_a="Lisinopril",
        drug_b="Amiloride",
        severity=InteractionSeverity.MAJOR,
        mechanism="Additive potassium retention — ACE inhibitor + K+-sparing diuretic",
        effect="Hyperkalemia with risk of cardiac arrest",
        recommendation="Avoid combination or monitor K+ very closely",
        monitor="Serum potassium, creatinine weekly",
    ),
    _key("sertraline", "ibuprofen"): DrugInteraction(
        drug_a="Sertraline",
        drug_b="Ibuprofen",
        severity=InteractionSeverity.MODERATE,
        mechanism="SSRIs inhibit platelet serotonin reuptake; NSAIDs inhibit prostaglandin-mediated hemostasis",
        effect="3-15x increased risk of upper GI bleeding",
        recommendation="Avoid if possible. Use acetaminophen. Add PPI if NSAID necessary.",
        monitor="Signs of GI bleeding, CBC",
    ),
    _key("fluoxetine", "ibuprofen"): DrugInteraction(
        drug_a="Fluoxetine",
        drug_b="Ibuprofen",
        severity=InteractionSeverity.MODERATE,
        mechanism="SSRIs inhibit platelet serotonin reuptake; NSAIDs inhibit prostaglandin-mediated hemostasis",
        effect="Increased risk of GI and intracranial bleeding",
        recommendation="Add gastroprotection (PPI) or switch to acetaminophen",
        monitor="Signs of bleeding, hemoglobin",
    ),
    _key("ciprofloxacin", "antacid"): DrugInteraction(
        drug_a="Ciprofloxacin",
        drug_b="Antacid",
        severity=InteractionSeverity.MODERATE,
        mechanism="Divalent cations (Mg2+, Al3+, Ca2+) form insoluble chelates with fluoroquinolones",
        effect="Up to 90% reduction in ciprofloxacin absorption",
        recommendation="Administer ciprofloxacin 2 hours before or 6 hours after antacids",
        monitor="Therapeutic response to ciprofloxacin",
    ),
    _key("atorvastatin", "clarithromycin"): DrugInteraction(
        drug_a="Atorvastatin",
        drug_b="Clarithromycin",
        severity=InteractionSeverity.MAJOR,
        mechanism="CYP3A4 inhibition by macrolide → markedly elevated statin levels",
        effect="Severe myopathy, rhabdomyolysis risk",
        recommendation="Temporarily discontinue statin during antibiotic course",
        monitor="CK levels, muscle symptoms, LFTs",
    ),
    _key("simvastatin", "erythromycin"): DrugInteraction(
        drug_a="Simvastatin",
        drug_b="Erythromycin",
        severity=InteractionSeverity.MAJOR,
        mechanism="CYP3A4 inhibition by macrolide → elevated simvastatin levels",
        effect="Rhabdomyolysis, acute kidney injury",
        recommendation="Use alternative antibiotic or temporarily hold statin",
        monitor="CK, renal function, myalgia",
    ),
    _key("phenelzine", "sertraline"): DrugInteraction(
        drug_a="Phenelzine",
        drug_b="Sertraline",
        severity=InteractionSeverity.MAJOR,
        mechanism="MAOIs + SSRIs = excess serotonergic stimulation via multiple pathways",
        effect="Serotonin syndrome: hyperthermia, agitation, clonus, autonomic instability — FATAL",
        recommendation="CONTRAINDICATED. 14-day washout after MAOI before starting SSRI.",
        monitor="Immediately discontinue both if serotonin syndrome suspected",
    ),
    _key("metoprolol", "verapamil"): DrugInteraction(
        drug_a="Metoprolol",
        drug_b="Verapamil",
        severity=InteractionSeverity.MAJOR,
        mechanism="Additive negative chronotropic and inotropic effects — dual AV node blockade",
        effect="Complete heart block, severe bradycardia, hemodynamic collapse",
        recommendation="Avoid IV combination. Use extreme caution with oral. Consider alternatives.",
        monitor="Heart rate, ECG, blood pressure, rhythm",
    ),
    _key("carvedilol", "verapamil"): DrugInteraction(
        drug_a="Carvedilol",
        drug_b="Verapamil",
        severity=InteractionSeverity.MAJOR,
        mechanism="Combined negative chronotropic and inotropic effect — beta blocker + CCB",
        effect="Bradycardia, AV block, hypotension, heart failure exacerbation",
        recommendation="Avoid IV combination. Monitor closely if oral combination required.",
        monitor="HR, BP, ECG, signs of heart failure",
    ),
    _key("morphine", "lorazepam"): DrugInteraction(
        drug_a="Morphine",
        drug_b="Lorazepam",
        severity=InteractionSeverity.MAJOR,
        mechanism="CNS/respiratory depression is additive — both act on brainstem respiratory centers",
        effect="FATAL respiratory depression, loss of consciousness — BLACK BOX WARNING",
        recommendation="Avoid concurrent use. If necessary, use lowest effective doses with resuscitation available.",
        monitor="Respiratory rate, SpO2, mental status continuously",
    ),
    _key("oxycodone", "diazepam"): DrugInteraction(
        drug_a="Oxycodone",
        drug_b="Diazepam",
        severity=InteractionSeverity.MAJOR,
        mechanism="Additive CNS and respiratory depression",
        effect="Fatal respiratory depression — BLACK BOX WARNING",
        recommendation="Avoid combination. If necessary, titrate to minimum effective doses.",
        monitor="Respiratory rate, pulse oximetry, consciousness level",
    ),
    _key("warfarin", "aspirin"): DrugInteraction(
        drug_a="Warfarin",
        drug_b="Aspirin",
        severity=InteractionSeverity.MODERATE,
        mechanism="Aspirin inhibits platelet aggregation and may displace warfarin from albumin",
        effect="Increased bleeding risk, particularly GI hemorrhage",
        recommendation="Low-dose aspirin (81mg) acceptable if clinically indicated; avoid higher doses",
        monitor="INR, signs of bleeding, stool occult blood",
    ),
    _key("digoxin", "carvedilol"): DrugInteraction(
        drug_a="Digoxin",
        drug_b="Carvedilol",
        severity=InteractionSeverity.MODERATE,
        mechanism="Carvedilol inhibits P-glycoprotein, increasing digoxin serum levels; additive AV block",
        effect="Digoxin toxicity, bradycardia, heart block",
        recommendation="Reduce digoxin dose by 50% when initiating carvedilol. Monitor levels.",
        monitor="Digoxin levels, HR, ECG",
    ),
    _key("metformin", "contrast"): DrugInteraction(
        drug_a="Metformin",
        drug_b="Contrast dye",
        severity=InteractionSeverity.MODERATE,
        mechanism="Contrast-induced nephropathy reduces metformin clearance → lactic acidosis",
        effect="Lactic acidosis (rare but serious), renal failure",
        recommendation="Hold metformin 48h before and after IV contrast. Ensure renal function normal.",
        monitor="Renal function, lactate levels",
    ),
    _key("amlodipine", "simvastatin"): DrugInteraction(
        drug_a="Amlodipine",
        drug_b="Simvastatin",
        severity=InteractionSeverity.MODERATE,
        mechanism="Amlodipine inhibits CYP3A4 metabolism of simvastatin",
        effect="Elevated simvastatin levels, myopathy risk",
        recommendation="Limit simvastatin dose to 20mg/day when combined with amlodipine",
        monitor="CK levels, muscle pain or weakness",
    ),
    _key("furosemide", "gentamicin"): DrugInteraction(
        drug_a="Furosemide",
        drug_b="Gentamicin",
        severity=InteractionSeverity.MAJOR,
        mechanism="Loop diuretics potentiate aminoglycoside ototoxicity and nephrotoxicity",
        effect="Irreversible sensorineural hearing loss, acute kidney injury",
        recommendation="Avoid combination if possible. Monitor renal function and hearing.",
        monitor="Creatinine, BUN, audiometry, gentamicin levels",
    ),
    _key("albuterol", "metoprolol"): DrugInteraction(
        drug_a="Albuterol",
        drug_b="Metoprolol",
        severity=InteractionSeverity.MODERATE,
        mechanism="Beta-1 selective blockers can reduce bronchodilator response to albuterol",
        effect="Reduced bronchodilation efficacy; possible paradoxical bronchospasm",
        recommendation="Use with caution in asthma. Consider cardioselective beta-blocker at lowest dose.",
        monitor="Peak flow, respiratory symptoms, FEV1",
    ),
    _key("warfarin", "fluconazole"): DrugInteraction(
        drug_a="Warfarin",
        drug_b="Fluconazole",
        severity=InteractionSeverity.MAJOR,
        mechanism="Fluconazole strongly inhibits CYP2C9 — primary metabolic pathway for warfarin",
        effect="2-4x elevation in INR, life-threatening hemorrhage",
        recommendation="Reduce warfarin dose by 50%. Monitor INR every 2-3 days.",
        monitor="INR very closely for 7-14 days",
    ),
}


def _normalize_drug_name(name: str) -> str:
    """Normalize drug name for matching — strip dose, route, etc."""
    return name.lower().split()[0].strip()


def check_interactions(medications: List[Medication]) -> List[DrugInteraction]:
    """Check all pairwise drug interactions. Returns sorted by severity (MAJOR first)."""
    found: List[DrugInteraction] = []
    seen: set = set()
    names = [_normalize_drug_name(m.name) for m in medications]

    severity_order = {InteractionSeverity.MAJOR: 0, InteractionSeverity.MODERATE: 1, InteractionSeverity.MINOR: 2}

    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            key = _key(names[i], names[j])
            if key in seen:
                continue
            seen.add(key)
            if key in INTERACTION_DATABASE:
                found.append(INTERACTION_DATABASE[key])

    found.sort(key=lambda x: severity_order.get(x.severity, 3))
    return found


def check_new_drug(new_drug: str, current_medications: List[Medication]) -> List[DrugInteraction]:
    """Check a new drug against current medications."""
    new_name = _normalize_drug_name(new_drug)
    found: List[DrugInteraction] = []

    severity_order = {InteractionSeverity.MAJOR: 0, InteractionSeverity.MODERATE: 1, InteractionSeverity.MINOR: 2}

    for med in current_medications:
        existing_name = _normalize_drug_name(med.name)
        key = _key(new_name, existing_name)
        if key in INTERACTION_DATABASE:
            found.append(INTERACTION_DATABASE[key])

    found.sort(key=lambda x: severity_order.get(x.severity, 3))
    return found
