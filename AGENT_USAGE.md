# AGENT_USAGE

## 1. AI/Development Tools Used

This project was built and hardened using agent-assisted development practices. The following AI and development tools were utilized throughout the project lifecycle:

- **Antigravity AI Coding Assistant (Google DeepMind)**: Served as the primary pair-programming agent for architecture design, full-stack implementation, refactoring, test suite development, and production debugging.
- **Google Gemini API (`@google/genai` SDK)**: Integrated directly into the backend planning service using models such as `gemini-3.5-flash-lite`, `gemini-3.6-flash`, and `gemini-3.7-flash` for multi-variable schedule reasoning, trade-off analysis, and structured proposal generation.
- **Node.js Native Test Runner**: Used for integration, regression, and constraint verification suites.
- **Oxlint & Vite**: Used for static analysis, linting, and production asset bundling.
- **MongoDB Atlas & Compass**: Cloud database cluster and GUI for data inspection and schema validation.

---

## 2. Representative Prompts

Below are representative instructions and prompts provided to the AI agent during key phases of development:

### Phase 1–2: Project Foundation & Component Architecture
> *"Establish the FieldFlow project architecture with React/Vite on the frontend and Express/MongoDB on the backend. Create the core navigation, dashboard KPI cards, technician roster, and service request lists with clean, modern styling."*

### Phase 3–4: Deterministic Validation & Backend REST API
> *"Implement the centralized 8-constraint deterministic validation engine (`validationService.js`). Expose comprehensive REST endpoints for service requests, technicians, assignments, schedule versions, and audit logs. Verify all operations persist in MongoDB Atlas."*

### Phase 5: Real Gemini AI Integration & Proposal Persistence
> *"Integrate the official `@google/genai` SDK to generate dispatch proposals based on live MongoDB state and candidate availability. Persist pending proposals immediately in the `planproposals` collection so that state survives page refreshes without prematurely committing assignments to the live schedule."*

### Phase 6: Dispatch Execution, Approval Commit & Replanning
> *"Implement the dispatcher approval workflow. When a proposal is approved, use an atomic transaction to commit assignments, generate an immutable `ScheduleVersion`, record an audit entry, and issue in-app notifications. Add reactive replanning for technician cancellations and emergency requests."*

### Phase 7–9: Version Diffing, Hardening & Security
> *"Build the schedule version comparison endpoint (`/schedules/compare/:v1/:v2`) and UI diff cards showing BEFORE $\rightarrow$ AFTER $\rightarrow$ WHY. Ensure `GEMINI_API_KEY` is strictly confined to the backend and sanitize all database error responses."*

### Phase 10: Complete Testing & Edge Cases
> *"Execute comprehensive verification across all 8 hard constraints (skill mismatch, working hours, customer windows, double-booking, 8h workload cap, completed task immutability, technician availability). Verify idempotency on double-approval and stale proposal rejection."*

### Production Deployment & Debugging
> *"Configure `vercel.json` for multi-service deployment (`app` for Vite frontend, `server` for Express API). Resolve the production MongoDB 10-second buffering timeout by implementing a serverless-compatible cached connection manager and pre-route middleware."*

---

## 3. Delegated Work

The AI coding agent was delegated full-lifecycle engineering responsibilities across the application:

- **Frontend Implementation**: Built the complete React SPA, including Dashboard, Service Requests, Technicians, Schedule Timeline, AI Planner Console, Schedule Versions Diff Viewer, Audit Log, and Notifications using Vanilla CSS, Tailwind utility tokens, and Lucide icons.
- **Backend & REST API**: Developed Express route handlers, controllers, input validation, error handling middleware, and seed scripts.
- **MongoDB Persistence**: Designed and maintained Mongoose schemas (`ServiceRequest`, `Technician`, `Assignment`, `PlanProposal`, `ScheduleVersion`, `Approval`, `AuditLog`, `Notification`).
- **Gemini API Integration**: Implemented structured prompt engineering (`buildPlanningPrompt`), JSON schema validation (`AI_PLAN_SCHEMA`), and model fallback cascades (`gemini-3.5-flash-lite` $\rightarrow$ `gemini-3.6-flash` $\rightarrow$ `gemini-3.7-flash`).
- **Deterministic Constraint Engine**: Implemented 8 strict business rules in `validationService.js` and `planValidator.js` that deterministically validate all AI and human proposals.
- **Reactive Replanning**: Engineered automated workflows for handling sudden technician unavailability and emergency critical service tickets.
- **Schedule Versioning & Audit Trail**: Implemented immutable snapshot storage and structured diff computation for version comparisons.
- **Automated Test Suites**: Authored test files across phases (`tests/phase2/` to `tests/phase10/`) testing all business logic and API contracts.
- **Repository Organization & Deployment**: Reorganized test files into structured directories and configured Vercel multi-service deployment.

---

## 4. Important Agent Mistakes & Corrections

During development, several real engineering issues arose and were systematically diagnosed and resolved:

1. **Initial Mock AI Placeholder Removal**:
   - *Issue*: Early prototype phases utilized a local heuristic mock planner.
   - *Correction*: The mock planner was entirely removed and replaced with the official Google GenAI SDK (`@google/genai`) connecting to real Gemini models with strict error handling.
2. **Gemini SDK Model Version Mismatch**:
   - *Issue*: Initial API requests specified deprecated model aliases (`models/gemini-1.5-flash`), causing `404 NOT_FOUND` errors on the v1beta endpoint.
   - *Correction*: Updated service configuration to supported production model identifiers (`gemini-3.5-flash-lite`, `gemini-3.6-flash`, `gemini-3.7-flash`) with automatic fallback retry mechanisms.
3. **Test File Accumulation in Root**:
   - *Issue*: Multiple phase verification scripts were originally created in the repository root (`test_phase*.js`, `verify_*.js`), cluttering the workspace.
   - *Correction*: All test files were migrated into a structured `tests/phaseX/` hierarchy, and all relative imports, `dotenv` paths, `package.json` scripts, and documentation commands were recalculated and updated.
4. **Vercel Serverless MongoDB Buffering Timeout (HTTP 500)**:
   - *Issue*: When deployed to Vercel, Express routes timed out after 10,000ms with `Operation servicerequests.countDocuments() buffering timed out after 10000ms`. In serverless execution, `server.js` (which ran `connectDB()` before `app.listen()`) was bypassed in favor of directly invoking `app.js`.
   - *Correction*: Refactored `server/src/config/db.js` to implement global connection caching (`global.mongoose = { conn, promise }`) across warm lambdas, and mounted an asynchronous database connection middleware in `server/src/app.js` to ensure the database connection is active before route execution.

---

## 5. Verification Process

Every phase of development and refactoring was verified through automated and manual methods:

- **Automated Phase Verification Suites**:
  - `tests/phase5/test_phase5_gemini_error_scenarios.js`: 8 assertions passing (missing key, invalid key, missing skill, technician on leave).
  - `tests/phase6/test_phase6_execution.js`: 48 assertions passing (proposal generation, refresh persistence, manual override, atomic commit, cancellation replan, emergency replan, stale plan guard).
  - `tests/phase7/test_phase7_hardening.js`: 44 assertions passing (secret protection, constraint enforcement, double-approval idempotency).
  - `tests/phase7/test_phase7_9_workflow.js`: 39 assertions passing (version comparison snapshot immutability, audit trail logging).
  - `tests/phase10/test_phase10_edge_cases.js`: 49 assertions passing (complete edge-case matrix).
- **Build Verification**: `npm run build` compiles Vite client production bundle with exit code `0`.
- **Lint Verification**: `npm run lint` (`oxlint`) passes with `0 errors`.
- **Database Seed Verification**: `npm run seed` executes deterministic seeding of technicians, requests, assignments, versions, and notifications.
- **Browser Persistence Verification**: Manually verified that generating an AI plan and refreshing the browser keeps the proposal in `AWAITING_APPROVAL` status without losing state or committing prematurely.

---

## 6. Human Approval and AI Boundaries

FieldFlow enforces a strict separation of authority across its architecture:

```
┌──────────────────────────────────────────────┐
│             Google Gemini API                │
│       (Proposal & Reasoning Engine)          │
└──────────────────────┬───────────────────────┘
                       │ Generates candidate proposal
                       ▼
┌──────────────────────────────────────────────┐
│        Backend Validation Engine             │
│   (Deterministic Hard-Constraint Authority)  │
└──────────────────────┬───────────────────────┘
                       │ Passes validation
                       ▼
┌──────────────────────────────────────────────┐
│        Human Dispatcher Console              │
│       (Final Approval Authority)             │
└──────────────────────┬───────────────────────┘
                       │ Dispatcher clicks "Approve Plan"
                       ▼
┌──────────────────────────────────────────────┐
│         MongoDB Atlas Database               │
│        (Persistent Ground Truth)             │
└──────────────────────────────────────────────┘
```

- **Gemini Proposes, Never Commits**: AI outputs are strictly treated as draft proposals stored in `planproposals`. The AI cannot directly write to the live `assignments` collection.
- **Deterministic Hard Constraints**: The backend re-evaluates all assignments against 8 non-negotiable rules (skills, hours `09:00–17:00`, customer windows, 8h maximum workload, zero overlap, technician availability, protected completed work).
- **Human Authority**: The dispatcher retains exclusive authority to edit proposed assignments (with real-time validation feedback), reject plans, or execute the atomic commit.
- **Ground Truth**: MongoDB persists confirmed schedules, audit logs, and immutable historical versions (`v1`, `v2`, `v3`, `v4`, `v5`, `v6`).

---

## 7. Production Verification

Post-deployment verification was conducted on the production Vercel deployment ([`https://fieldflow.kartikeyprojects.in`](https://fieldflow.kartikeyprojects.in)):

1. **Root-Cause Resolution**: Diagnosed the uninitialized database connection on serverless handlers and verified that adding connection middleware resolved the 10-second buffering timeout.
2. **Live Endpoint Health**:
   - `GET /api/health` $\rightarrow$ `HTTP 200 OK` (`database: "connected"`)
   - `GET /api/requests` $\rightarrow$ `HTTP 200 OK` (retrieves active requests)
   - `POST /api/requests` $\rightarrow$ `HTTP 201 Created` (creates new service requests)
   - `GET /api/technicians` $\rightarrow$ `HTTP 200 OK` (retrieves technician roster)
   - `GET /api/audit` $\rightarrow$ `HTTP 200 OK` (retrieves audit trail)
   - `GET /api/notifications` $\rightarrow$ `HTTP 200 OK` (retrieves operational alerts)
   - `GET /api/planner/latest` $\rightarrow$ `HTTP 200 OK` (retrieves latest persisted proposal)
3. **Security Audit**: Verified that `process.env.GEMINI_API_KEY` and `process.env.MONGO_URI` are never bundled into client JavaScript assets or exposed in client responses.

---

## 8. Limitations / Notes

The following intentional design boundaries and limitations apply to the current implementation:

- **Single-Day Scheduling Window**: The operational window is scoped to daily shifts (`09:00 - 17:00`) for demo clarity and deterministic evaluation.
- **In-App Mock Notifications**: Operational notifications (dispatches, cancellations, emergency alerts) are stored and managed in MongoDB rather than sending external SMS or email messages.
- **Gemini API Connectivity**: Real AI plan generation requires an active internet connection and a configured `GEMINI_API_KEY`. If the key is absent or invalid, the system returns clear error diagnostics without crashing.
