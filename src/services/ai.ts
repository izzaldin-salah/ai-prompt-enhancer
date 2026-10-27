import { config } from '../config'
import type { Clarification, Detail, Domain, Mode, PromptSection } from '../types'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function callChatCompletion(messages: ChatMessage[], jsonMode = true): Promise<string> {
  const apiKey = config.ai.apiKey
  if (!apiKey) {
    throw new Error('AI Provider API Key is missing. Please set OPENAI_API_KEY in your .env file.')
  }

  const baseUrl = config.ai.baseUrl.replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.ai.model || 'gemini-3.8-flash-low',
      messages,
      temperature: 0.25,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMsg = `AI request failed (${response.status})`
    try {
      const err = JSON.parse(errorText)
      if (err?.error?.message) errorMsg = err.error.message
    } catch {
      // Use fallback
    }
    throw new Error(errorMsg)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

function parseJsonSafely<T>(text: string, fallback: T): T {
  try {
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim()
    return JSON.parse(cleaned) as T
  } catch (err) {
    console.warn('Failed to parse AI JSON response:', err, text)
    return fallback
  }
}

/**
 * Generate a smart clarification question if the input is ambiguous or lacks a key decision.
 */
export async function analyzeThoughtForClarification(
  thought: string,
  domain: Domain
): Promise<Clarification | null> {
  if (!thought || thought.trim().split(/\s+/).length < 3) {
    return null
  }

  const systemPrompt = `You are Prompta, an expert prompt engineer.
The user thinks in Egyptian Arabic, Modern Standard Arabic, or English, often code-switching.
Analyze their raw thought for the "${domain}" domain.
Determine if there is a single, crucial clarifying question that would significantly sharpen the prompt without being redundant.
If the request is already clear or self-contained, return {"needsClarification": false}.

CRITICAL: Never use corporate jargon, fluff, or buzzwords (no "delve", "seamless", "leverage", "robust", "game-changer", etc.). Keep questions plain, direct, and natural.

Return a JSON object:
{
  "needsClarification": boolean,
  "question": "One concise clarification question in English",
  "options": ["Option 1", "Option 2", "Option 3"]
}`

  try {
    const content = await callChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `User thought: "${thought}"` },
    ])

    const res = parseJsonSafely<{
      needsClarification: boolean
      question: string
      options: string[]
    }>(content, { needsClarification: false, question: '', options: [] })

    if (res.needsClarification && res.question && res.options?.length) {
      return {
        question: res.question,
        options: res.options.slice(0, 4),
      }
    }
    return null
  } catch (err) {
    console.error('Clarification analysis error:', err)
    return null
  }
}

export interface SynthesisInput {
  thought: string
  mode: Mode
  domain: Domain
  detail: Detail
  clarificationAnswer?: string
}

function getDomainAndDetailGuidelines(domain: Domain, detail: Detail) {
  // Domain-specific purpose and output structure
  let domainInstructions = ''
  if (domain === 'General') {
    domainInstructions = `PROMPT TYPE: GENERAL
- Purpose & Structure: Natural, clear English. No unnecessary formatting.
- Tone: Fluid, readable, and direct.
- DO NOT use software engineering boilerplate (no "tech stack", no "implementation steps", no "coding agent" phrasing).`
  } else if (domain === 'Coding') {
    domainInstructions = `PROMPT TYPE: CODING
- Purpose & Structure: Technical requirements, implementation instructions, constraints, and verification steps when relevant.
- Tone: Precise software engineering instructions. Preserve library names, frameworks, and architecture patterns.`
  } else {
    domainInstructions = `PROMPT TYPE: PLANNING
- Purpose & Structure: Objectives, context, considerations, dependencies, and expected deliverables.
- Tone: Strategic, structured, and goal-oriented.`
  }

  // Detail level controls how detailed the output should be
  let detailInstructions = ''
  let schemaHint = ''

  if (detail === 'Quick') {
    detailInstructions = `ENHANCEMENT LEVEL: QUICK
- Short, direct, minimal structure.
- Eliminate all conversational fluff, boilerplate, and speculative filler.`

    if (domain === 'General') {
      schemaHint = `For General + Quick:
Return 1 section containing ONLY the natural, clear English prompt text in "body". No section number "n", no robotic title.
{
  "sections": [
    {
      "body": "Natural, clear English prompt without unnecessary formatting."
    }
  ]
}`
    } else {
      schemaHint = `For ${domain} + Quick:
Return 1 or at most 2 minimal sections:
{
  "sections": [
    {
      "n": "01",
      "title": "${domain === 'Coding' ? 'Technical Requirement' : 'Objective & Deliverable'}",
      "body": "Direct, short prompt (2-3 sentences max).",
      "list": ["Optional essential constraint or deliverable"]
    }
  ]
}`
    }
  } else if (detail === 'Standard') {
    detailInstructions = `ENHANCEMENT LEVEL: STANDARD
- Organized with relevant details.
- Balanced depth: clear structure with actionable details without overwhelming length.`

    if (domain === 'General') {
      schemaHint = `For General + Standard:
Return 1 or 2 natural sections with clear English instructions and relevant context:
{
  "sections": [
    {
      "title": "Instruction",
      "body": "Clear, natural English request..."
    },
    {
      "title": "Context & Requirements",
      "body": "Relevant details and desired output..."
    }
  ]
}`
    } else if (domain === 'Coding') {
      schemaHint = `For Coding + Standard:
Return structured technical sections:
{
  "sections": [
    { "n": "01", "title": "Technical Requirements", "body": "..." },
    { "n": "02", "title": "Implementation Instructions", "list": ["Step 1", "Step 2", "Step 3"] },
    { "n": "03", "title": "Constraints & Stack", "body": "..." }
  ]
}`
    } else {
      schemaHint = `For Planning + Standard:
Return structured planning sections:
{
  "sections": [
    { "n": "01", "title": "Objectives & Context", "body": "..." },
    { "n": "02", "title": "Key Considerations & Dependencies", "list": ["..."] },
    { "n": "03", "title": "Expected Deliverables", "body": "..." }
  ]
}`
    }
  } else {
    // Detailed
    detailInstructions = `ENHANCEMENT LEVEL: DETAILED
- Comprehensive, with sections when useful.
- Provide thorough specifications, edge cases, and verification criteria.`

    if (domain === 'General') {
      schemaHint = `For General + Detailed:
Return comprehensive, well-structured English sections:
{
  "sections": [
    { "title": "Objective & Background", "body": "..." },
    { "title": "Specific Requirements & Tone", "list": ["...", "..."] },
    { "title": "Expected Deliverable & Format", "body": "..." }
  ]
}`
    } else if (domain === 'Coding') {
      schemaHint = `For Coding + Detailed:
Return complete technical sections:
{
  "sections": [
    { "n": "01", "title": "Technical Requirements", "body": "..." },
    { "n": "02", "title": "Implementation Instructions", "list": ["Step 1", "Step 2", "Step 3"] },
    { "n": "03", "title": "Constraints & Assumptions", "body": "..." },
    { "n": "04", "title": "Verification & Testing Steps", "list": ["Test 1", "Test 2"] }
  ]
}`
    } else {
      schemaHint = `For Planning + Detailed:
Return complete planning sections:
{
  "sections": [
    { "n": "01", "title": "Objectives & Scope", "body": "..." },
    { "n": "02", "title": "Context & Strategic Considerations", "body": "..." },
    { "n": "03", "title": "Dependencies & Risks", "list": ["...", "..."] },
    { "n": "04", "title": "Expected Deliverables & Timeline", "list": ["...", "..."] }
  ]
}`
    }
  }

  return { domainInstructions, detailInstructions, schemaHint }
}

/**
 * Synthesize a prompt tailored to Domain and Detail Level according to exact project specifications.
 */
export async function synthesizePrompt(input: SynthesisInput): Promise<PromptSection[]> {
  const { thought, domain, detail, clarificationAnswer } = input
  const guidelines = getDomainAndDetailGuidelines(domain, detail)

  const systemPrompt = `You are Prompta, an elite prompt engineer.
Your task is to convert raw thoughts (spoken or typed in Egyptian Arabic, MSA, English, or mixed language) into prompts in English appropriate to their purpose.

CORE RULES:
1. Output language MUST ALWAYS BE 100% ENGLISH. All titles, bodies, and list items must be written in English only, regardless of input language.
2. Never lose or mistranslate programming terms, framework names, or identifiers.
3. NEVER invent unwanted requirements. Faithfully preserve the user's intent.
4. If a clarification answer was provided, integrate it directly.
5. STRICTLY BAN ALL BUZZWORDS, FLUFF & CORPORATE JARGON:
   - NEVER use hollow AI buzzwords or cliché corporate marketing speak.
   - BANNED WORDS/PHRASES include: "seamless" / "seamlessly", "delve", "leverage", "robust", "tapestry", "testament", "game-changer", "revolutionary", "cutting-edge", "state-of-the-art", "elevate", "streamline", "supercharge", "unleash", "embark", "foster", "dive deep", "holistic", "synergy", "paradigm shift", "pinnacle", "beacon", "groundbreaking", "mission-critical", "bespoke".
   - Instead, use plain, direct, unambiguous words:
     * Write "use" instead of "leverage" or "harness".
     * Write "connect" or "integrate" instead of "seamlessly integrate".
     * Write "handle errors" or "validate data" instead of "ensure robust handling".
     * Write "fast" or state specific latency targets instead of "blazing fast" or "cutting-edge".
     * Write "organize" or "build" instead of "orchestrate a holistic ecosystem".
   - Keep all sentences concrete, specific, and grounded in reality.

${guidelines.domainInstructions}

${guidelines.detailInstructions}

RESPONSE JSON SCHEMA:
${guidelines.schemaHint}`

  const userMessage = `User Raw Thought:
"""
${thought}
"""
${clarificationAnswer ? `Clarification Answer provided: "${clarificationAnswer}"` : ''}

Generate the prompt now.`

  const content = await callChatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ])

  const parsed = parseJsonSafely<{ sections: PromptSection[] }>(content, { sections: [] })

  if (parsed.sections && parsed.sections.length > 0) {
    return parsed.sections
  }

  return [
    { body: thought },
  ]
}

/**
 * Refine existing prompt sections with an additional instruction.
 */
export async function refinePrompt(
  currentSections: PromptSection[],
  refinementInstruction: string,
  domain: Domain
): Promise<PromptSection[]> {
  const systemPrompt = `You are Prompta. You are updating an existing prompt based on a user's refinement instruction (e.g. "+ Rate limiting", "make it shorter", "add dark mode").
Maintain the domain "${domain}" and existing structure style unless explicitly requested to change.
All output must be in English.
CRITICAL: Never introduce corporate buzzwords, filler, or marketing fluff (e.g., no "seamless", "leverage", "delve", "robust", "game-changer", etc.). Keep all instructions concrete and plain.

Return JSON:
{
  "sections": [
    {
      "n": "optional index",
      "title": "optional title",
      "body": "updated text",
      "list": ["optional items"]
    }
  ]
}`

  const userMessage = `Current Prompt Sections:
${JSON.stringify(currentSections, null, 2)}

Refinement Request: "${refinementInstruction}"

Return updated sections in JSON.`

  const content = await callChatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ])

  const parsed = parseJsonSafely<{ sections: PromptSection[] }>(content, { sections: [] })
  return parsed.sections?.length ? parsed.sections : currentSections
}
