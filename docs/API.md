# MediCore AI — REST API Reference

Base URL: `http://localhost:8001` (dev) · Interactive docs: `/docs` (Swagger UI) · OpenAPI schema: `/openapi.json`

## Authentication

All endpoints except `POST /api/auth/login` and `GET /health` require a bearer token:

```
Authorization: Bearer <access_token>
```

Tokens are JWTs (HS256) valid for 12 h. Roles enforced per endpoint; `SUPER_ADMIN` bypasses role checks.

**Error shape:** `{"detail": "<message>"}` or `{"detail": [{"msg": "...", ...}]}` for validation errors.
**Audit:** every mutating call is logged automatically; PHI reads/lists are explicitly audited.

---

## 1 · System

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness probe (no auth) |

## 2 · Auth (`/api/auth`)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/auth/login` | public | Exchange username+password for JWT + user profile |
| GET | `/auth/me` | any staff | Current user profile from token |

## 3 · Users & Staff (`/api/users`, `/api/doctors`) — admin only

| Method | Path | Purpose |
|---|---|---|
| GET | `/users?q=&role=` | List staff with search/role filter |
| POST | `/users` | Create staff member (auto-creates doctor profile when role=DOCTOR) |
| PATCH | `/users/{id}` | Rename, reset password, activate/deactivate |
| POST | `/users/{id}/doctor-profile` | Attach/update specialty, registration no, fee |
| GET | `/doctors` | Public-to-staff list of active doctors (for booking UIs) |

## 4 · Patients / MPI (`/api/patients`)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/patients/check-duplicates` | any staff | Score potential duplicates before registering |
| POST | `/patients?force=` | RECEPTIONIST, NURSE, DOCTOR | Register patient; blocks with `potential_duplicates` unless `force=true` |
| GET | `/patients?q=&page=&page_size=` | any staff | Search by MRN/name/phone/national-ID/ABHA |
| GET | `/patients/{id}` | any staff | Full record (PHI read → audited) |
| PUT | `/patients/{id}` | RECEPTIONIST, NURSE, DOCTOR | Update demographics |
| POST | `/patients/{id}/merge` | RECEPTIONIST | Merge duplicate into survivor; re-points appointments & invoices |

Duplicate scoring: national/ABHA exact = 100 · phone match +50 · DOB +30 · name-ratio ≥0.92 +25 /
≥0.82 +10 · DOB+name combo bonus +15 · threshold 60.

## 5 · Appointments (`/api/appointments`, `/api/doctors/{id}/slots`)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/doctors/{id}/slots?date=` | any staff | Generated slot grid with availability |
| POST | `/appointments` | RECEPTIONIST, NURSE, DOCTOR | Book slot (409 on conflict); assigns token # |
| GET | `/appointments?date=&doctor_profile_id=&patient_id=&status=` | any staff | Day queue / patient history |
| PATCH | `/appointments/{id}/status` | RECEPTIONIST, NURSE, DOCTOR | Enforced machine: BOOKED→CHECKED_IN→IN_PROGRESS→COMPLETED (+CANCELLED/NO_SHOW) |
| POST | `/appointments/{id}/reschedule` | RECEPTIONIST, NURSE, DOCTOR | Cancel + rebook atomically |

Slot uniqueness uses a partial index — only ACTIVE bookings hold a slot; completed/cancelled release it.

## 6 · EMR (`/api/encounters`)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/encounters` | DOCTOR | Open OPD/IPD/EMERGENCY/TELE encounter (auto-links own doctor profile) |
| GET | `/encounters?status=&patient_id=` | any staff | Encounter list with notes/dx/vitals embedded |
| GET | `/encounters/{id}` | any staff | Full encounter detail |
| POST | `/encounters/{id}/vitals` | DOCTOR, NURSE | Record temp/pulse/SpO₂/BP/resp rate |
| POST | `/encounters/{id}/notes` | DOCTOR, NURSE | Signed note; `source: MANUAL \| AI_SCRIBE` |
| POST | `/encounters/{id}/diagnoses` | DOCTOR | ICD-10 dx; `is_primary` switches exclusively |
| POST | `/encounters/{id}/close` | DOCTOR | Close encounter |

## 7 · Pharmacy (`/api/drugs`, `/api/prescriptions`)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/drugs?q=` | any staff | Formulary with live in-stock quantity |
| POST | `/drugs` · POST `/drugs/{id}/batches` | FACILITY_ADMIN / PHARMACIST | Add drugs & stock batches |
| POST | `/prescriptions` | DOCTOR | Create e-Rx; runs interaction matrix + allergy checks; warnings persisted |
| GET | `/prescriptions?patient_id=&status=` | any staff | Prescription list incl. warnings |
| POST | `/prescriptions/{id}/dispense` | PHARMACIST, CASHIER | FEFO batch allocation; requires `acknowledge_warnings:true` when MAJOR/MODERATE; 409 on shortfall |

Interaction severities: MAJOR/MODERATE/MINOR (seeded pair: Aspirin+Warfarin MAJOR).
Allergy check matches patient's allergy tokens against drug/generic names.

## 8 · Laboratory (`/api/lab`)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/lab/tests` | any staff | Test catalog with reference & critical ranges |
| POST | `/lab/tests` | FACILITY_ADMIN | Define test (ranges, TAT, price) |
| POST | `/lab/orders` | DOCTOR, NURSE | Order test (ROUTINE/URGENT/STAT) against patient/encounter |
| GET | `/lab/orders?status=&patient_id=` | any staff | Worklist, STAT-first ordering |
| POST | `/lab/orders/{id}/collect` | LAB_TECH, NURSE | Sample collected |
| POST | `/lab/orders/{id}/result` | LAB_TECH | Enter numeric/text result → auto abnormal/critical flags |
| POST | `/lab/orders/{id}/verify` | LAB_TECH, DOCTOR | Verify result → report final |

Lifecycle: ORDERED → SAMPLE_COLLECTED → RESULTED → VERIFIED. Critical values return `critical_alert: true`.

## 9 · Billing (`/api/services`, `/api/invoices`)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/services?category=` | any staff | Billable service catalog |
| POST | `/services` | FACILITY_ADMIN | Add service item |
| POST | `/invoices` | RECEPTIONIST, CASHIER | Create DRAFT invoice (server-side Decimal totals) |
| GET | `/invoices?patient_id=&status=&date=` · GET `/invoices/{id}` | any staff | Invoice lists/detail |
| POST | `/invoices/{id}/issue` | RECEPTIONIST, CASHIER | DRAFT→ISSUED, assigns `INV-YYYYMMDD-####` |
| POST | `/invoices/{id}/cancel` | RECEPTIONIST, CASHIER | Cancel unpaid invoice |
| POST | `/invoices/{id}/payments` | CASHIER, RECEPTIONIST | Record payment (CASH/CARD/UPI/INSURANCE/CHEQUE); overpay rejected; status → PARTIALLY_PAID/PAID |

## 10 · Analytics (`/api/analytics`)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/analytics/summary` | any staff | Patients, appointments today, revenue today/lifetime, outstanding |
| POST | `/analytics/ask?question=` | any staff | NL question over governed metrics; unsupported questions flagged `supported:false` |

Supported intents today: *revenue today · outstanding dues · total patients · appointments today · completed today*.

## 11 · Audit Trail (`/api/audits`) — SUPER_ADMIN, FACILITY_ADMIN, AUDITOR

| Method | Path | Purpose |
|---|---|---|
| GET | `/audits?page=&action=&resource_type=&patient_id=` | Query immutable log: actor, action, resource, patient link, IP, detail, timestamp |

Automatic entries: every non-GET API call (middleware) · LOGIN_SUCCESS/FAILED · PHI READ/LIST · CREATE/UPDATE/CLOSE encounters · RESULT/VERIFY labs · PAYMENT · DISPENSE · MERGE.

## 13 · IPD / Bed Management (`/api/ipd`)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/ipd/wards` | any staff | Wards with bed totals & availability |
| POST | `/ipd/wards` | FACILITY_ADMIN | Create ward |
| GET | `/ipd/beds?ward_id=&status=` | any staff | Bed list incl. current occupant |
| POST | `/ipd/beds` | FACILITY_ADMIN | Add bed to ward |
| POST | `/ipd/admissions` | RECEPTIONIST, DOCTOR | Admit patient; auto-creates IPD encounter; picks free bed by `bed_id` or `ward_code`; patient can't have 2 active admissions |
| POST | `/ipd/admissions/{id}/transfer` | DOCTOR | Move patient → target bed; old bed → CLEANING |
| POST | `/ipd/admissions/{id}/discharge` | DOCTOR | Discharge; bed → CLEANING; closes IPD encounter |
| POST | `/ipd/beds/{id}/ready` | RECEPTIONIST, NURSE, FACILITY_ADMIN | CLEANING/MAINTENANCE → AVAILABLE |
| POST | `/ipd/beds/{id}/maintenance` | FACILITY_ADMIN | Toggle maintenance hold |
| GET | `/ipd/occupancy` | any staff | Per-ward + overall occupancy % |

Bed lifecycle: AVAILABLE → OCCUPIED → (discharge) → CLEANING → AVAILABLE.

## 14 · Phase-3 Ops Agents (`/api/ai/ops`)

All outputs are advisory (risk tier T0/T1) and logged to `ai_interactions`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/ai/ops/forecast/opd?days=` | OPD visit forecast per upcoming day — weekday seasonality × trend from 42-day history, ±15% range, low/med confidence |
| GET | `/ai/ops/bed-suggestions` | Discharge-readiness per active admission: score 5–100 with blockers (urgent lab orders pending, open encounter, overdue stay, outstanding balance), most-ready first |
| POST | `/ai/ops/denials/score?invoice_id=` | Pre-submission denial risk on an invoice: factors (high value >₹25k, discount >15%, missing phone/national ID, coding gaps) → LOW/MEDIUM/HIGH tier + recommended action |
| GET | `/ai/ops/rcm/ar-priorities?limit=` | Outstanding invoices ranked by recoverability (amount × age weight), age buckets with suggested next action |



## 12 · AI Layer (`/api/ai`)

Governance defaults: **risk tier T0/T1 only** — AI drafts/suggests, humans approve. Provider is
pluggable via env (`MEDCORE_AI_PROVIDER=openai` + `MEDCORE_OPENAI_API_KEY`; heuristic engine
otherwise, so the platform runs fully offline).

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/ai/scribe/draft` | DOCTOR, NURSE | Transcript → structured SOAP draft (+provider/model/disclaimer) |
| POST | `/ai/knowledge/search?q=` | any staff | RAG search over protocol corpus; scored hits with citations |
| POST | `/ai/coding/suggest` | any staff | Clinical text → ranked ICD-10 suggestions w/ confidence + evidence spans |
| POST | `/ai/feedback/{interaction_id}` | owner of interaction | Accept/reject an AI output → stored on `ai_interactions` |

Every AI call writes to `ai_interactions` (feature, provider, model, input/output summaries,
acceptance feedback) — the dataset for the Phase 3 evaluation harness.

### AI environment variables

| Variable | Default | Purpose |
|---|---|---|
| `MEDCORE_AI_PROVIDER` | `heuristic` | `openai` enables LLM routing |
| `MEDCORE_OPENAI_API_KEY` | *(empty)* | Key; empty ⇒ heuristics |
| `MEDCORE_OPENAI_MODEL` | `gpt-4o-mini` | Chat model id |
| `MEDCORE_OPENAI_BASE_URL` | `https://api.openai.com/v1` | Point at Azure/self-hosted gateways |
