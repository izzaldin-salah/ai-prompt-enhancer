import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { config } from './config'
import type { Clarification, Detail, Domain, Mode, PromptSection } from './types'
import { AudioRecorder, transcribeAudioWithGroq } from './services/transcription'
import { analyzeThoughtForClarification, refinePrompt, synthesizePrompt } from './services/ai'
import { isSupabaseConfigured, loadLatestSessionFromCloud, saveSessionToCloud } from './services/supabase'

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    spark: <path d="m12 2 1.3 4.2L17.5 7.5l-4.2 1.3L12 13l-1.3-4.2-4.2-1.3 4.2-1.3L12 2Zm-6 9 .8 2.2L9 14l-2.2.8L6 17l-.8-2.2L3 14l2.2-.8L6 11Zm10 3 .7 1.8 1.8.7-1.8.7L16 19l-.7-1.8-1.8-.7 1.8-.7L16 14Z" />,
    desktop: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
    phone: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3m-3 0h6" /></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    trash: <><path d="M4 7h16m-10 4v5m4-5v5M9 7l1-3h4l1 3m3 0-1 14H7L6 7" /></>,
    arrow: <><path d="M5 12h14m-5-5 5 5-5 5" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    wave: <path d="M4 10v4m4-8v12m4-16v20m4-16v12m4-8v4" />,
    loader: <path d="M21 12a9 9 0 1 1-6.219-8.56" />,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={name === 'spark' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

function Button({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`button ${className}`} {...props}>{children}</button>
}

interface OptionDescription {
  subtitle: string
  description: string
}

const modeDescriptions: Record<Mode, OptionDescription> = {
  Manual: {
    subtitle: 'Direct Control',
    description: 'Generates a prompt only when you click "Synthesize". No automatic checks or unsolicited questions.',
  },
  Auto: {
    subtitle: 'Streamlined',
    description: 'Automatically analyzes input and generates the prompt as soon as sufficient detail is provided.',
  },
  Smart: {
    subtitle: 'Interactive (Default)',
    description: 'Evaluates completeness, asks 1 targeted clarification question if needed, and suggests prompt creation.',
  },
}

const domainDescriptions: Record<Domain, OptionDescription> = {
  Coding: {
    subtitle: 'Software & Agents',
    description: 'Generates technical requirements, implementation steps, constraints, and test criteria for coding agents.',
  },
  Planning: {
    subtitle: 'Roadmaps & Architecture',
    description: 'Generates strategic objectives, project phases, dependencies, risk mitigations, and deliverables.',
  },
  General: {
    subtitle: 'Everyday AI Requests',
    description: 'Generates clear, natural English prompts with zero technical boilerplate, jargon, or unnecessary formatting.',
  },
}

const detailDescriptions: Record<Detail, OptionDescription> = {
  Quick: {
    subtitle: 'Minimal Structure',
    description: 'Short, direct 2–4 sentence prompt with zero fluff. Ideal to copy and paste directly into ChatGPT/Claude.',
  },
  Standard: {
    subtitle: 'Balanced Depth',
    description: 'Organized into 2–3 structured sections tailored to the domain with relevant guidelines and action items.',
  },
  Detailed: {
    subtitle: 'Comprehensive Spec',
    description: 'Full 4-section specification with architecture, deep context, edge cases, and verification criteria.',
  },
}

function Segmented<T extends string>({
  label,
  values,
  value,
  onChange,
  descriptions,
}: {
  label: string
  values: T[]
  value: T
  onChange: (value: T) => void
  descriptions: Record<T, OptionDescription>
}) {
  const [clickedItem, setClickedItem] = useState<T | null>(null)

  return (
    <div className="control-group">
      <div className="label">{label}</div>
      <div className="segmented">
        {values.map((item, idx) => {
          const info = descriptions[item]
          const alignment = idx === 0 ? 'align-left' : idx === values.length - 1 ? 'align-right' : 'align-center'
          const isClicked = clickedItem === item

          return (
            <div
              key={item}
              className={`segmented-btn-wrapper ${isClicked ? 'clicked' : ''}`}
              onMouseLeave={() => setClickedItem(null)}
            >
              <Button
                className={item === value ? 'selected' : ''}
                onClick={(e) => {
                  e.currentTarget.blur()
                  setClickedItem(item)
                  onChange(item)
                }}
                type="button"
                aria-label={`${item}: ${info.description}`}
              >
                {item}
              </Button>
              <div className={`tooltip-bubble ${alignment}`} role="tooltip">
                <div className="tooltip-header">
                  <strong>{item}</strong>
                  {info.subtitle && <span className="tooltip-subtitle">{info.subtitle}</span>}
                </div>
                <p className="tooltip-text">{info.description}</p>
                <div className="tooltip-arrow" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('Smart')
  const [domain, setDomain] = useState<Domain>('Coding')
  const [detail, setDetail] = useState<Detail>('Standard')
  const [thought, setThought] = useState('')
  const [clarification, setClarification] = useState<Clarification | null>(null)
  const [chosenAnswer, setChosenAnswer] = useState('')
  const [customAnswer, setCustomAnswer] = useState('')

  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [synthesizing, setSynthesizing] = useState(false)
  const [refining, setRefining] = useState(false)
  const [analyzingClarification, setAnalyzingClarification] = useState(false)

  const [seconds, setSeconds] = useState(0)
  const [copied, setCopied] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [micError, setMicError] = useState(false)
  const [micErrorMessage, setMicErrorMessage] = useState('')
  const [generated, setGenerated] = useState(false)
  const [sections, setSections] = useState<PromptSection[]>([])
  const [refinementInput, setRefinementInput] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const recorderRef = useRef<AudioRecorder | null>(null)
  const saveTimeoutRef = useRef<number | null>(null)

  // Load previous session on startup from Supabase if available
  useEffect(() => {
    async function initSession() {
      if (!isSupabaseConfigured()) return
      const saved = await loadLatestSessionFromCloud()
      if (saved && (saved.thought || saved.sections.length > 0)) {
        setSessionId(saved.id || null)
        setMode(saved.mode)
        setDomain(saved.domain)
        setDetail(saved.detail)
        setThought(saved.thought)
        if (saved.clarification) {
          setClarification(saved.clarification)
          setChosenAnswer(saved.clarification.chosenOption || '')
          setCustomAnswer(saved.clarification.customAnswer || '')
        }
        if (saved.sections.length > 0) {
          setSections(saved.sections)
          setGenerated(true)
        }
        setSaveStatus('saved')
      }
    }
    initSession()
  }, [])

  // Live timer for recording
  useEffect(() => {
    if (!recording) return
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [recording])

  // Language detection indicator
  const langStatus = useMemo(() => {
    if (!thought.trim()) return { icon: 'ع+EN', text: 'Mixed language ready' }
    const hasArabic = /[\u0600-\u06FF]/.test(thought)
    const hasEnglish = /[a-zA-Z]/.test(thought)
    if (hasArabic && hasEnglish) return { icon: 'ع', text: 'Arabic + English detected' }
    if (hasArabic) return { icon: 'ع', text: 'Arabic detected' }
    if (hasEnglish) return { icon: 'EN', text: 'English detected' }
    return { icon: 'Aa', text: 'Input detected' }
  }, [thought])

  const words = useMemo(() => (thought.trim() ? thought.trim().split(/\s+/).length : 0), [thought])

  const tokenCount = useMemo(() => {
    if (!sections.length) return 0
    const allText = sections
      .map((s) => `${s.title} ${s.body || ''} ${s.list ? s.list.join(' ') : ''}`)
      .join(' ')
    return Math.round(allText.split(/\s+/).filter(Boolean).length * 1.35)
  }, [sections])

  // Trigger Smart Clarification analysis when thought finishes changing
  useEffect(() => {
    if (mode !== 'Smart' || words < 4 || generated) {
      return
    }

    const timer = window.setTimeout(async () => {
      setAnalyzingClarification(true)
      const res = await analyzeThoughtForClarification(thought, domain)
      if (res) {
        setClarification(res)
        setChosenAnswer('')
      }
      setAnalyzingClarification(false)
    }, 1200)

    return () => window.clearTimeout(timer)
  }, [thought, mode, domain, words, generated])

  // Auto-save debouncer to Supabase
  const persistSession = (updatedSections = sections) => {
    if (!isSupabaseConfigured() || (!thought.trim() && updatedSections.length === 0)) return
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current)

    setSaveStatus('saving')
    saveTimeoutRef.current = window.setTimeout(async () => {
      const id = await saveSessionToCloud({
        id: sessionId || undefined,
        mode,
        domain,
        detail,
        thought,
        clarification: clarification
          ? { ...clarification, chosenOption: chosenAnswer, customAnswer }
          : null,
        sections: updatedSections,
        tokenCount,
      })
      if (id) {
        setSessionId(id)
        setSaveStatus('saved')
      } else {
        setSaveStatus('idle')
      }
    }, 1500)
  }

  // Voice recording handlers
  const handleStartRecording = async () => {
    setMicError(false)
    setMicErrorMessage('')
    try {
      const recorder = new AudioRecorder()
      recorderRef.current = recorder
      await recorder.start()
      setSeconds(0)
      setRecording(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied.'
      setMicErrorMessage(msg)
      setMicError(true)
      setRecording(false)
    }
  }

  const handleStopRecording = async () => {
    if (!recorderRef.current) {
      setRecording(false)
      return
    }
    setRecording(false)
    setTranscribing(true)

    try {
      const { blob, mimeType } = await recorderRef.current.stop()
      const text = await transcribeAudioWithGroq(blob, mimeType)
      if (text) {
        setThought((prev) => (prev ? `${prev.trim()} ${text}` : text))
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transcription failed.'
      setMicErrorMessage(msg)
      setMicError(true)
    } finally {
      setTranscribing(false)
      recorderRef.current = null
    }
  }

  // Reset to fresh session
  const reset = () => {
    setSessionId(null)
    setThought('')
    setClarification(null)
    setChosenAnswer('')
    setCustomAnswer('')
    setGenerated(false)
    setSections([])
    setRecording(false)
    setMicError(false)
    setSaveStatus('idle')
  }

  // Prompt Synthesis
  const handleSynthesize = async () => {
    if (!thought.trim() || synthesizing) return
    setSynthesizing(true)

    try {
      const activeClarificationAnswer = customAnswer.trim() || chosenAnswer || undefined
      const generatedSections = await synthesizePrompt({
        thought,
        mode,
        domain,
        detail,
        clarificationAnswer: activeClarificationAnswer,
      })
      setSections(generatedSections)
      setGenerated(true)
      persistSession(generatedSections)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Synthesis failed.'
      alert(`Synthesis Error: ${msg}`)
    } finally {
      setSynthesizing(false)
    }
  }

  // Refinement handler
  const handleRefine = async (instruction: string) => {
    if (!instruction.trim() || refining || !generated) return
    setRefining(true)

    try {
      const updated = await refinePrompt(sections, instruction, domain)
      setSections(updated)
      setRefinementInput('')
      persistSession(updated)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Refinement failed.'
      alert(`Refinement Error: ${msg}`)
    } finally {
      setRefining(false)
    }
  }

  // Copy prompt text to clipboard
  const copy = async () => {
    if (!sections.length) return
    let text = ''
    if (sections.length === 1 && !sections[0].title) {
      text = sections[0].body || sections[0].list?.join('\n') || ''
    } else {
      text = sections
        .map((s) => {
          const header = s.n && s.title ? `${s.n}. ${s.title}` : s.title ? s.title : ''
          const content = s.body || (s.list ? s.list.map((item, i) => `${i + 1}. ${item}`).join('\n') : '')
          return header ? `${header}\n${content}` : content
        })
        .join('\n\n')
    }

    await navigator.clipboard?.writeText(text.trim())
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className={`app-shell ${mobile ? 'mobile-preview' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Icon name="spark" size={17} /></span>
          <div><strong>Prompta</strong><span>Thoughts, engineered.</span></div>
        </div>
        <div className="header-actions">
          <div className="saved" title="Supabase Cloud Synchronization">
            <i style={{ background: saveStatus === 'saving' ? '#e2a03f' : '#50a879' }} />
            {saveStatus === 'saving' ? 'Saving to cloud…' : 'Session saved'}
          </div>
          <div className="viewport-switch" aria-label="Preview size">
            <Button className={!mobile ? 'active' : ''} onClick={() => setMobile(false)} type="button">
              <Icon name="desktop" /><span>Desktop</span>
            </Button>
            <Button className={mobile ? 'active' : ''} onClick={() => setMobile(true)} type="button">
              <Icon name="phone" /><span>Mobile</span>
            </Button>
          </div>
          <Button className="new-session" onClick={reset} type="button">
            <Icon name="plus" /> New session
          </Button>
        </div>
      </header>

      <div className="workspace">
        <section className="input-pane">
          <div className="pane-heading">
            <div>
              <span className="eyebrow">01 / Capture</span>
              <h1>Shape your thought</h1>
            </div>
            <span className="smart-badge">
              <Icon name="spark" size={13} /> {mode} mode
            </span>
          </div>

          <div className="controls">
            <Segmented
              label="Generation mode"
              values={['Manual', 'Auto', 'Smart']}
              value={mode}
              onChange={setMode}
              descriptions={modeDescriptions}
            />
            <Segmented
              label="Domain"
              values={['Coding', 'Planning', 'General']}
              value={domain}
              onChange={setDomain}
              descriptions={domainDescriptions}
            />
            <Segmented
              label="Detail level"
              values={['Quick', 'Standard', 'Detailed']}
              value={detail}
              onChange={setDetail}
              descriptions={detailDescriptions}
            />
          </div>

          {micError && (
            <div className="error-banner" role="alert">
              <span className="error-icon">!</span>
              <div>
                <strong>Audio capture issue</strong>
                <p>{micErrorMessage || 'Allow microphone access in your browser settings to record audio.'}</p>
              </div>
              <Button className="retry" onClick={handleStartRecording} type="button">Retry</Button>
              <Button className="dismiss" aria-label="Dismiss" onClick={() => setMicError(false)} type="button">
                <Icon name="close" size={16} />
              </Button>
            </div>
          )}

          <div className={`text-buffer ${recording ? 'is-recording' : ''}`}>
            {recording && (
              <div className="recording-overlay">
                <div className="recording-orb"><Icon name="wave" size={24} /></div>
                <div>
                  <strong>Listening (Groq Whisper v3)…</strong>
                  <span>{`00:${String(seconds).padStart(2, '0')}`}</span>
                </div>
                <Button onClick={handleStopRecording} type="button">Stop recording</Button>
              </div>
            )}

            {transcribing && (
              <div className="recording-overlay">
                <div className="recording-orb"><Icon name="spark" size={24} /></div>
                <div>
                  <strong>Transcribing Arabic & English…</strong>
                  <span>Fast Groq Whisper Processing</span>
                </div>
              </div>
            )}

            <textarea
              dir="auto"
              value={thought}
              onChange={(e) => setThought(e.target.value)}
              placeholder="اكتب فكرتك هنا… mix عربي و English براحتك (e.g. عايز أعمل SaaS analytics dashboard مع Next.js و Supabase)"
              aria-label="Your mixed language thought"
            />

            {!thought && (
              <div className="starters">
                <span>Try a starter</span>
                {[
                  'عايز أعمل SaaS dashboard مع Supabase و Next.js',
                  'Fix authentication rate limiting in FastAPI',
                  'Plan a migration from REST to GraphQL with caching',
                ].map((x) => (
                  <Button key={x} onClick={() => setThought(x)} type="button">{x}</Button>
                ))}
              </div>
            )}

            <div className="buffer-footer">
              <span><i>{langStatus.icon}</i> {langStatus.text}</span>
              <div className="buffer-actions">
                <span>{words} words</span>
                <Button className="mic-button" onClick={recording ? handleStopRecording : handleStartRecording} aria-label="Toggle voice recording" type="button">
                  <Icon name="mic" size={15} /> {recording ? 'Stop' : 'Hold to record'}
                </Button>
              </div>
            </div>
          </div>

          {/* Clarification section for Smart / Auto modes */}
          {thought && clarification && (
            <div className="clarification">
              <div className="question-icon">?</div>
              <div className="question-content">
                <span className="eyebrow">
                  {analyzingClarification ? 'Analyzing thought…' : 'One quick clarification'}
                </span>
                <h2>{clarification.question}</h2>
                <div className="answer-chips">
                  {clarification.options.map((option) => (
                    <Button
                      key={option}
                      className={chosenAnswer === option ? 'chosen' : ''}
                      onClick={() => setChosenAnswer(option === chosenAnswer ? '' : option)}
                      type="button"
                    >
                      {option}
                      {chosenAnswer === option && <Icon name="check" size={14} />}
                    </Button>
                  ))}
                </div>
                <input
                  className="custom-answer"
                  value={customAnswer}
                  onChange={(e) => setCustomAnswer(e.target.value)}
                  placeholder="Or type a custom answer…"
                  aria-label="Custom clarification answer"
                />
              </div>
            </div>
          )}

          <div className="action-bar">
            <Button className="clear" onClick={reset} type="button">
              <Icon name="trash" size={16} /> Clear
            </Button>
            <Button
              className="synthesize"
              disabled={!thought.trim() || synthesizing}
              onClick={handleSynthesize}
              type="button"
            >
              <Icon name="spark" size={16} />
              {synthesizing ? 'Synthesizing prompt…' : 'Synthesize prompt'}
              <Icon name="arrow" size={16} />
            </Button>
          </div>
        </section>

        <section className="output-pane">
          <div className="output-header">
            <div>
              <span className="eyebrow">02 / Refine</span>
              <h2>Engineered prompt</h2>
            </div>
            <div className="output-tools">
              <span className="model-badge" title="AI Model Endpoint">
                <i /> {config.ai.model}
              </span>
              <Button className={`copy ${copied ? 'copied' : ''}`} onClick={copy} disabled={!generated || !sections.length} type="button">
                {copied ? <Icon name="check" /> : <Icon name="copy" />}
                {copied ? 'Copied' : 'Copy prompt'}
              </Button>
            </div>
          </div>

          {generated && sections.length > 0 ? (
            <div className="output-card">
              <div className="output-meta">
                <span>Optimized for {domain.toLowerCase()} agents</span>
                <span>≈ {tokenCount} tokens</span>
              </div>
              {sections.map((section, idx) => (
                <article key={section.n || idx} className={`prompt-section ${!section.n ? 'no-index' : ''}`}>
                  {section.n && <div className="section-index">{section.n}</div>}
                  <div>
                    {section.title && <h3>{section.title}</h3>}
                    {section.body && <p className="section-body">{section.body}</p>}
                    {section.list && (
                      <ol>
                        {section.list.map((item, i) => (
                          <li key={i}>
                            <span>{i + 1}</span>
                            {item}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-output">
              <div className="empty-mark"><Icon name="spark" size={26} /></div>
              <h2>Your prompt will appear here</h2>
              <p>Speak or type your thought in Egyptian Arabic or English, choose your preferences, then synthesize it into an agent-ready prompt.</p>
            </div>
          )}

          <div className={`refinement ${!generated ? 'disabled' : ''}`}>
            <span className="eyebrow">Quick refinements</span>
            <div className="refinement-chips">
              {[
                '+ TypeScript interfaces',
                '+ Rate limiting',
                '+ Error & fallback states',
                '+ Unit & integration tests',
                '+ Strict security constraints',
              ].map((chip) => (
                <Button
                  key={chip}
                  disabled={!generated || refining}
                  onClick={() => handleRefine(chip)}
                  type="button"
                >
                  {chip}
                </Button>
              ))}
            </div>
            <form
              className="refine-input"
              onSubmit={(e) => {
                e.preventDefault()
                handleRefine(refinementInput)
              }}
            >
              <input
                disabled={!generated || refining}
                value={refinementInput}
                onChange={(e) => setRefinementInput(e.target.value)}
                placeholder={refining ? 'Refining prompt with AI…' : 'Ask for a change, e.g. "Use server components and Tailwind v4"'}
              />
              <Button disabled={!generated || refining || !refinementInput.trim()} aria-label="Submit refinement" type="submit">
                <Icon name="arrow" />
              </Button>
            </form>
          </div>
        </section>
      </div>

      <Button className="error-demo" onClick={() => { setMicErrorMessage('Demo microphone error simulation.'); setMicError(true); }} type="button">
        Preview mic error
      </Button>
    </main>
  )
}
