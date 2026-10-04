# FieldFlow — AI Field Service Dispatch & Replanning Console

[![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20%2F%20Mongoose-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Google Gemini API](https://img.shields.io/badge/Google%20GenAI-Gemini%20API-4285F4?style=flat&logo=google&logoColor=white)](https://ai.google.dev/)

**FieldFlow** is an enterprise AI-assisted Field Service Dispatch, Optimization, and Dynamic Replanning platform. It marries **real Google Gemini API intelligence** (for multi-variable reasoning, trade-off analysis, and schedule proposal generation) with a **deterministic hard-constraint validation engine** and **human-in-the-loop dispatcher approval authority** backed by **atomic MongoDB transactions** and **immutable schedule versioning**.

---

## 1. Architectural Blueprint & Core Tenets

```
               ┌─────────────────────────────────────────┐
               │         MongoDB Live Database           │
               │ (Requests, Technicians, Confirmed Asgs) │
               └────────────────────┬────────────────────┘
                                    │
                                    ▼
               ┌─────────────────────────────────────────┐
               │    Deterministic Candidate Filter       │
               │   (Skills, Windows, Workloads, Status)  │
               └────────────────────┬────────────────────┘
                                    │
                                    ▼
               ┌─────────────────────────────────────────┐
               │        Official Google GenAI SDK        │
               │       (Gemini AI Planning Engine)       │
               └────────────────────┬────────────────────┘
                                    │
                                    ▼
               ┌─────────────────────────────────────────┐
               │   Deterministic Hard-Constraint Engine  │
               │  (Validates Skill, Overlap, Cap, Status)│
               └────────────────────┬────────────────────┘
                                    │
                                    ▼
               ┌─────────────────────────────────────────┐
               │      Persisted Pending AI Proposal      │
               │         (planproposals collection)      │
               └────────────────────┬────────────────────┘
                                    │
                                    ▼
               ┌─────────────────────────────────────────┐
               │        Human Dispatcher Console         │
               │  (Review, Manual Overrides, Diff View)  │
               └────────────────────┬────────────────────┘
                                    │
                             [Approve Plan]
                                    │
                                    ▼
               ┌─────────────────────────────────────────┐
               │     Atomic Multi-Document Transaction   │
               │  ├── Confirmed Assignments Committed    │
               │  ├── Immutable Schedule Version (vX)    │
               │  ├── Approval Record Persisted          │
               │  ├── Comprehensive Audit Log Entry      │
               │  └── In-App Mock Notification Triggered │
               └─────────────────────────────────────────┘
```

### Immutable Separation of Powers:
- **Gemini API = Proposal & Reasoning Authority**: Gemini formulates candidate assignments, detects operational risks, explains capacity trade-offs, and recommends adjustments.
- **Backend Validation Engine = Hard-Constraint Authority**: Re-validates every assignment deterministically (skill matching, operating hours `09:00–17:00`, customer preferred windows, 8h workload caps, zero double-booking, protected completed tasks).
- **Human Dispatcher = Approval Authority**: AI proposals NEVER modify the live `assignments` collection directly. The dispatcher reviews diffs, makes manual overrides, and authorizes commits.
- **MongoDB = Persistent Ground Truth**: All data (service requests, technician availability, confirmed schedules, historical versions, audit trails, in-app notifications) is persisted in MongoDB and survives browser refreshes and server restarts.

---

## 2. Key Features

- **Real Gemini AI Dispatch Optimization**: Generates conflict-free proposals using `@google/genai` (`gemini-3.5-flash-lite`, `gemini-3.6-flash`, `gemini-3.7-flash`).
- **Deterministic 8-Constraint Enforcement**: Zero tolerance for skill mismatches, double-booking, workload cap violations, or unavailable technician assignments.
- **Reactive Replanning on Disruptions**:
  - **Technician Cancellation**: Reallocates affected future jobs across available technicians while strictly protecting completed work (`REQ-010`).
  - **Emergency Service Requests**: Accommodates critical emergency tickets (`REQ-011`) with AI trade-off evaluations.
- **Immutable Schedule Versioning & Diff Comparison**: Every approved change creates a new version (`v1`, `v2`, `v3`, `v4`, `v5`, `v6`). Side-by-side comparison displays **BEFORE $\rightarrow$ AFTER $\rightarrow$ WHY**.
- **Human Dispatcher Manual Override**: Allows fine-tuning technician or time-slot assignments with real-time constraint validation and audit tracking.
- **Stale Plan & Concurrency Protection**: Blocks approvals if underlying database state or schedule baseline changed after proposal generation (`HTTP 409 PLAN_STALE`).
- **End-to-End Audit Trail**: Immutable chronological event logging (`AI_PLAN_GENERATED`, `DISPATCHER_OVERRIDE`, `AI_PLAN_APPROVED`, `TECHNICIAN_UNAVAILABLE`, `EMERGENCY_CREATED`).
- **In-App Mock Notifications**: Contextual operational alerts stored in MongoDB (no third-party SMS/email spam).

---

## 3. Technology Stack

- **Backend**: Node.js, Express.js, MongoDB Atlas / Mongoose ODM, `@google/genai` (Google GenAI JavaScript SDK).
- **Frontend**: React 18, Vite, Vanilla CSS + Tailwind utility tokens, Lucide React Icons.
- **Testing**: Native Node.js test suites with automated assertions across full HTTP and database lifecycles.

---

## 4. Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MongoDB**: MongoDB Atlas Cluster connection URI (or local MongoDB v6.0+)
- **Google Gemini API Key**: An active Gemini API key from [Google AI Studio](https://aistudio.google.com/)

---

## 5. Installation & Environment Configuration

### Step 1: Clone Repository & Install Dependencies

```bash
# Clone the repository
git clone <repo-url>
cd "Field Service Dispatch and Replanning Agent"

# Install root dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..
```

### Step 2: Configure Environment Variables

Create `server/.env` (or verify it exists):

```env
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/fieldflow?retryWrites=true&w=majority
PORT=5000
CLIENT_URL=http://localhost:5173
GEMINI_API_KEY=YOUR_REAL_GEMINI_API_KEY
GEMINI_MODEL=gemini-3.5-flash-lite
```

> **Security Note:** `GEMINI_API_KEY` is loaded strictly on the backend. It is never exposed in client bundles or `.env.example`.

---

## 6. Seed & Demo Dataset Initialization

FieldFlow includes a deterministic demo dataset (5 technicians, 10 service requests, 8 active assignments, 3 schedule versions):

```bash
npm run seed
```

---

## 7. Running the Application

### Option A: Run Full Stack Concurrently
```bash
npm run dev
```

### Option B: Run Services Separately
```bash
# Terminal 1: Backend Server (Port 5000)
npm run server

# Terminal 2: Vite React Frontend (Port 5173)
npm run client
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 8. Automated Verification Test Suites

Run the end-to-end integration and edge-case test suites:

```bash
# Phase 2 UI Component Verification
node tests/phase2/test_phase2_verification.js

# Phase 3 Interactive UI Logic Verification
node tests/phase3/test_phase3_verification.js

# Phase 4 Backend API Verification
node tests/phase4/test_phase4_backend.js

# Phase 5 Gemini Error & Edge-Cases
node tests/phase5/test_phase5_gemini_error_scenarios.js

# Phase 6 Execution & Replanning Verification (48 assertions)
node tests/phase6/test_phase6_execution.js

# Phase 7 Production Hardening & Security Verification (44 assertions)
node tests/phase7/test_phase7_hardening.js

# Phase 7-9 Cancellation, Emergency & Versioning Verification (39 assertions)
node tests/phase7/test_phase7_9_workflow.js

# Phase 10 Complete Edge-Cases & Hard-Constraint Suite (49 assertions)
node tests/phase10/test_phase10_edge_cases.js
```

---

## 9. API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/planner/generate` | `POST` | Generates AI dispatch proposal via Gemini + candidate filter. |
| `/api/planner/generate-revised` | `POST` | Formulates revised proposal for cancellations or emergencies. |
| `/api/planner/latest` | `GET` | Retrieves latest pending or confirmed proposal for page refresh persistence. |
| `/api/planner/:planId` | `GET` | Retrieves specific proposal by ID. |
| `/api/planner/:planId/assignments/:requestId` | `PATCH` | Dispatcher manual modification with hard-constraint validation. |
| `/api/planner/:planId/approve` | `POST` | Commits proposal via atomic transaction; creates confirmed assignments & version `vX`. |
| `/api/planner/:planId/reject` | `POST` | Rejects proposal; logs audit event. |
| `/api/planner/technician-unavailable` | `POST` | Marks technician `Unavailable`; flags affected future requests. |
| `/api/planner/emergency-request` | `POST` | Logs `Critical` priority emergency ticket requiring immediate replanning. |
| `/api/requests` | `GET/POST` | Service request CRUD and status querying. |
| `/api/technicians` | `GET/POST` | Technician roster, skillsets, and availability status. |
| `/api/assignments` | `GET` | Live confirmed assignments. |
| `/api/schedule/versions` | `GET` | Immutable schedule version history with assignment snapshots. |
| `/api/audit` | `GET` | Immutable audit event log. |
| `/api/notifications` | `GET/POST` | In-app mock alerts and read state transitions. |

---

## 10. End-to-End Live Demonstration Walkthrough

1. **Open Dashboard**: View live KPI cards (Active Requests, Unassigned, Available Technicians, Active Version).
2. **Open AI Planner**: Click **"Generate AI Plan"**. Gemini analyzes live MongoDB data and renders proposed assignments, trade-offs, and risks in seconds.
3. **Inspect Refresh Persistence**: Refresh browser $\rightarrow$ identical proposal `PLAN-XXXXXX` remains in `AWAITING_APPROVAL`.
4. **Manual Override**: Change an assignment's technician or slot $\rightarrow$ deterministic validator verifies skills and availability.
5. **Approve Plan**: Click **"Approve Plan"** $\rightarrow$ MongoDB transaction commits assignments and creates immutable schedule version `v4`.
6. **Technician Cancellation**: Mark a technician `Unavailable` $\rightarrow$ system flags affected uncompleted requests and protects completed `REQ-010`.
7. **Revised AI Plan**: Click **"Generate Revised AI Plan"** $\rightarrow$ Gemini replans unassigned work; approve to create `v5`.
8. **Emergency Request**: Log emergency request `REQ-011` $\rightarrow$ Gemini formulates priority schedule; approve to create `v6`.
9. **Version Comparison**: Navigate to **Schedule Versions** $\rightarrow$ compare `v4` $\rightarrow$ `v5` and `v5` $\rightarrow$ `v6` with **BEFORE $\rightarrow$ AFTER $\rightarrow$ WHY** diff cards.
10. **Audit & Notifications**: Check **Audit Log** for the chronological trace and **Notifications** for live operational alerts.

---

## 11. Code Quality & Build Verification

- **Production Build**: `npm run build` $\rightarrow$ **`Exit code 0`**
- **Linter**: `npm run lint` $\rightarrow$ **`0 errors`**
- **Security Audit**: Zero exposed secrets in frontend bundles or git repository.
