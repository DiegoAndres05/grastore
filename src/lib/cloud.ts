import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import type { State } from '../types'

export type CloudConfig = { url: string; anonKey: string }

export function readCloudConfig(): CloudConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) return null
  return { url, anonKey }
}

let client: SupabaseClient | null = null

export function supabase() {
  const config = readCloudConfig()
  if (!config) return null
  if (!client) {
    client = createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  }
  return client
}

export async function fetchBook() {
  const db = supabase()
  if (!db) return null
  const { data, error } = await db.from('books').select('version,data').eq('id', 'main').maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return { version: data.version as number, data: data.data as State }
}

export async function saveBook(state: State, version: number, userId: string) {
  const db = supabase()
  if (!db) return { ok: false as const, conflict: false, message: 'Supabase no está configurado' }
  if (version <= 0) {
    const { data, error } = await db.from('books').insert({ id: 'main', version: 1, data: state, updated_by: userId }).select('version').maybeSingle()
    if (error) return { ok: false as const, conflict: error.code === '23505', message: error.message }
    return { ok: true as const, version: (data?.version as number) ?? 1 }
  }
  const { data, error } = await db
    .from('books')
    .update({ version: version + 1, data: state, updated_by: userId, updated_at: new Date().toISOString() })
    .eq('id', 'main')
    .eq('version', version)
    .select('version')
  if (error) return { ok: false as const, conflict: false, message: error.message }
  if (!data?.length) return { ok: false as const, conflict: true, message: 'Otro usuario guardó el libro' }
  return { ok: true as const, version: data[0].version as number }
}

export async function loadProfile(session: Session) {
  const db = supabase()
  const fallback = session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Usuario'
  if (!db) return String(fallback)
  const { data } = await db.from('profiles').select('display_name').eq('id', session.user.id).maybeSingle()
  return (data?.display_name as string) || String(fallback)
}
