/**
 * DEPRECATED & REMOVED (Phase 5 — Remove All Mock AI)
 * 
 * All heuristic / mock / static schedule planning logic has been permanently removed.
 * The ONLY source for AI-generated planning in FieldFlow is the real Gemini API via
 * the POST /api/planner/generate backend endpoint using the official @google/genai SDK.
 */

export function generateDispatchPlan() {
  throw new Error(
    'Mock AI Planner is removed. All planning proposals must be generated via the real Gemini API endpoint (/api/planner/generate).'
  );
}

export default {
  generateDispatchPlan,
};
