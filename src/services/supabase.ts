import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from '../config'
import type { SessionData } from '../types'

let supabase: SupabaseClient | null = null

if (config.supabase.url && config.supabase.anonKey) {
  supabase = createClient(config.supabase.url, config.supabase.anonKey)
}

export function isSupabaseConfigured(): boolean {
  return !!supabase
}

export async function saveSessionToCloud(session: SessionData): Promise<string | null> {
  if (!supabase) return null

  try {
    const payload = {
      title: session.title || session.thought.slice(0, 50) || 'Untitled Prompt',
      mode: session.mode,
      domain: session.domain,
      detail_level: session.detail,
      thought: session.thought,
      clarification: session.clarification || null,
      sections: session.sections,
      token_count: session.tokenCount || 0,
      updated_at: new Date().toISOString(),
    }

    if (session.id) {
      const { data, error } = await supabase
        .from('conversations')
        .update(payload)
        .eq('id', session.id)
        .select('id')
        .single()

      if (error) {
        console.error('Failed to update session in Supabase:', error)
        return null
      }
      return data?.id || session.id
    } else {
      const { data, error } = await supabase
        .from('conversations')
        .insert(payload)
        .select('id')
        .single()

      if (error) {
        console.error('Failed to create session in Supabase:', error)
        return null
      }
      return data?.id || null
    }
  } catch (err) {
    console.error('Supabase save error:', err)
    return null
  }
}

export async function loadLatestSessionFromCloud(): Promise<SessionData | null> {
  if (!supabase) return null

  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      return null
    }

    return {
      id: data.id,
      title: data.title,
      mode: data.mode,
      domain: data.domain,
      detail: data.detail_level,
      thought: data.thought || '',
      clarification: data.clarification,
      sections: Array.isArray(data.sections) ? data.sections : [],
      tokenCount: data.token_count || 0,
      updatedAt: data.updated_at,
    }
  } catch (err) {
    console.error('Supabase load error:', err)
    return null
  }
}
