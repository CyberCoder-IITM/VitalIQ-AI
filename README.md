# VitalIQ — AI Clinical Co-Pilot

A real-time Emergency Department dashboard for physicians to monitor, triage, and make clinical decisions on multiple patients simultaneously.

> **Demo only. Synthetic data. Not for clinical use. Not FDA approved.**

---

## What it does

| Feature | Description |
|---|---|
| **Live Patient Board** | 8 patients, vitals streaming every 3s, sortable by NEWS2 / ICU risk / arrival |
| **NEWS2 Scoring** | Continuous Royal College of Physicians NEWS2 with per-component breakdown and escalation alerts |
| **ICU Admission Risk** | Probability score (0–100%) with 95% CI and risk category |
| **Sepsis Tracker** | qSOFA monitoring, bundle checklist, time-since-recognition countdown |
| **Medication Tracker** | Schedule, overdue flags, upcoming doses |
| **Drug Checker** | Cross-checks current meds for MAJOR / MODERATE / MINOR interactions |
| **AI Query Bar** | Natural language clinical questions answered from live patient data |
| **Vitals Monitor** | 6-channel live chart (HR, BP, RR, SpO₂, Temp, GCS) — last 60 points |
| **Lab Results** | Full panel with CRITICAL / HIGH / LOW flags |
| **Deterioration Forecast** | 5–15 min NEWS2 trend prediction |
| **Clinical Timeline** | Chronological event log per patient |
| **AI Triage Agent** | 15s department-wide acuity ranking cycle |
| **Risk History** | ICU risk sparklines over the patient's ED stay |
| **SBAR Handoff Generator** | One-click structured handoff note |
| **Command Center** | Department-wide overview modal |
| **Presentation Mode** | Clean display for rounds / large screens |
| **3 Color Themes** | Dark (navy), Midnight (black + green), Light (white) — persisted to localStorage |
| **Mobile Responsive** | Works on desktop, tablet, and phone |

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Charts | Recharts |
| State | Zustand |
| Data fetching | TanStack Query v5 + Orval-generated hooks |
| Backend | Python 3.11, FastAPI, Uvicorn |
| API contract | OpenAPI 3.0 → codegen via Orval |
| Monorepo | pnpm workspaces |

---

## Project structure

```
artifacts/
  api-server/          FastAPI backend — patients, vitals, AI routes
  vitaliq/             React frontend

lib/
  api-client/          Raw fetch client (generated)
  api-client-react/    TanStack Query hooks (generated)
  api-spec/            OpenAPI spec + Orval codegen config
```

---

## Running locally

Both services start automatically via Replit workflows. To start manually:

```bash
# Backend (port 8080)
cd artifacts/api-server
uvicorn main:app --host 0.0.0.0 --port 8080 --reload

# Frontend
pnpm --filter @workspace/vitaliq run dev
```

## Regenerate API client

```bash
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck:libs
```

---

## Patients (synthetic)

| ID | Name | Chief Complaint | Notable |
|---|---|---|---|
| p001 | James Wilson | Chest pain | Elevated troponin, STEMI? |
| p002 | Maria Santos | Shortness of breath | Sepsis confirmed, asthma |
| p003 | Robert Chen | Altered mental status | Stroke workup |
| p004 | Sarah Johnson | Abdominal pain | Ectopic pregnancy risk |
| p005 | Michael Brown | Syncope | Cardiac arrest risk |
| p006 | Emily Davis | Seizure | Status epilepticus |
| p007 | Thomas Lee | Back pain | Low acuity |
| p008 | Nancy White | Fall | Elderly, polypharmacy |

---

## AI Query examples

Ask anything about a patient using the bar at the bottom of their detail page:

- *"Explain the NEWS2 score"*
- *"Is this patient safe for discharge?"*
- *"What's causing the tachycardia?"*
- *"Should I worry about the troponin?"*
- *"What drug interactions are dangerous?"*
- *"What's the biggest risk right now?"*

Answers are generated from the patient's live vitals, labs, and medication data — citing NICE, ESC, and RCP guidelines.
