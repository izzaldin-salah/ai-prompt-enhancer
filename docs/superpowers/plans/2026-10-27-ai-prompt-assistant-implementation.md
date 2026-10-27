# AI Prompt Assistant ("Prompta") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Figma-scaffolded UI into a fully functional, cross-device AI Prompt Assistant that accepts voice (Egyptian Arabic & English via Groq Whisper), clarifies ambiguities in Smart mode, synthesizes structured agent-ready English prompts using the configured AI endpoint, and persists sessions to Supabase for iPhone & PC cross-device access.

**Architecture:**
- **Frontend:** React 19 + TypeScript + Tailwind CSS v4 running on Vite 8.
- **Voice / STT:** Browser `MediaRecorder` (with iOS Safari & Chrome container fallbacks) + Groq Whisper (`whisper-large-v3`) API.
- **AI Engine:** OpenAI-compatible API (`https://personal-antigravity-api.onrender.com/v1`, model `gemini-3.8-flash-low`) handling Smart mode clarification, prompt generation (4 sections: Objective, Tech Stack, Steps, Assumptions), and incremental refinement.
- **Data Persistence:** Supabase PostgreSQL (`vbebmjyfhxxkyboftlxi`) with Realtime & Row-Level Security for cross-device sync.

---

## File Structure Map
- `src/config.ts` — Unified configuration for AI, Groq transcription, and Supabase.
- `src/types/index.ts` — Shared domain types (Mode, Domain, Detail, PromptSection, ClarificationQuestion, SessionState).
- `src/services/supabase.ts` — Supabase client initialization, database migrations, and session persistence methods.
- `src/services/transcription.ts` — Audio recorder controller and Groq Whisper API client.
- `src/services/ai.ts` — AI prompt synthesizer, smart clarification generator, and iterative prompt refiner.
- `src/App.tsx` — Main application component integrating voice recording, dynamic prompt generation, clarification questions, and Supabase sync status.

---

### Task 1: Supabase Database Schema & Client Setup

**Files:**
- Create `src/types/index.ts`
- Create `src/services/supabase.ts`
- Apply Supabase migration `20261027_init_prompts_schema` via Supabase MCP

- [ ] **Step 1: Install `@supabase/supabase-js`**
  Run `npm install @supabase/supabase-js`.
- [ ] **Step 2: Create types file (`src/types/index.ts`)**
  Define `Mode`, `Domain`, `Detail`, `PromptSection`, `Clarification`, `Session`, and `PromptData`.
- [ ] **Step 3: Apply Database Migration via Supabase MCP**
  Execute `apply_migration` to create `conversations`, `messages`, `prompts`, and `user_preferences` tables with appropriate RLS policies.
- [ ] **Step 4: Create Supabase Client & CRUD Helpers (`src/services/supabase.ts`)**
  Implement `saveSession`, `loadLatestSession`, and realtime sync subscriptions.
- [ ] **Step 5: Verify Database Connection**
  Run a test script against Supabase to verify inserting and reading a record.

---

### Task 2: Groq Whisper Voice Recording & Transcription

**Files:**
- Create `src/services/transcription.ts`

- [ ] **Step 1: Implement Audio Recorder in `src/services/transcription.ts`**
  Use `navigator.mediaDevices.getUserMedia` with fallback MIME types (`audio/webm;codecs=opus`, `audio/mp4`, `audio/aac`) for iOS Safari and PC Chrome compatibility.
- [ ] **Step 2: Implement Groq Whisper API Client**
  Send audio blob to `https://api.groq.com/openai/v1/audio/transcriptions` with model `whisper-large-v3`, providing an Egyptian Arabic / technical vocabulary prompt to maximize transcription accuracy for code-switching.
- [ ] **Step 3: Test Groq Transcription Pipeline**
  Verify transcription handler with mock or real audio blob.

---

### Task 3: AI Prompt Synthesizer & Clarification Engine

**Files:**
- Create `src/services/ai.ts`

- [ ] **Step 1: Implement OpenAI-Compatible Chat Client**
  Create structured API caller pointing to `config.ai.baseUrl` and `config.ai.apiKey` using `config.ai.model`.
- [ ] **Step 2: Implement Smart Clarification Generator**
  Detect whether a thought (in Arabic, English, or mixed) requires clarification. If incomplete, return a concise English question and 3-4 option chips.
- [ ] **Step 3: Implement Prompt Synthesizer**
  Generate the 4 structured prompt sections:
  1. `01 / Objective`
  2. `02 / Tech stack & constraints`
  3. `03 / Implementation steps`
  4. `04 / Assumptions & fallbacks`
  Tailored to `Domain` (`Coding`, `Planning`, `General`) and `Detail` (`Quick`, `Standard`, `Detailed`).
- [ ] **Step 4: Implement Incremental Prompt Refinement**
  Update existing prompt sections when user selects a refinement chip or types a refinement instruction without losing confirmed requirements.
- [ ] **Step 5: Verify AI Service with Test Call**
  Run a standalone test to ensure valid JSON/structured output from the AI model.

---

### Task 4: Integrate All Services into [src/App.tsx](file:///c:/Users/izald/OneDrive/Documents/PROJECTS/AI%20PROMT%20ENHANCER/src/App.tsx)

**Files:**
- Modify `src/App.tsx`
- Modify `src/index.css` (if any missing loading/status styles are needed)

- [ ] **Step 1: Connect Voice Capture to Groq Whisper**
  Connect microphone button to `startRecording` / `stopRecording`. Show live timer and handle mic permission errors gracefully.
- [ ] **Step 2: Connect Smart Clarification Flow**
  When thought text changes or voice is transcribed in Smart mode, invoke AI clarification; show dynamic clarification question and selectable answer chips.
- [ ] **Step 3: Connect Prompt Synthesis Action**
  On "Synthesize prompt" click, invoke `synthesizePrompt`. Show loading state, render resulting 4 sections, and compute estimated token count.
- [ ] **Step 4: Connect Refinements & Copy Action**
  Wire refinement chips and custom refinement input to `refinePrompt`.
- [ ] **Step 5: Connect Supabase Auto-Save & Sync**
  Save current state to Supabase on changes (debounced), update "Session saved" indicator in top bar, and support "New session".
- [ ] **Step 6: Update Model Badge dynamically**
  Display current active AI model (`config.ai.model`) in the top right of the output pane.

---

### Task 5: End-to-End Verification & Build Check

**Files:**
- Entire workspace

- [ ] **Step 1: Run TypeScript & Vite Production Build**
  Run `npm run build` to ensure zero compilation or bundle errors.
- [ ] **Step 2: Verify End-to-End User Flow**
  Test with Egyptian Arabic + English sample input ("عايز أعمل SaaS dashboard مع Supabase و Next.js"), confirm clarification, synthesize prompt, refine, copy, and confirm Supabase save.
