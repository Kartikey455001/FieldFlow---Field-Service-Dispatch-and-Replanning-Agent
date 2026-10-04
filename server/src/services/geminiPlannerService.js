/**
 * Gemini Planner Service for FieldFlow AI Dispatch Planner
 * Integrates official @google/genai SDK to generate structured dispatch proposals.
 * Pure planning — NEVER mutates the database.
 */

import { GoogleGenAI, Type } from '@google/genai';

const SYSTEM_INSTRUCTION = `You are the FieldFlow AI Dispatch Planning Agent.

Your job is to recommend an operationally feasible field-service dispatch plan using only the provided database state and eligible candidates.

You must prioritize:
1. Critical/emergency requests (such as REQ-011 or any Critical priority jobs)
2. Required skill compatibility (technician must possess the certified skill)
3. Technician availability (never assign unavailable or on-leave technicians)
4. Time-window compliance (respect customer preferred window and 09:00 - 17:00 operational hours)
5. Avoiding schedule conflicts (no overlapping slots / double-booking)
6. Workload balancing (do not exceed 8 hours daily workload cap)
7. Regional efficiency (prefer technicians operating in the request's region)
8. Protecting completed/protected assignments (completed jobs like REQ-010 must never be modified or reassigned)

Never invent technicians, requests, skills, availability, times, or database facts.
You are generating a proposal only.
You do not approve schedules.
You do not modify the database.
You do not claim that an assignment was committed.
If no feasible assignment exists, explicitly mark the request as unassigned and explain why.`;

export const AI_PLAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    planSummary: {
      type: Type.STRING,
      description: 'Concise executive summary of the proposed dispatch plan and key decisions.',
    },
    assignments: {
      type: Type.ARRAY,
      description: 'List of proposed technician assignments for pending or replanned requests.',
      items: {
        type: Type.OBJECT,
        properties: {
          requestId: { type: Type.STRING },
          technicianId: { type: Type.STRING },
          technicianName: { type: Type.STRING },
          startTime: { type: Type.STRING, description: 'Start time in HH:mm 24-hour format (e.g. 14:00)' },
          endTime: { type: Type.STRING, description: 'End time in HH:mm 24-hour format (e.g. 16:00)' },
          priority: { type: Type.STRING, description: 'Critical, High, Medium, or Normal' },
          reason: { type: Type.STRING, description: 'Operational rationale for choosing this technician and timeslot' },
          confidence: { type: Type.NUMBER, description: 'Confidence percentage between 0 and 100' },
        },
        required: ['requestId', 'technicianId', 'technicianName', 'startTime', 'endTime', 'priority', 'reason'],
      },
    },
    unassignedRequests: {
      type: Type.ARRAY,
      description: 'Requests that cannot be feasibly scheduled without violating hard constraints.',
      items: {
        type: Type.OBJECT,
        properties: {
          requestId: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ['requestId', 'reason'],
      },
    },
    risks: {
      type: Type.ARRAY,
      description: 'Operational risks identified with this proposal.',
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING },
          description: { type: Type.STRING },
          severity: { type: Type.STRING, description: 'Low, Medium, High, or Critical' },
        },
        required: ['type', 'description', 'severity'],
      },
    },
    tradeoffs: {
      type: Type.ARRAY,
      description: 'Explicit operational trade-offs considered during planning.',
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
        },
        required: ['description'],
      },
    },
    questions: {
      type: Type.ARRAY,
      description: 'Missing-information or policy questions requiring dispatcher clarification.',
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
        },
        required: ['question'],
      },
    },
  },
  required: ['planSummary', 'assignments', 'unassignedRequests', 'risks', 'tradeoffs', 'questions'],
};

/**
 * Builds the structured prompt context for Gemini
 */
export function buildPlanningPrompt({
  scheduleVersion = 'v3',
  date = '2026-10-05',
  requests = [],
  technicians = [],
  existingAssignments = [],
  eligibleCandidatesByRequest = {},
  dispatcherQuestion = 'Generate the best feasible dispatch plan for the current requests.',
}) {
  return `=== CURRENT DISPATCH STATE ===
Schedule Version: ${scheduleVersion}
Date: ${date}
Standard Working Hours: 09:00 - 17:00

=== EXISTING ACTIVE ASSIGNMENTS (DO NOT DOUBLE-BOOK) ===
${existingAssignments
  .map(
    (a) =>
      `- [${a.requestId}] ${a.customer || ''} assigned to ${a.technicianName || a.technicianId} at ${
        a.timeSlot || `${a.startTime} - ${a.endTime}`
      } (Status: ${a.status}${a.protected || a.isProtectedCompleted ? ' - STRICTLY PROTECTED/COMPLETED' : ''})`
  )
  .join('\n')}

=== SERVICE REQUESTS ===
${requests
  .map(
    (r) =>
      `- Request ID: ${r.requestId || r.id}
  Customer: ${r.customer}
  Region: ${r.region} | Location: ${r.location || r.address || 'Jaipur'}
  Required Skill: ${r.requiredSkill || r.skill}
  Priority: ${r.priority} | Duration: ${r.duration || `${r.durationHours || 2} hours`}
  Preferred Window: ${r.preferredWindow || 'Any'}
  Current Status: ${r.status}${r.isProtectedCompleted ? ' (COMPLETED - PROTECTED)' : ''}
  Needs Replanning: ${Boolean(r.needsReplanning)}
  Issue Flag: ${r.issueFlag || 'None'}`
  )
  .join('\n\n')}

=== TECHNICIAN ROSTER ===
${technicians
  .map(
    (t) =>
      `- Tech ID: ${t.technicianId || t.id} | Name: ${t.name}
  Role: ${t.role} | Region: ${t.region}
  Skills: ${(t.skills || []).join(', ')}
  Status: ${t.status} | Availability: ${t.availability}
  Current Workload: ${t.currentWorkloadHours || 0}h / ${t.maxWorkloadHours || 8}h max`
  )
  .join('\n\n')}

=== VALID DETERMINISTIC CANDIDATES FOR PENDING REQUESTS ===
${Object.entries(eligibleCandidatesByRequest)
  .map(
    ([reqId, candidates]) =>
      `Request ${reqId}: ${
        candidates.length === 0
          ? 'NO ELIGIBLE CANDIDATES AVAILABLE WITHOUT HARD CONSTRAINT VIOLATIONS'
          : candidates
              .map(
                (c) =>
                  `  * ${c.technicianName} (${c.technicianId}) - Feasible Slots: [${c.feasibleSlots.join(', ')}] (Region match: ${
                    c.isRegionMatch
                  }, Preferred window compliant: ${c.preferredWindowCompliant})`
              )
              .join('\n')
      }`
  )
  .join('\n\n')}

=== DISPATCHER INSTRUCTION / GOAL ===
"${dispatcherQuestion}"

Please analyze the operational situation and return a structured JSON dispatch proposal adhering strictly to the schema.`;
}

/**
 * Invokes the Gemini API using @google/genai to generate a structured AI dispatch plan
 */
export async function generateGeminiDispatchPlan({
  requests = [],
  technicians = [],
  existingAssignments = [],
  eligibleCandidatesByRequest = {},
  scheduleVersion = 'v3',
  dispatcherQuestion = 'Generate the best feasible dispatch plan for the current requests.',
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_GEMINI_API_KEY') {
    return {
      success: false,
      error: 'Gemini API key is not configured',
    };
  }

  const configuredModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  const prompt = buildPlanningPrompt({
    scheduleVersion,
    requests,
    technicians,
    existingAssignments,
    eligibleCandidatesByRequest,
    dispatcherQuestion,
  });

  const ai = new GoogleGenAI({ apiKey });

  // Model priority list — prioritizing currently active responsive models
  const modelsToTry = [
    ...new Set([
      configuredModel,
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3-flash-preview',
      'gemini-3.5-flash',
      'gemini-3.8-flash',
    ]),
  ].filter(Boolean);

  // Helper: sleep for ms milliseconds
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Helper: determine if error is a transient overload that warrants retry
  const isOverloaded = (err) =>
    err.message?.includes('503') ||
    err.message?.includes('UNAVAILABLE') ||
    err.message?.includes('high demand') ||
    err.message?.includes('overloaded');

  // Helper: determine if error is permanent (wrong key, model gone, 429 quota reached on this model, etc.)
  const isPermanentError = (err) =>
    err.message?.includes('API_KEY_INVALID') ||
    err.message?.includes('403') ||
    err.message?.includes('429') ||
    err.message?.includes('RESOURCE_EXHAUSTED') ||
    err.message?.includes('Quota exceeded') ||
    err.message?.includes('unregistered') ||
    err.message?.includes('404') ||
    err.message?.includes('NOT_FOUND') ||
    err.message?.includes('no longer available');

  let lastError = null;

  for (const modelName of modelsToTry) {
    // Retry up to 3 times per model on transient 503 overloads
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[GeminiPlannerService] Attempt ${attempt}/${maxRetries} using model: ${modelName}`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: AI_PLAN_SCHEMA,
          },
        });

        const responseText = response.text;
        if (!responseText) {
          throw new Error('Gemini API returned an empty response body.');
        }

        let parsedPlan;
        try {
          parsedPlan = JSON.parse(responseText);
        } catch (parseErr) {
          throw new Error(`Failed to parse Gemini structured JSON: ${parseErr.message}`);
        }

        console.log(`[GeminiPlannerService] Success with model: ${modelName} (attempt ${attempt})`);
        return {
          success: true,
          plan: parsedPlan,
          metadata: {
            model: modelName,
            generatedAt: new Date().toISOString(),
            scheduleVersion,
          },
        };
      } catch (err) {
        lastError = err;

        if (isPermanentError(err)) {
          // Model is gone or key is bad — skip retries, try next model
          console.warn(`[GeminiPlannerService] Permanent error on model ${modelName}: ${err.message}. Skipping to next model.`);
          break;
        }

        if (isOverloaded(err) && attempt < maxRetries) {
          // Transient overload — wait with exponential backoff then retry
          const waitMs = attempt * 3000; // 3s, 6s, 9s
          console.warn(`[GeminiPlannerService] Model ${modelName} overloaded (attempt ${attempt}). Retrying in ${waitMs / 1000}s...`);
          await sleep(waitMs);
          continue;
        }

        // Other error or max retries reached — try next model
        console.warn(`[GeminiPlannerService] Model ${modelName} failed after ${attempt} attempt(s): ${err.message}`);
        break;
      }
    }
  }

  return {
    success: false,
    error: `Gemini API planning failed: ${lastError?.message || 'Unknown error'}. The Gemini API may be temporarily overloaded — please try again in a few seconds.`,
  };
}

export default {
  generateGeminiDispatchPlan,
  buildPlanningPrompt,
  AI_PLAN_SCHEMA,
};
