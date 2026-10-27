export const config = {
  ai: {
    apiKey:
      import.meta.env.OPENAI_API_KEY ||
      import.meta.env.AI_API_KEY ||
      import.meta.env.VITE_AI_API_KEY ||
      '',
    baseUrl:
      import.meta.env.OPENAI_BASE_URL ||
      import.meta.env.AI_BASE_URL ||
      import.meta.env.VITE_AI_BASE_URL ||
      'https://api.openai.com/v1',
    model:
      import.meta.env.AI_MODEL ||
      import.meta.env.VITE_AI_MODEL ||
      'gpt-4o',
  },
  transcription: {
    apiKey:
      import.meta.env.GROQ_API_KEY ||
      import.meta.env.TRANSCRIPTION_API_KEY ||
      import.meta.env.OPENAI_API_KEY ||
      import.meta.env.VITE_GROQ_API_KEY ||
      '',
    baseUrl:
      import.meta.env.GROQ_API_KEY
        ? 'https://api.groq.com/openai/v1'
        : (import.meta.env.TRANSCRIPTION_BASE_URL || 'https://api.openai.com/v1'),
    model:
      import.meta.env.GROQ_TRANSCRIPTION_MODEL ||
      import.meta.env.TRANSCRIPTION_MODEL ||
      'whisper-large-v3',
  },
  supabase: {
    url:
      import.meta.env.SUPABASE_URL ||
      import.meta.env.VITE_SUPABASE_URL ||
      '',
    anonKey:
      import.meta.env.SUPABASE_ANON_KEY ||
      import.meta.env.VITE_SUPABASE_ANON_KEY ||
      '',
  },
}
