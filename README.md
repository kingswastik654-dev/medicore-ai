# MediCore AI — Hospital Management Platform

Integrated hospital management platform (Phase 0 foundation) with a governed AI layer planned per `PRD.md`.

- **Backend**: FastAPI + SQLAlchemy 2 + PostgreSQL/SQLite, JWT auth, RBAC, immutable audit trail
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Tests**: 23 pytest cases covering auth, MPI duplicate detection, scheduling conflicts, billing lifecycle, audit logging

## Repository layout

```
├── PRD.md                  Product Requirements Document (full platform spec)
├── docker-compose.yml      PostgreSQL 16 + Redis for local/prod-parity dev
├── backend/
│   ├── app/
│   │   ├── main.py         App factory, CORS, write-audit middleware
│   │   ├── seed.py         Demo users, doctor schedules, service catalog
│   │   ├── core/           Settings, security (PBKDF2+JWT), RBAC deps
│   │   ├── db/             Engine/session (SQLite default, Postgres-ready)
│   │   ├── models/         Facility, User, Patient(MRN), Doctor/Schedule,
│   │   │                   Appointment, ServiceItem, Invoice/Payment, AuditLog
│   │   ├── schemas/        Pydantic v2 request/response models
│   │   ├── services/       MPI fuzzy duplicate scoring, audit recorder
│   │   └── api/v1/         auth, users, patients, appointments, billing,
│   │                       analytics, audits routers
│   └── tests/              pytest suite (TestClient, isolated per-run DB)
└── frontend/src/app/       login · dashboard · patients · appointments · billing · audit
```

## Quickstart

### Backend (port 8000)

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

First boot auto-creates tables and seeds demo data (`MEDCORE_AUTO_SEED=true` by default).
Interactive API docs: http://localhost:8000/docs

### Frontend (port 3000)

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 — set `NEXT_PUBLIC_API_URL` in `.env.local` to point elsewhere.

### Demo accounts (seeded)

| Username | Password | Role |
|---|---|---|
| admin | Admin@123 | SUPER_ADMIN |
| dr.house | Doctor@123 | DOCTOR (+ Mon–Fri clinic schedule) |
| reception.rekha | Reception@123 | RECEPTIONIST |
| cashier.amit | Cashier@123 | CASHIER |
| pharm.suresh | Pharma@123 | PHARMACIST |
| lab.vikram | Lab@12345 | LAB_TECH |
| auditor.meena | Auditor@123 | AUDITOR |

### Tests

```powershell
cd backend
python -m pytest tests -q
```

## Switching to PostgreSQL

```powershell
docker compose up -d
```
Then start the backend with:

```
MEDCORE_DATABASE_URL=postgresql://medcore:medcore@localhost:5432/medcore
```
(Tables auto-create on boot; Alembic migrations arrive in Phase 1.)

## Feature highlights

### Phase 0 — Foundation
- **Patient MPI** — sequential MRN, weighted fuzzy duplicate detection, block-and-confirm
  registration flow, safe merge that re-points appointments & invoices with full audit trail.
- **Scheduling** — slot grids from doctor schedules, double-booking guard via partial unique
  index, token numbers, enforced status machine, reschedule = cancel+rebook.
- **Billing** — catalog, line+invoice discounts (Decimal math), DRAFT→ISSUE lifecycle,
  partial payments with overpay protection.
- **Audit** — middleware logs every mutating call; PHI reads explicitly audited; queryable trail.

### Phase 1 — Clinical core
- **EMR** — encounters (OPD/IPD/EMERGENCY/TELE), vitals, SOAP notes (manual + AI source),
  ICD-10 diagnoses with primary-switching logic, encounter close workflow.
- **e-Prescription** — drug formulary with stock visibility, interaction matrix checks
  (severity-ranked), allergy cross-checks against patient record, warnings persisted on the Rx.
- **Pharmacy dispensing** — FEFO batch allocation (earliest expiry first), dispense blocked
  until MAJOR/MODERATE warnings are acknowledged, insufficient-stock rejection.
- **LIS** — test defs with reference & critical ranges, order→collect→result→verify lifecycle,
  STAT-first worklist, automatic abnormal/critical flagging on result entry.

### Phase 2 — AI copilot wave (governed)
- **AI gateway** — provider abstraction: deterministic heuristic engine by default; set
  `MEDCORE_AI_PROVIDER=openai` + `MEDCORE_OPENAI_API_KEY` to route through an LLM
  (auto-fallback to heuristics on failure). Every AI call is logged to `ai_interactions`
  and audited; clinicians can submit accept/reject feedback per interaction.
- **Ambient scribe** — transcript → structured SOAP draft with disclaimer; saving marks the
  note as `AI_SCRIBE`; signature stays with the clinician (HITL).
- **Coding copilot** — ICD-10 suggestions with confidence scores and cited evidence keywords.
- **RAG knowledge assistant** — protocol corpus (sepsis qSOFA, HTN, anticoagulation, diabetes)
  with scored retrieval + citations at `GET /api/ai/knowledge/search?q=`.
- **Conversational analytics** — natural-language questions over governed metrics
  (`POST /api/analytics/ask?question=...`), unsupported intents flagged honestly.

## Roadmap

See `PRD.md` §14. Remaining: IPD admission/discharge depth, RIS/PACS imaging, telehealth,
operations orchestration agents (bed/OR/staffing), denial-prediction agents, multi-facility
console, plugin marketplace.
