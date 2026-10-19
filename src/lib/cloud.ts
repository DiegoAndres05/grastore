import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import type { Access } from './access'
import { hydrate } from './book'
import { projectUrl } from './supabaseUrl'
import type { State } from '../types'

export type CloudConfig = { url: string; anonKey: string }

export function readCloudConfig(): CloudConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) return null
  return { url: projectUrl(url), anonKey }
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

export type Snapshot = { version: number; state: State; access: Access }

export async function fetchSnapshot() {
  const db = supabase()
  if (!db) return null
  const { data, error } = await db.rpc('book_snapshot')
  if (error) throw new Error(error.message)
  const snap = data as Snapshot
  return { version: snap.version, state: hydrate(snap.state), access: snap.access }
}

export async function postBook(action: string, input: unknown) {
  const db = supabase()
  const session = await db?.auth.getSession()
  const token = session?.data.session?.access_token
  if (!token) return { ok: false as const, error: 'No hay sesión', conflict: false }
  const response = await fetch('/api/book', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, input }),
  })
  let body: { ok?: boolean; error?: string; conflict?: boolean; version?: number; state?: unknown; access?: Access; data?: unknown }
  try {
    body = (await response.json()) as typeof body
  } catch {
    return { ok: false as const, error: 'El servidor no pudo guardar el libro', conflict: false }
  }
  if (!response.ok || !body.ok || !body.access) {
    return { ok: false as const, error: body.error || 'No se pudo guardar', conflict: Boolean(body.conflict) }
  }
  return { ok: true as const, version: body.version ?? 0, state: hydrate(body.state), access: body.access, data: body.data }
}

export async function usersRequest(method: 'GET' | 'POST', input?: unknown) {
  const db = supabase()
  const session = await db?.auth.getSession()
  const token = session?.data.session?.access_token
  if (!token) return { ok: false as const, error: 'No hay sesión' }
  const response = await fetch('/api/users', {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: method === 'POST' ? JSON.stringify(input ?? {}) : undefined,
  })
  const body = (await response.json()) as { ok?: boolean; error?: string; users?: unknown; roles?: unknown; catalog?: unknown }
  if (!response.ok || !body.ok) return { ok: false as const, error: body.error || 'No se pudo guardar' }
  return { ok: true as const, users: body.users, roles: body.roles, catalog: body.catalog }
}

export async function loadProfile(session: Session) {
  // 0002 revoked SELECT on profiles for the signed-in role. The banner uses
  // the name stored at signup. The server still reads profiles with the
  // service role when it records who made a change.
  const fallback = session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Usuario'
  return String(fallback)
}
