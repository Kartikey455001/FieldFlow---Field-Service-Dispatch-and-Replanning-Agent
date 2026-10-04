/**
 * DEPRECATED & REMOVED (Phase 5 — Remove All Mock AI)
 * 
 * All heuristic / mock / static schedule planning logic has been permanently removed.
 * The ONLY source for AI-generated planning in FieldFlow is the real Gemini API via
 * geminiPlannerService.js with @google/genai SDK.
 */

export function generateDispatchPlan() {
  throw new Error('Mock planner is disabled. All AI plans must be generated via the real Gemini API endpoint (/api/planner/generate).');
}

export function generatePlanFromDB() {
  throw new Error('Mock planner is disabled. All AI plans must be generated via the real Gemini API endpoint (/api/planner/generate).');
}

export default {
  generateDispatchPlan,
  generatePlanFromDB,
};
