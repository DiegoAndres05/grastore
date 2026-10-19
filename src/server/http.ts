import type { IncomingMessage, ServerResponse } from 'node:http'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { effectivePermissions, permissionFor, redactState, type Access } from '../lib/access'
import { hydrate } from '../lib/book'
import { runAction } from '../lib/ops'
import { projectUrl } from '../lib/supabaseUrl'
import type { State } from '../types'

type Profile = {
  id: string
  display_name: string
  email: string | null
  role_id: string
  active: boolean
  overrides: Record<string, boolean> | null
}

function serverEnv() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim()
  const anon = process.env.SUPABASE_ANON_KEY?.trim() || process.env.VITE_SUPABASE_ANON_KEY?.trim()
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !anon || !service) return null
  return { url: projectUrl(url), anon, service }
}

// The server never opens Realtime. Without this, createClient asks for a
// WebSocket and crashes on the Node runtime Vercel uses for /api.
class ServerSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  readyState = 3
  url = ''
  protocol = ''
  onopen = null
  onmessage = null
  onclose = null
  onerror = null
  close() {}
  send() {}
  addEventListener() {}
  removeEventListener() {}
}

function serverClient(url: string, key: string, headers?: Record<string, string>) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ServerSocket as unknown as typeof WebSocket },
    global: headers ? { headers } : undefined,
  })
}

function adminClient() {
  const env = serverEnv()
  if (!env) return null
  return serverClient(env.url, env.service)
}

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

type RequestWithBody = IncomingMessage & { body?: unknown }

// Vercel may parse JSON before the handler runs and leave the stream empty.
// A second read then sees no action and answers 400. Prefer a body that is
// already an object, a string, or a buffer.
export async function readRequestJson(req: RequestWithBody): Promise<unknown> {
  const preset = req.body
  if (Buffer.isBuffer(preset)) {
    const text = preset.toString('utf8').trim()
    return text ? JSON.parse(text) : {}
  }
  if (typeof preset === 'string') {
    const text = preset.trim()
    return text ? JSON.parse(text) : {}
  }
  if (preset && typeof preset === 'object') return preset
  const text = (await readBody(req)).trim()
  return text ? JSON.parse(text) : {}
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

async function caller(req: IncomingMessage, admin: SupabaseClient) {
  const env = serverEnv()
  if (!env) return { error: 'Faltan SUPABASE_URL, la clave anónima o SUPABASE_SERVICE_ROLE_KEY en el servidor' }
  const header = req.headers.authorization ?? ''
  const jwt = header.replace(/^Bearer\s+/i, '')
  if (!jwt) return { error: 'No hay sesión' }
  const userClient = serverClient(env.url, env.anon, { Authorization: `Bearer ${jwt}` })
  const { data, error } = await userClient.auth.getUser()
  if (error || !data.user) return { error: 'La sesión no es válida' }
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, display_name, email, role_id, active, overrides')
    .eq('id', data.user.id)
    .maybeSingle()
  if (profileError || !profile) return { error: 'No hay perfil para esta cuenta' }
  const row = profile as Profile
  if (!row.active) return { error: 'Esta cuenta está inactiva' }
  const { data: grants, error: grantsError } = await admin.from('role_permissions').select('permission').eq('role_id', row.role_id)
  if (grantsError) return { error: grantsError.message }
  const { data: role } = await admin.from('roles').select('name').eq('id', row.role_id).maybeSingle()
  const permissions = effectivePermissions(
    row.role_id,
    (grants ?? []).map((item) => item.permission as string),
    row.overrides,
    row.active,
  )
  const access: Access = {
    roleId: row.role_id,
    roleName: (role?.name as string) || row.role_id,
    active: row.active,
    permissions,
  }
  return { userId: row.id, name: row.display_name, access }
}

function redactData(value: unknown, access: Access): unknown {
  if (!access.permissions.includes('products.costs')) {
    if (Array.isArray(value)) return value.map((item) => redactData(item, access))
    if (value && typeof value === 'object') {
      const copy: Record<string, unknown> = { ...(value as Record<string, unknown>) }
      if (typeof copy.cost === 'number') copy.cost = 0
      for (const key of Object.keys(copy)) {
        if (key === 'cost') continue
        const child = copy[key]
        if (child && typeof child === 'object') copy[key] = redactData(child, access)
      }
      return copy
    }
  }
  return value
}

async function loadState(admin: SupabaseClient) {
  const { data, error } = await admin.rpc('export_book')
  if (error) throw new Error(error.message)
  const { data: meta, error: metaError } = await admin.from('book_meta').select('version').eq('id', 'main').single()
  if (metaError) throw new Error(metaError.message)
  return { state: hydrate(data), version: meta.version as number }
}

async function saveState(admin: SupabaseClient, state: State, expected: number) {
  const { data, error } = await admin.rpc('replace_book', { payload: state, expected })
  if (error) return { ok: false as const, conflict: error.message.toLowerCase().includes('conflict'), message: error.message }
  return { ok: true as const, version: data as number }
}

async function touchSignal(admin: SupabaseClient) {
  const { data } = await admin.from('book_signal').select('version').eq('id', 'main').maybeSingle()
  const version = ((data?.version as number) ?? 0) + 1
  await admin.from('book_signal').upsert({ id: 'main', version })
}

export async function handleBook(req: IncomingMessage, res: ServerResponse) {
  try {
    return await handleBookRequest(req, res)
  } catch (error) {
    return send(res, 500, { ok: false, error: error instanceof Error ? error.message : 'No se pudo guardar' })
  }
}

async function handleBookRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Usa POST' })
  const admin = adminClient()
  if (!admin) return send(res, 500, { ok: false, error: 'El servidor no tiene la clave de Supabase' })
  const who = await caller(req, admin)
  if ('error' in who) return send(res, 401, { ok: false, error: who.error })
  let body: { action?: string; input?: unknown }
  try {
    body = (await readRequestJson(req)) as { action?: string; input?: unknown }
  } catch {
    return send(res, 400, { ok: false, error: 'El cuerpo no es JSON' })
  }
  const action = body.action ?? ''
  const permission = permissionFor(action)
  if (!permission) return send(res, 400, { ok: false, error: 'Esa acción no existe' })
  if (!who.access.permissions.includes(permission)) return send(res, 403, { ok: false, error: 'No tienes permiso para eso' })

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let loaded: { state: State; version: number }
    try {
      loaded = await loadState(admin)
    } catch (error) {
      return send(res, 500, { ok: false, error: error instanceof Error ? error.message : 'No se pudo leer el libro' })
    }
    const result = runAction(loaded.state, action, body.input, { id: who.userId, name: who.name })
    if (!result.ok) return send(res, 400, { ok: false, error: result.error })
    if (!who.access.permissions.includes('products.costs')) {
      const costs = new Map(loaded.state.products.map((product) => [product.id, product.cost]))
      result.data.state = {
        ...result.data.state,
        products: result.data.state.products.map((product) => (costs.has(product.id) ? { ...product, cost: costs.get(product.id) ?? product.cost } : product)),
      }
    }
    const saved = await saveState(admin, result.data.state, loaded.version)
    if (!saved.ok) {
      if (saved.conflict && attempt === 0) continue
      return send(res, saved.conflict ? 409 : 500, { ok: false, error: saved.message, conflict: saved.conflict })
    }
    return send(res, 200, {
      ok: true,
      version: saved.version,
      state: redactState(result.data.state, who.access),
      access: who.access,
      data: redactData(result.data.data, who.access),
    })
  }
  return send(res, 409, { ok: false, error: 'Otro usuario guardó el libro', conflict: true })
}

const ASSIGNABLE = new Set(['administrador', 'trabajador'])

export async function handleUsers(req: IncomingMessage, res: ServerResponse) {
  const admin = adminClient()
  if (!admin) return send(res, 500, { ok: false, error: 'El servidor no tiene la clave de Supabase' })
  const who = await caller(req, admin)
  if ('error' in who) return send(res, 401, { ok: false, error: who.error })
  if (!who.access.permissions.includes('users.manage')) return send(res, 403, { ok: false, error: 'Solo el dueño administra usuarios' })

  if (req.method === 'GET') return send(res, 200, { ok: true, ...(await directory(admin)) })
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Usa POST' })

  let body: Record<string, unknown>
  try {
    body = (await readRequestJson(req)) as Record<string, unknown>
  } catch {
    return send(res, 400, { ok: false, error: 'El cuerpo no es JSON' })
  }
  const action = String(body.action ?? '')
  try {
    if (action === 'create' || action === 'invite') {
      const email = String(body.email ?? '').trim().toLowerCase()
      const name = String(body.name ?? '').trim()
      const roleId = String(body.roleId ?? 'trabajador')
      const password = String(body.password ?? '')
      if (!email.includes('@') || !name) return send(res, 400, { ok: false, error: 'Escribe nombre y correo' })
      if (!ASSIGNABLE.has(roleId)) return send(res, 400, { ok: false, error: 'Ese rol no se puede asignar' })
      if (action === 'create' && password.length < 6) return send(res, 400, { ok: false, error: 'La clave necesita al menos 6 caracteres' })
      const { error: provisionError } = await admin.from('provisions').upsert({ email, role_id: roleId, display_name: name })
      if (provisionError) return send(res, 400, { ok: false, error: provisionError.message })
      const created = action === 'create'
        ? await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: name } })
        : await admin.auth.admin.inviteUserByEmail(email, { data: { display_name: name } })
      if (created.error) {
        await admin.from('provisions').delete().eq('email', email)
        return send(res, 400, { ok: false, error: created.error.message })
      }
    } else if (action === 'role') {
      const userId = String(body.userId ?? '')
      const roleId = String(body.roleId ?? '')
      if (userId === who.userId) return send(res, 400, { ok: false, error: 'No puedes cambiar tu propio rol' })
      if (!ASSIGNABLE.has(roleId)) return send(res, 400, { ok: false, error: 'Ese rol no se puede asignar' })
      const { error } = await admin.from('profiles').update({ role_id: roleId }).eq('id', userId).neq('role_id', 'dueno')
      if (error) return send(res, 400, { ok: false, error: error.message })
    } else if (action === 'active') {
      const userId = String(body.userId ?? '')
      const active = Boolean(body.active)
      if (userId === who.userId) return send(res, 400, { ok: false, error: 'No puedes desactivarte' })
      const { data: target } = await admin.from('profiles').select('role_id').eq('id', userId).maybeSingle()
      if (target?.role_id === 'dueno') return send(res, 400, { ok: false, error: 'No puedes desactivar al dueño' })
      const { error } = await admin.from('profiles').update({ active }).eq('id', userId)
      if (error) return send(res, 400, { ok: false, error: error.message })
      const banned = await admin.auth.admin.updateUserById(userId, { ban_duration: active ? 'none' : '876000h' })
      if (banned.error) return send(res, 400, { ok: false, error: banned.error.message })
    } else if (action === 'reset') {
      const userId = String(body.userId ?? '')
      const password = String(body.password ?? '')
      if (userId === who.userId) return send(res, 400, { ok: false, error: 'Pide el cambio de tu clave desde el correo de acceso' })
      if (password.length < 6) return send(res, 400, { ok: false, error: 'La clave necesita al menos 6 caracteres' })
      const updated = await admin.auth.admin.updateUserById(userId, { password })
      if (updated.error) return send(res, 400, { ok: false, error: updated.error.message })
    } else if (action === 'roleGrants') {
      const roleId = String(body.roleId ?? '')
      const grants = Array.isArray(body.grants) ? body.grants.map(String) : []
      if (roleId === 'dueno') return send(res, 400, { ok: false, error: 'El dueño siempre tiene todos los permisos' })
      if (!ASSIGNABLE.has(roleId)) return send(res, 400, { ok: false, error: 'Ese rol no se puede editar' })
      const { data: catalog, error: catalogError } = await admin.from('permission_catalog').select('id')
      if (catalogError) return send(res, 400, { ok: false, error: catalogError.message })
      const known = new Set((catalog ?? []).map((item) => item.id as string))
      const clean = [...new Set(grants.filter((id) => known.has(id)))]
      const removed = await admin.from('role_permissions').delete().eq('role_id', roleId)
      if (removed.error) return send(res, 400, { ok: false, error: removed.error.message })
      if (clean.length) {
        const inserted = await admin.from('role_permissions').insert(clean.map((permission) => ({ role_id: roleId, permission })))
        if (inserted.error) return send(res, 400, { ok: false, error: inserted.error.message })
      }
    } else if (action === 'overrides') {
      const userId = String(body.userId ?? '')
      if (userId === who.userId) return send(res, 400, { ok: false, error: 'No puedes cambiar tus propios permisos' })
      const { data: target } = await admin.from('profiles').select('role_id').eq('id', userId).maybeSingle()
      if (!target) return send(res, 404, { ok: false, error: 'No está esa persona' })
      if (target.role_id === 'dueno') return send(res, 400, { ok: false, error: 'El dueño no se limita' })
      const { data: catalog } = await admin.from('permission_catalog').select('id')
      const known = new Set((catalog ?? []).map((item) => item.id as string))
      const overrides: Record<string, boolean> = {}
      const source = body.overrides && typeof body.overrides === 'object' ? (body.overrides as Record<string, unknown>) : {}
      for (const [key, value] of Object.entries(source)) {
        if (known.has(key) && typeof value === 'boolean') overrides[key] = value
      }
      const { error } = await admin.from('profiles').update({ overrides }).eq('id', userId)
      if (error) return send(res, 400, { ok: false, error: error.message })
    } else {
      return send(res, 400, { ok: false, error: 'Esa acción no existe' })
    }
  } catch (error) {
    return send(res, 500, { ok: false, error: error instanceof Error ? error.message : 'No se pudo guardar' })
  }
  await touchSignal(admin)
  return send(res, 200, { ok: true, ...(await directory(admin)) })
}

async function directory(admin: SupabaseClient) {
  const [{ data: users }, { data: roles }, { data: grants }, { data: catalog }] = await Promise.all([
    admin.from('profiles').select('id, display_name, email, role_id, active, overrides, created_at').order('created_at'),
    admin.from('roles').select('id, name, locked').order('id'),
    admin.from('role_permissions').select('role_id, permission'),
    admin.from('permission_catalog').select('id, label, grp, sort').order('sort'),
  ])
  const byRole = new Map<string, string[]>()
  for (const grant of grants ?? []) {
    const list = byRole.get(grant.role_id as string) ?? []
    list.push(grant.permission as string)
    byRole.set(grant.role_id as string, list)
  }
  return {
    users: users ?? [],
    roles: (roles ?? []).map((role) => ({ ...role, permissions: byRole.get(role.id as string) ?? [] })),
    catalog: catalog ?? [],
  }
}
