# Product Requirements Document (PRD)

# MediCore AI — Intelligent Hospital Management Platform

| | |
|---|---|
| **Document Version** | 1.0 |
| **Date** | 2026-08-24 |
| **Status** | Draft — Pending Stakeholder Review |
| **Product** | Hospital Management Platform with Integrated AI |
| **Owner** | Product Team |
| **Stakeholders** | Hospital Leadership, Clinical Staff, IT/Security, Finance, Patients |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Vision & Objectives](#3-vision--objectives)
4. [Success Metrics / KPIs](#4-success-metrics--kpis)
5. [Target Users & Personas](#5-target-users--personas)
6. [Scope](#6-scope)
7. [Functional Requirements — Core Modules](#7-functional-requirements--core-modules)
8. [AI Capabilities — Detailed Requirements](#8-ai-capabilities--detailed-requirements)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Compliance, Security & Privacy](#10-compliance-security--privacy)
11. [System Architecture & Tech Stack](#11-system-architecture--tech-stack)
12. [Interoperability & Integrations](#12-interoperability--integrations)
13. [AI Governance Framework](#13-ai-governance-framework)
14. [Release Plan & Phasing](#14-release-plan--phasing)
15. [Risks & Mitigations](#15-risks--mitigations)
16. [Out of Scope (v1)](#16-out-of-scope-v1)
17. [Open Questions](#17-open-questions)
18. [Appendix: Glossary](#18-appendix-glossary)

---

## 1. Executive Summary

MediCore AI is an end-to-end, cloud-native Hospital Management Platform (HMS/HIS) that unifies **patient access, clinical care, diagnostics, pharmacy, revenue cycle, and administration** on one integrated system — augmented by a governed **AI layer** that automates documentation, predicts operational bottlenecks, assists clinical decisions, and optimizes the revenue cycle.

Unlike fragmented point solutions, MediCore AI operates as a single source of truth where every department works from the same patient record, and AI agents act as an intelligence layer across all workflows ("systems of record" → "systems of action").

**Key differentiators:**
- AI ambient scribe that reduces clinician documentation time by ~40%
- Agentic AI orchestration for bed management, staffing forecasts, and revenue-cycle automation
- Conversational analytics ("Ask your hospital anything") for leadership
- Standards-first core: FHIR R4/R5, HL7 v2, SNOMED CT, LOINC, ICD-10, DICOM
- Human-in-the-loop governance — AI drafts/suggests; clinicians always decide
- Deployable as SaaS, single-tenant cloud, or fully on-premise (including self-hosted LLMs)

---

## 2. Problem Statement

Hospitals today face:

| Pain Point | Impact |
|---|---|
| Fragmented systems (EHR, lab, pharmacy, billing silos) | Data debt, manual reconciliation, errors |
| Clinician documentation burden | 40–50% of clinician time spent on admin; burnout |
| Reactive operations (beds, staff, OR scheduling) | Long waits, bed turnover >110 min, idle OT time |
| Revenue leakage (claim denials, coding errors) | Denial rates rising; slow cash flow; lost revenue |
| Delayed information access | Leaders wait for reports instead of acting live |
| Patient experience gaps | Queue chaos, no visibility into status/bills |
| Compliance pressure | HIPAA/GDPR/DPDP/NABH/JCI audits are painful without unified audit trails |

Legacy HMS vendors treat AI as a roadmap line item. There is no widely deployed, affordable, standards-first platform where AI is embedded natively across every workflow with proper governance.

---

## 3. Vision & Objectives

### Vision
> "Every hospital runs as one connected, intelligent organism — predicting demand, orchestrating resources, and freeing clinicians to focus on care, not clicks."

### Product Objectives
1. **Unify** all hospital departments on a single database and patient record.
2. **Automate** high-friction documentation and administrative workflows with AI.
3. **Predict** demand and risk (patient volume, deterioration, denials, stock-outs) before they impact care.
4. **Orchestrate** beds, staff, ORs, and supplies in real time via agentic AI.
5. **Comply** with healthcare regulations out-of-the-box (audit logs everywhere, PHI encryption, consent management).
6. **Interoperate** with existing ecosystems (legacy EHRs, devices, insurers, national health rails).

---

## 4. Success Metrics / KPIs

### Operational
| Metric | Baseline (Industry Avg.) | Target |
|---|---|---|
| Bed turnover time | ~111 min | ≤ 60 min (−45%) |
| Average length of stay (LOS) | — | −0.5 to 1.0 day |
| OPD patient wait time | 30–90 min | ≤ 20 min |
| OT utilization | ~60–70% | ≥ 85% |
| Discharge processing time | 4–8 hrs | ≤ 2 hrs |

### Clinical
| Metric | Target |
|---|---|
| Documentation time per encounter | −40% |
| Prescription error rate | −50% (via interaction checks) |
| Deterioration index coverage (ICU vitals freshness) | ≥ 95% |
| Sepsis/stroke protocol timeline compliance | +30% |

### Financial
| Metric | Target |
|---|---|
| Claim denial rate | −30% |
| Days in accounts receivable | −25% |
| Agency/premium labor spend | −25% |
| Inventory carrying cost | −15–22% |

### Adoption & Experience
| Metric | Target |
|---|---|
| Clinician EHR satisfaction (system usability score) | ≥ 75th percentile |
| AI suggestion acceptance rate | ≥ 70% |
| Patient portal activation | ≥ 40% of active patients |
| System uptime | 99.9% |

---

## 5. Target Users & Personas

| Persona | Role | Primary Needs |
|---|---|---|
| **Dr. Aisha — Attending Physician** | OPD/IPD consultation, orders, notes | Fast charting, ambient scribe, instant patient history, decision support |
| **Nurse Priya — Ward Nurse** | Vitals, medication administration, handover | Task lists, alerts, low-click workflows, virtual nursing tools |
| **Rahul — Front Desk / Registration** | Registration, appointments, queues | Quick registration (<60 sec), token display, insurance capture |
| **Sunita — Pharmacist** | Dispensing, stock, expiry | e-Rx validation, batch/expiry tracking, reorder suggestions |
| **Lab Tech Vijay — Lab/Radiology** | Sample tracking, results entry | Worklists, analyzer integration, critical value alerts |
| **Meera — Billing/TPA Officer** | Billing, claims, pre-auths | Clean claims, denial prediction, cashless workflows |
| **Anil — COO / Administrator** | Operations, capacity, staffing | Live dashboards, occupancy forecasting, discharge planning |
| **Dr. Kavita — CMO / Quality Head** | Quality, infection control, accreditation | NABH/JCI indicators, HAI surveillance, audit readiness |
| **Patient (Mr. Sharma)** | Care recipient | Online booking, reports access, bills, teleconsultation |
| **IT Admin (Sanjay)** | System administration | RBAC, integrations, monitoring, deployment options |

**Facility types supported:** Single clinic → nursing home → multi-specialty hospital (50–500+ beds) → multi-branch hospital chains.

---

## 6. Scope

### In Scope (v1–v3)
- All modules listed in Section 7 (phased delivery)
- AI layer per Section 8
- FHIR R4 API surface, HL7 v2 ingestion, DICOM connectivity
- Web app (desktop-first for staff), responsive mobile web, patient portal, doctor mobile app (PWA)
- Multi-facility support with data isolation
- Deployment: SaaS, private cloud, on-prem

### Out of Scope (see Section 16)

---

## 7. Functional Requirements — Core Modules

Requirements are written as testable statements ("The system shall…"), grouped by module. Modules map to the industry-standard 15-module HMS model, extended with AI.

### 7.1 Patient Registration & Master Index (MPI)
- FR-REG-01: Register patients with a unique persistent MRN; support Aadhaar/ABHA/national ID linkage.
- FR-REG-02: Detect and prevent duplicate records via fuzzy matching (name + DOB + phone); merge duplicates with full audit trail.
- FR-REG-03: Capture demographics, contacts, insurance/TPA details, allergies, blood group, organ-donor status.
- FR-REG-04: Support walk-in, online self-registration, and referral intake.
- FR-REG-05: Maintain consent records (treatment, data sharing, marketing opt-out).

### 7.2 Appointments, OPD & Queue Management
- FR-OPD-01: Book/reschedule/cancel appointments by web portal, mobile app, front desk, phone, WhatsApp bot.
- FR-OPD-02: Manage doctor schedules, leave, session templates, and slot capacities (incl. tele-consultation slots).
- FR-OPD-03: Issue tokens; display live queue on screens and patient app with ETA predictions.
- FR-OPD-04: Triage capture at check-in (chief complaint, vitals, urgency flags).
- FR-OPD-05: Handle no-shows with automated follow-up/rebooking flows.

### 7.3 IPD, Bed & Ward Management
- FR-IPD-01: Manage admissions (planned/emergency), transfers (ward↔ward, ICU), discharges (LAMA, expired, normal), and bed allocation.
- FR-IPD-02: Real-time bed board with occupancy, housekeeping status, and pending discharges.
- FR-IPD-03: Nursing station worklist: vitals schedule (configurable frequency), meds due, tasks, handover (SBAR format).
- FR-IPD-04: Track diet orders, input/output charts, pain scores, fall-risk and pressure-ulcer scores.
- FR-IPD-05: Discharge workflow: summary generation, clearance checklist (billing, pharmacy returns), TPA final bill.

### 7.4 EMR / EHR & Clinical Documentation
- FR-EMR-01: Lifetime longitudinal patient record: encounters, diagnoses (ICD-10/11), problems list, medications, allergies, immunizations, family/social history, documents/scans.
- FR-EMR-02: Configurable specialty templates and structured forms (SOAP notes, progress notes).
- FR-EMR-03: e-Prescriptions with dosage, route, frequency, duration; one-tap favorites; controlled-substance handling.
- FR-EMR-04: Order entry (lab, radiology, procedures, consults) with clinical indication capture.
- FR-EMR-05: Versioned records — every edit retained; nothing hard-deleted.
- FR-EMR-06: Medical Records Department (MRD): record locking after discharge, release/amendment workflow, retention policies.

### 7.5 Laboratory Information System (LIS)
- FR-LAB-01: Test catalog with profiles/panels, reference ranges (age/sex-specific), LOINC mapping.
- FR-LAB-02: Phlebotomy worklists, sample collection with barcode labeling, chain-of-custody tracking.
- FR-LAB-03: Result entry (manual + bidirectional analyzer interface via HL7/ASTM); auto-validation rules; delta checks.
- FR-LAB-04: Critical value alerts with acknowledgment loop (to ordering clinician's device within 60 seconds).
- FR-LAB-05: Report delivery to EMR, patient portal, WhatsApp/email/PDF.
- FR-LAB-06: QC (quality control) tracking, TAT dashboards, pending-sample escalation.

### 7.6 Radiology Information System (RIS) & PACS
- FR-RAD-01: Modality order dispatch, modality worklist (DICOM MWL), technologist worklist.
- FR-RAD-02: PACS integration (viewer embed or bundled open-source viewer, e.g., OHIF) — view images against reports.
- FR-RAD-03: Structured reporting templates; radiologist sign-off workflow; preliminary/final report states.
- FR-RAD-04: AI-assisted triage flags from imaging AI partners (e.g., suspected hemorrhage) surfaced as priority markers.

### 7.7 Pharmacy & Inventory
- FR-PHM-01: Formulary/drug master with generic-brand mapping, schedules (H, H1, narcotic), ATC codes.
- FR-PHM-02: Dispense against e-Rx only; interaction/allergy/duplicate-therapy hard-stop warnings (override requires reason code).
- FR-PHM-03: Batch/expiry tracking, FEFO dispensing, near-expiry alerts (90/30/7 days).
- FR-PHM-04: Stock management across stores: GRN, indents, inter-store transfer, physical count reconciliation.
- FR-PHM-05: Par-level reordering with purchase requisition → PO workflow; supplier management.
- FR-PHM-06: Narcotics register with double-lock custody and regulatory reports.
- FR-PHM-07: General inventory for consumables, implants, linen, equipment (asset tags, AMC scheduling).

### 7.8 Operation Theatre (OT) Management
- FR-OT-01: OT booking linked to surgeon schedule, anesthesia assessment (pre-op clearance), and equipment/instrument sets.
- FR-OT-02: Surgical safety checklist (WHO SSC) enforced digitally at Sign-In / Time-Out / Sign-Out.
- FR-OT-03: Case cards: procedure (ICD-10-PCS/CPT), implant consumption (lot traceability), anesthesia records, recovery/PACU tracking.
- FR-OT-04: OT utilization analytics: start delays, cancellation reasons, turnaround.

### 7.9 Blood Bank *(optional module)*
- FR-BB-01: Donor registry, eligibility screening, donation tracking, adverse reactions.
- FR-BB-02: Component separation, inventory by group/component, expiry management.
- FR-BB-03: Cross-match requests and issue workflow with traceability.

### 7.10 Billing, Insurance & Revenue Cycle Management (RCM)
- FR-BIL-01: Unified charge capture from all departments (OPD/IPD/lab/rad/pharmacy/procedures) onto a running episode bill.
- FR-BIL-02: Itemized invoicing, packages, discounts (with approval matrix), advances/refunds, split payments (cash/card/UPI/insurance).
- FR-BIL-03: Insurance/TPA: eligibility check, pre-authorization submission & status tracking, cashless claim lifecycle, deduction handling.
- FR-BIL-04: Coding support: ICD-10/CPT suggestion with documentation-gap prompts (CDI).
- FR-BIL-05: Denial management workbench: reason categorization, resubmission workflow, payer scorecards.
- FR-BIL-06: Financial accounting exports; GST/tax-compliant invoices; tariff masters per payer class.

### 7.11 Emergency Department (ED)
- FR-ED-01: Casualty registration with triage (ESI/MTS levels), color-coded acuity board.
- FR-ED-02: ED tracking board: arrival→triage→doctor→diagnostics→decision→disposition with timestamps/TAT.
- FR-ED-03: Ambulance dispatch log, trauma registry fields, MLC (medico-legal case) flagging with restricted access.

### 7.12 Patient Engagement & Portal
- FR-PE-01: Patient portal/app: appointments, queue status, prescriptions, lab/rad reports, bills & payment links, discharge summaries, teleconsultation.
- FR-PE-02: Notifications via SMS/WhatsApp/email/push: reminders (appointment, meds, follow-up), payment due, report ready.
- FR-PE-03: Feedback capture (NPS, service ratings) routed to quality team.
- FR-PE-04: AI symptom-checker / triage chatbot on portal (clearly labeled non-diagnostic, with emergency red-flag routing).

### 7.13 HR, Staff Rota & Payroll Integration
- FR-HR-01: Staff master with roles, departments, qualifications, credentials/license expiries.
- FR-HR-02: Shift rostering with skill-mix constraints; leave management; shift swap approvals.
- FR-HR-03: Attendance (biometric integration), overtime computation, payroll export/integration.

### 7.14 Administration, RBAC & Audit
- FR-ADM-01: Role-based access control with least privilege; roles: Super Admin, Facility Admin, Doctor, Nurse, Technician, Pharmacist, Cashier, TPA Desk, Auditor (read-only), etc.
- FR-ADM-02: Attribute-based restrictions: doctors see own patients' full record; break-glass emergency access with mandatory justification + alert to privacy officer.
- FR-ADM-03: Immutable audit log on every PHI read/write (who, what, when, where) — tamper-evident, queryable, retention ≥ 7 years.
- FR-ADM-04: Master/config management: services, tariffs, departments, templates — per facility.
- FR-ADM-05: Multi-facility console: per-site branding, permissions, consolidated + site-level reporting.

### 7.15 Reporting & Analytics
- FR-ANA-01: Pre-built MIS: occupancy %, ARPOB, LOS, OT utilization, TATs, revenue by department, payer mix.
- FR-ANA-02: Scheduled report distribution (daily/weekly/monthly) via email/dashboard subscriptions.
- FR-ANA-03: Quality/accreditation indicator packs (NABH/JCI): HAI rates, incident reports, patient safety goals.
- FR-ANA-04: Export: CSV/XLSX/PDF; embedded BI connectors (e.g., Metabase/Power BI via read-replica or API).

---

## 8. AI Capabilities — Detailed Requirements

The AI layer is organized as **governed AI agents/services** embedded in every workflow. Design principle throughout: **"AI drafts. Humans decide."** Every AI output is advisory, attributed, versioned, and auditable.

### 8.0 AI Architecture Principles
- AI-A-01: All AI features operate behind a unified **AI Gateway/Orchestrator** (model-agnostic; pluggable LLM providers — OpenAI/Azure, Anthropic, Gemini, or self-hosted Llama/Mistral for on-prem).
- AI-A-02: Retrieval-Augmented Generation (RAG) over hospital knowledge: formularies, protocols/SOPs, past records — with citations shown to users.
- AI-A-03: Risk-tiered autonomy (per governance framework, Section 13): Tier-0 informational → Tier-1 suggested action w/ human approval → Tier-2 autonomous only for non-clinical, reversible actions (e.g., draft messages, reorder suggestions).
- AI-A-04: Every AI interaction logged: prompt, retrieved context, model+version, confidence, user action (accepted/rejected/edited) — feeding continuous evaluation.
- AI-A-05: Refusal layer: when confidence/context is insufficient, the assistant must say so and defer to humans rather than hallucinate.
- AI-A-06: PHI minimization: de-identify data before sending to external model APIs where policy requires; never train external models on hospital data.

### 8.1 Ambient AI Scribe (Clinical Documentation)
- AI-SR-01: Capture doctor–patient conversation (with patient consent prompt), transcribe (speech-to-text, multilingual incl. code-switched Hindi/English/regional languages), and generate SOAP note drafts, visit summaries, and discharge summary drafts.
- AI-SR-02: Draft appears in the EMR editor with tracked provenance; clinician reviews/edits/signs — signature required before filing.
- AI-SR-03: Auto-extract structured data from conversation into discrete fields (diagnoses, orders candidates, follow-up date) as *proposed* entries requiring confirmation.
- **Success target:** ≥ 40% documentation-time reduction; ≥ 70% draft acceptance rate.

### 8.2 Clinical Decision Support (CDS)
- AI-CDS-01: Drug–drug, drug–allergy, drug–disease interaction checking with severity tiers and evidence links; duplicate therapy detection.
- AI-CDS-02: Dose-range validation by age/weight/renal function (pediatric dosing calculator).
- AI-CDS-03: Early-warning scores computed continuously: sepsis risk, cardiac arrest (e.g., MEWS/NEWS-style), deterioration index from vitals/labs trends — with explainable contributing factors.
- AI-CDS-04: Care-gap nudges: overdue screenings, guideline-based next steps (protocol-grounded, cited).
- AI-CDS-05: Readmission-risk scoring at discharge with suggested interventions (Tier-1).
- **Constraint:** CDS outputs never auto-change orders; they surface inline with rationale.

### 8.3 AI Triage & Symptom Checker
- AI-TR-01: Portal/app chatbot collects chief complaint history → assigns preliminary acuity → books appropriate slot/queue; red-flag symptoms trigger immediate ER instruction + callback task.
- AI-TR-02: ED intake assist: suggests triage level based on structured intake + vitals; nurse confirms/overrides (all overrides logged for calibration review).

### 8.4 Operations Orchestration Agents
- AI-OPS-01 **Demand Forecaster:** Predict OPD volume & admissions 24–72 hrs ahead (day-of-week, seasonality, local events, epidemiological signals) → feed rota and capacity plans.
- AI-OPS-02 **Bed Management Agent:** Predict discharge readiness per patient (from orders/notes/vitals), suggest optimal bed assignments, prioritize cleaning queue — recommendations to bed manager (Tier-1).
- AI-OPS-03 **OR Optimizer:** Sequence case schedules minimizing turnover; predict case durations from historical surgeon/procedure data; flag conflicts.
- AI-OPS-04 **Staffing Advisor:** Recommend shift adjustments against forecast demand while respecting contracts/rules (advisory only).
- AI-OPS-05 **Discharge Concierge:** Assemble pending-discharge blockers (pending reports, med reconciliation, transport, TPA bill) into a single actionable list per unit.

### 8.5 Revenue Cycle Agents
- AI-RCM-01 **Coding Copilot:** Suggest ICD-10/CPT codes from documentation with confidence + evidence spans; CDI prompts when documentation lacks specificity (Tier-1).
- AI-RCM-02 **Denial Predictor:** Score each claim pre-submission; recommend fixes (missing auth, mismatched codes) before it leaves the hospital.
- AI-RCM-03 **Authorization Agent:** Prepare and submit pre-auth packets; track statuses; draft payer correspondence (auto-send only for routine status inquiries — Tier-2 limited scope).
- AI-RCM-04 **AR Follow-up Agent:** Prioritize follow-up calls/worklists by recoverability; summarize account history for agents.

### 8.6 Pharmacy & Supply Chain Intelligence
- AI-PHM-A1: Consumption-based demand forecasting per item/site; reorder-point optimization; expiry-waste reduction suggestions (substitute FEFO stock into protocols where clinically equivalent — pharmacist approves).
- AI-PHM-A2: Anomaly detection: unusual prescribing patterns (controlled substances), stock shrinkage signals, prescription fraud flags → routed to compliance (no automated punitive action).

### 8.7 Conversational Analytics (Hospital Intelligence Assistant)
- AI-AN-01: Natural-language Q&A over unified hospital data ("What was OT utilization last week vs. August average?") grounded in governed semantic layer/metrics definitions; answers include the query interpretation, result table/chart, and data freshness timestamp.
- AI-AN-02: Role-scoped: each user can only query data their permissions allow; all queries logged.
- AI-AN-03: Proactive briefings: daily executive digest (occupancy, revenue vs. target, critical events, staffing gaps) generated automatically.

### 8.8 Patient-Facing AI
- AI-PT-01: Portal assistant for wayfinding FAQs, bill explanation ("Explain my charges"), preparation instructions, medication reminders in plain language.
- AI-PT-02: Post-discharge follow-up agent: check-in messages, symptom questionnaires, escalate concerning responses to nursing triage (Tier-1 for any clinical interpretation).

### 8.9 Imaging AI Hooks
- AI-IM-01: Plugin interface to ingest priority flags/findings from certified third-party imaging AI (stroke, fracture, TB screening) into radiologist worklist ordering — clearly labeled as AI-generated, never auto-finalized.

### 8.10 Model Operations (MLOps)
- AI-ML-01: Prompt/model registry with versioning; staged rollout (shadow → 5% → 100%) for any new agent behavior.
- AI-ML-02: Continuous evaluation harness: accuracy, refusal correctness, bias probes across demographics; weekly quality report to AI Governance Committee.
- AI-ML-03: Drift monitoring on inputs/outputs; automatic rollback thresholds.
- AI-ML-04: Feedback capture UI (👍/👎 + reason) on every AI artifact.

---

## 9. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | Page load P95 < 2 s; API P95 < 300 ms; appointment booking < 3 s end-to-end; supports 2,000 concurrent staff users per facility cluster; scribe transcription latency < 5 s post-utterance streaming |
| **Scalability** | Horizontal scaling; 500-bed facility + 200k outpatient visits/year baseline; multi-tenant architecture for chains |
| **Availability** | 99.9% uptime SLA; RPO ≤ 15 min, RTO ≤ 1 hr; degraded-mode read-only operations during full outage |
| **Data Durability** | Automated encrypted backups (hourly incremental, daily full), PITR, quarterly restore drills |
| **Usability** | Core tasks ≤ 5 clicks (register, admit, dispense, bill); WCAG 2.1 AA; English + regional language support (i18n framework) |
| **Compatibility** | Modern browsers (Chrome/Edge/Firefox/Safari); PWA offline-tolerant for ward rounds (read + queued writes) |
| **Auditability** | Every PHI access logged immutably; audit export for regulators within 24 hrs |
| **Maintainability** | Modular monolith→services boundary; CI/CD; ≥ 80% test coverage on billing/critical paths; feature flags |

---

## 10. Compliance, Security & Privacy

### Regulatory Alignment (configurable by region)
- **HIPAA** (US): BAAs with processors, Technical Safeguards mapped, breach notification tooling.
- **GDPR / EU AI Act** (EU): lawful basis management, DSAR workflows, DPIA templates, AI transparency notices, human oversight for high-risk AI classes.
- **India**: **ABDM** integration (ABHA linking, Health Information Provider/User roles, consent-manager flows), **DPDP Act 2023** consent & grievance workflows, **DISHA**-aligned safeguards, NABH digital records requirements.
- **Standards**: ISO 27001-aligned ISMS, ISO 14971 / IEC 62304 practices for software touching clinical processes, HL7 FHIR R4, SNOMED CT, LOINC, UCUM, ICD-10, DICOM.

### Security Controls
- Encryption: TLS 1.3 in transit; AES-256-GCM at rest (DB, backups, file store); field-level encryption for sensitive identifiers.
- AuthN/AuthZ: OIDC/OAuth2 (Keycloak or equivalent), MFA for staff, passwordless options, session timeout + reauth for destructive actions.
- Network: WAF, rate limiting, IP allow-listing option for internal deployments, secrets vault.
- Application: OWASP Top-10 hardening, dependency scanning, annual penetration tests, secure SDLC gates.
- Data residency: region-pinned storage; no cross-border PHI routing without explicit contract.
- On-prem AI option: self-hosted models ensure zero PHI egress.

---

## 11. System Architecture & Tech Stack

### Architectural Style
Modular monolith with clear bounded contexts (extractable to microservices), event-driven internally (outbox + message bus), API-first, plugin-ready.

### Proposed Stack (aligned to proven open-source precedents — CARE HMIS, MediTrack, OSUTH patterns)

| Layer | Technology |
|---|---|
| **Frontend (staff)** | React 19 / Next.js + TypeScript, Tailwind, TanStack Query; role-aware design system |
| **Patient surfaces** | Responsive PWA + WhatsApp bot channel |
| **API/BFF** | REST (OpenAPI 3) + GraphQL gateway optional; WebSocket/SignalR for real-time boards & scribe streaming |
| **Backend** | Node.js (NestJS) or Python (FastAPI) — decision pending spike; domain-driven module boundaries |
| **Database** | PostgreSQL 17 (+ row-level security for multi-tenancy), pgvector for embeddings |
| **Cache/Queue** | Redis; RabbitMQ/Kafka for events (orders, results, notifications) |
| **Identity** | Keycloak (OIDC, RBAC, MFA) |
| **File/imaging** | S3-compatible object store; DICOM Orthanc node; OHIF viewer embed |
| **AI layer** | AI Gateway (LiteLLM or custom) → pluggable LLMs (GPT-4o/Claude/Gemini cloud; Llama-3/Mistral self-hosted via vLLM for on-prem); Whisper-class STT; RAG pipeline (ingestion → chunking → embeddings → hybrid retrieval → rerank → cited generation); MCP (Model Context Protocol) servers exposing hospital tools to agents |
| **Agent runtime** | Orchestrator with per-agent scopes, memory, HITL checkpoints; evaluation harness (correctness, refusal-rate, latency) |
| **Observability** | OpenTelemetry traces, Prometheus/Grafana metrics, Loki logs; AI-specific dashboards (acceptance rate, refusal rate, cost per encounter) |
| **DevOps** | Docker Compose (dev) → Kubernetes (prod); Terraform; blue/green deploys; GitOps |
| **Deployment modes** | Managed SaaS · single-tenant VPC · fully on-prem (air-gapped capable) |

### High-Level Data Flow

```
[Devices/Analyzers]─HL7/ASTM─┐        ┌─FHIR R4 APIs─[External EHRs/Payers]
[Portal/App/WhatsApp]────────┤        ├─DICOM──────[Modalities/PACS]
[Staff Web App]──────────────┼──►[API Gateway]──►[Core Modules]
                             │         │              │
                             │    [Event Bus]◄────────┘
                             │         │
                             │   ┌─────┴──────────────────┐
                             └──►│ AI Layer               │
                                 │ Gateway·RAG·Agents     │
                                 │ MCP Tools·Eval·Audit   │
                                 └────────────────────────┘
                                          │
                              [Unified Analytics + NL Query]
```

---

## 12. Interoperability & Integrations

| Integration | Standard/Method | Direction |
|---|---|---|
| Legacy EHRs (Epic/Cerner/MEDITECH) | HL7 FHIR R4 (SMART on FHIR launch), HL7 v2 ADT/ORU feeds | Bi-directional |
| Lab analyzers | ASTM/HL7 LIS01 via middleware | Bi-directional |
| Radiology modalities | DICOM (MWL, C-STORE), Orthanc | Bi-directional |
| National health rails | ABDM/ABHA (India), other national rails via plugins | Outbound + consent flows |
| Insurance/payers/TPA | API/portal adapters, X12 where applicable | Bi-directional |
| Payments | UPI/cards/netbanking gateways, split settlements | Inbound |
| Messaging | SMS gateway, WhatsApp Business API, email, push | Outbound |
| Biometrics/RTLS | Vendor SDKs (attendance, asset/patient tracking) | Inbound |
| Telemedicine | Built-in video (WebRTC) + national teleconsult rails | Native |
| Data warehouse | Read replica / CDC stream, FHIR bulk export ($export) | Outbound |

---

## 13. AI Governance Framework

Adopting a compliance-first, risk-tiered pattern catalogue (per emerging best practice for mission-critical hospital AI):

### Risk Tiers
| Tier | Definition | Examples | Control |
|---|---|---|---|
| **T0 — Informational** | No direct action; user reads | NL analytics, literature/protocol search | Logging, citations required |
| **T1 — Suggested Action** | Human must approve before effect | Scribe drafts, coding suggestions, dose alerts, bed assignments, triage level | Explicit approve/edit/reject UI + rationale capture |
| **T2 — Autonomous (restricted)** | Acts alone; reversible; non-clinical | Routine payer status inquiries, reminder scheduling, reorder drafts | Rate limits, circuit breakers, daily review queues |
| **Prohibited** | — | Autonomous diagnosis, autonomous medication changes, auto-denial of claims, unsupervised messaging containing clinical advice | Never shipped |

### Committee & Cadence
- Standing **AI Governance Committee** (CMO, CIO, privacy officer, quality head, clinical champions) meets monthly.
- Quarterly model audits: performance parity across demographic subgroups; incident taxonomy (near-miss, harm) with disclosure policy.
- Incident response runbook specific to AI (wrong suggestion propagated, model outage, prompt injection) with kill-switch per agent.
- Transparency: users always know when content is AI-generated (badges + provenance panel); patients notified when AI participates in their care (consent text).

---

## 14. Release Plan & Phasing

### Phase 0 — Foundation (Weeks 1–8)
Infra, CI/CD, identity/RBAC, MPI + registration, appointments/queue, basic billing, audit logging. *Exit: pilot facility registers & bills 100% of OPD visits.*

### Phase 1 — Core Clinical (Weeks 9–20)
EMR + templates, e-Rx + basic interaction checks, LIS (with analyzer interface), pharmacy + inventory, IPD/bed board, discharge workflow. *Exit: paperless pilot ward.*

### Phase 2 — AI Copilot Wave (Weeks 21–32)
Ambient scribe (OPD first), RAG protocol assistant, coding copilot, conversational analytics MVP, patient portal + WhatsApp. *Exit: ≥ 60% scribe adoption among pilot clinicians.*

### Phase 3 — Operations & RCM Intelligence (Weeks 33–44)
Bed/orchestration agents, demand forecasting, denial predictor, pre-auth agent, OT optimizer, radiology RIS/PACS. *Exit: measurable KPI movement on Section 4 targets.*

### Phase 4 — Scale & Advanced (Weeks 45–56)
Multi-facility console, blood bank, tele-ICU/virtual nursing hooks, imaging AI plugins, on-prem LLM packaging, marketplace/plugin SDK. *Exit: second facility live; chain rollout playbook.*

**Rollout methodology per site:** discovery → configure → migrate (HL7/FHIR/CSV) → parallel run 2–4 weeks → cutover → 90-day hypercare.

---

## 15. Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Clinician resistance / alert fatigue | High | High | Human-centered design, co-creation councils, tiered alerts, adoption incentives, measure & prune noisy rules monthly |
| 2 | AI hallucination in clinical contexts | Med | Critical | Refusal layer, grounding+citations, HITL signature gates, evaluation harness, shadow mode before release |
| 3 | PHI exposure via external LLM APIs | Low | Critical | De-identification pipeline, BAAs, on-prem model option, zero-retention API configs, egress monitoring |
| 4 | Migration data loss from legacy systems | Med | High | Dual-run, checksum reconciliation, rollback plans, phased cutover by department |
| 5 | Regulatory divergence across regions | Med | Med | Region-pack architecture (compliance packs per jurisdiction), legal review gates per market |
| 6 | Cost overrun on LLM inference at scale | Med | Med | Model routing (small models for simple tasks), caching, budget caps per department, self-host fallback |
| 7 | Integration brittleness with analyzers/devices | High | Med | Middleware abstraction, conformance testing suite, vendor certification program |
| 8 | Prompt injection / adversarial inputs | Med | High | Input sanitization, tool-scope isolation, no autonomous write paths for T1, red-team suite in CI |

---

## 16. Out of Scope (v1)

- Insurance underwriting/actuarial products
- Genomics/personalized medicine modules
- Full ERP financial GL replacement (integration instead)
- Native mobile apps (native iOS/Android) — PWA first
- Autonomous clinical decision-making of any kind (permanently prohibited)
- Wearables/consumer device ingestion (Phase 5 candidate)

---

## 17. Open Questions

1. **Backend stack decision:** NestJS vs. FastAPI (spike in Phase 0; criteria: team skills, AI ecosystem fit, hiring pool)?
2. Which launch geography drives the compliance pack priority — India (ABDM/DPDP) vs. US (HIPAA) vs. EU?
3. Target customer profile for GA: greenfield mid-size hospitals vs. displacement of legacy vendors at chains?
4. Build vs. partner for imaging AI (bundle certified third-party vs. in-house)?
5. Pricing model: per-bed, per-clinician, or per-encounter? On-prem licensing structure?
6. Data ownership & secondary-use (research/analytics) policy defaults per deployment mode?

---

## 18. Appendix: Glossary

| Term | Meaning |
|---|---|
| ABDM / ABHA | Ayushman Bharat Digital Mission / its health ID (India) |
| ARPOB | Average Revenue Per Occupied Bed |
| CDS | Clinical Decision Support |
| CDI | Clinical Documentation Improvement |
| DICOM | Digital Imaging and Communications in Medicine |
| ESI / MTS | Emergency Severity Index / Manchester Triage System |
| FHIR | Fast Healthcare Interoperability Resources (HL7) |
| HITL | Human-In-The-Loop |
| HIS/HMS | Hospital Information/Management System |
| LIS / RIS | Laboratory / Radiology Information System |
| LOS | Length of Stay |
| MCP | Model Context Protocol (LLM tool-integration standard) |
| MRN | Medical Record Number |
| OPD / IPD | Outpatient / Inpatient Department |
| PACS | Picture Archiving and Communication System |
| PHI | Protected Health Information |
| RAG | Retrieval-Augmented Generation |
| RBAC | Role-Based Access Control |
| RCM | Revenue Cycle Management |
| RTLS | Real-Time Location Services |
| SBAR | Situation-Background-Assessment-Recommendation (handover) |
| SOAP | Subjective-Objective-Assessment-Plan (note format) |
| TAT / TPA | Turnaround Time / Third-Party Administrator (insurance) |
| WHO SSC | World Health Organization Surgical Safety Checklist |

---

*End of Document — v1.0 Draft for stakeholder review.*
