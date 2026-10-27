# Prompta — Personal AI Prompt Assistant
> **Thoughts, engineered.** Convert spoken or typed Egyptian Arabic, MSA, and English thoughts into high-precision, production-grade prompts for AI coding agents and assistants.

![React 19](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwindcss&logoColor=white)
![Groq Whisper](https://img.shields.io/badge/Groq-Whisper_v3-F55036)
![Supabase](https://img.shields.io/badge/Supabase-Database_%26_Sync-3ECF8E?logo=supabase&logoColor=white)

---

## 🌟 Overview

**Prompta** is a personal, cross-device prompt engineering assistant designed for developers and creators who think and speak in Egyptian Arabic, English, or a mix of both (code-switching). 

Instead of simple word-for-word translation, Prompta captures the raw essence of your idea, resolves ambiguities through focused clarification questions, and structures the output into clean, actionable English prompts tailored for autonomous coding agents (like Cursor, Claude, Antigravity) or general AI models.

---

## ✨ Key Features

### 🎙️ 1. Bilingual Voice Capture (Groq Whisper Large v3)
- Instant voice recording with native `MediaRecorder` supporting cross-browser compatibility (Windows Chrome/Edge and iPhone Safari).
- Transcribes Egyptian Arabic and English technical terminology (e.g. *Next.js*, *Supabase*, *FastAPI*, *Tailwind*) accurately without distortion.
- Real-time language detection indicator (`Arabic detected`, `English detected`, or `Arabic + English detected`).

### 🎯 2. Purpose-Driven Prompt Types
| Domain | Output Focus | Output Structure |
| :--- | :--- | :--- |
| **General** | Everyday AI assistance, writing, reasoning | Natural, clear English prose. Zero robotic formatting, no tech jargon. |
| **Coding** | Software development & autonomous agents | Technical requirements, actionable implementation steps, constraints, and test criteria. |
| **Planning** | Roadmaps, system architecture, strategy | Strategic objectives, context, key considerations, dependencies, and expected deliverables. |

### ⚡ 3. Flexible Enhancement Levels
- **Quick**: Short, direct, minimal structure (1 single block or 2–4 sentences). Ready to copy and paste immediately.
- **Standard**: Balanced and organized (2–3 structured sections) with practical guidelines.
- **Detailed**: Comprehensive specification with full technical context, edge cases, and verification criteria.

### 🚫 4. Strict Anti-Buzzword Guarantee
Prompta is configured with a strict ban on hollow corporate buzzwords and AI clichés (`seamlessly`, `delve`, `leverage`, `robust`, `supercharge`, `game-changer`, etc.). Every output is grounded in direct, concrete, unambiguous language.

### ☁️ 5. Supabase Cross-Device Sync
- Sessions, transcripts, clarification answers, and generated prompts automatically sync to Supabase PostgreSQL.
- Seamlessly transition between desktop PC and mobile iPhone.
- Includes Row Level Security (RLS) for secure single-user access.

### 🎨 6. Polished UI & Micro-interactions
- Built from a tailored Figma design using Tailwind CSS v4.
- Desktop & Mobile preview switcher.
- Floating dark tooltips on long hover (900ms pause) for instant option clarity without visual distraction.
- One-click copy with dynamic formatting (copies pure text for Quick prompts, structured markdown for multi-section specs).

---

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Vite 8
- **Audio / STT:** Groq Whisper (`whisper-large-v3`) via Web MediaStreams
- **AI Engine:** OpenAI-compatible API (OpenAI, OpenRouter, Groq, or custom proxy)
- **Database & Sync:** Supabase (PostgreSQL, Realtime, Row Level Security)
- **Tooling:** Node.js, oxfmt

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/izzaldin-salah/ai-prompt-enhancer.git
cd ai-prompt-enhancer
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your credentials:
```env
# AI Provider (OpenAI, OpenRouter, Groq, DeepSeek, etc.)
OPENAI_API_KEY=your_ai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o

# Speech-to-Text: Groq Whisper Large v3
GROQ_API_KEY=your_groq_api_key_here
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3

# Supabase (Database & Cross-Device Sync)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Run the development server
```bash
npm run dev
```
Open **`http://localhost:8443`** in your browser.

---

## 📂 Project Structure

```
├── src/
│   ├── services/
│   │   ├── ai.ts              # Prompt synthesis, smart clarification, refinement
│   │   ├── transcription.ts   # AudioRecorder & Groq Whisper STT API
│   │   └── supabase.ts        # Database client & cross-device persistence
│   ├── types/
│   │   └── index.ts           # Core domain types (Mode, Domain, Detail, PromptSection)
│   ├── config.ts              # Unified environment configuration
│   ├── App.tsx                # Main UI shell, capture pane, & refine card
│   ├── index.css              # Global styles, variables, & responsive layout
│   └── main.tsx               # Application entrypoint
├── docs/                      # Architectural plans & specifications
├── .env.example               # Template environment configuration
├── vite.config.ts             # Vite configuration with Tailwind v4 & env prefixes
└── package.json
```

---

## 📄 License

This project is licensed under the MIT License.
