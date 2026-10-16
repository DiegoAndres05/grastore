import { useEffect, useState } from 'react'
import { usersRequest } from '../lib/cloud'
import { useStore } from '../store'
import { Button, Field, FormError, PageHeader, inputClass } from '../components/ui'

type Person = {
  id: string
  display_name: string
  email: string | null
  role_id: string
  active: boolean
  overrides: Record<string, boolean> | null
}

type RoleRow = { id: string; name: string; locked: boolean; permissions: string[] }
type CatalogItem = { id: string; label: string; grp: string; sort: number }

export function UsersPage() {
  const { toast, actor, mode } = useStore()
  const [users, setUsers] = useState<Person[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId] = useState('trabajador')
  const [matrixRole, setMatrixRole] = useState('trabajador')
  const [grants, setGrants] = useState<string[]>([])
  const [personId, setPersonId] = useState('')
  const [overrides, setOverrides] = useState<Record<string, boolean | 'inherit'>>({})
  const [resetPassword, setResetPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function applyDirectory(body: { users?: unknown; roles?: unknown; catalog?: unknown }) {
    const nextUsers = (body.users as Person[]) ?? []
    const nextRoles = (body.roles as RoleRow[]) ?? []
    setUsers(nextUsers)
    setRoles(nextRoles)
    setCatalog((body.catalog as CatalogItem[]) ?? [])
    const role = nextRoles.find((item) => item.id === matrixRole) ?? nextRoles.find((item) => item.id === 'trabajador')
    if (role) {
      setMatrixRole(role.id)
      setGrants(role.permissions)
    }
    if (!personId && nextUsers[0]) setPersonId(nextUsers[0].id)
  }

  useEffect(() => {
    if (mode === 'local') return
    void usersRequest('GET').then((result) => {
      if (!result.ok) {
        setError(result.error)
        return
      }
      const nextUsers = (result.users as Person[]) ?? []
      const nextRoles = (result.roles as RoleRow[]) ?? []
      setUsers(nextUsers)
      setRoles(nextRoles)
      setCatalog((result.catalog as CatalogItem[]) ?? [])
      const role = nextRoles.find((item) => item.id === 'trabajador') ?? nextRoles[0]
      if (role) {
        setMatrixRole(role.id)
        setGrants(role.permissions)
      }
      setPersonId((current) => current || nextUsers[0]?.id || '')
    })
  }, [mode])

  async function send(input: Record<string, unknown>, ok: string) {
    setBusy(true)
    setError('')
    const result = await usersRequest('POST', input)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    applyDirectory(result)
    toast(ok)
  }

  const editableRoles = roles.filter((role) => role.id !== 'dueno')
  const selected = users.find((user) => user.id === personId)

  if (mode === 'local') {
    return (
      <div>
        <PageHeader kicker="Acceso" title="Usuarios" text="En este navegador entras como dueño y el libro no se comparte. Cuando el proyecto tenga Supabase y la clave de servicio en el servidor, aquí se crean trabajadores y administradores." />
      </div>
    )
  }

  return (
    <div>
      <PageHeader kicker="Acceso" title="Usuarios" text="El dueño crea las cuentas y decide qué puede hacer cada rol. Un trabajador no ve costos, caja ni contabilidad, y el servidor lo impide aunque conozca la dirección." />
      <FormError>{error}</FormError>
      <section className="mt-6 rounded-3xl border border-line p-5">
        <h2 className="font-serif text-2xl">Nueva persona</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Nombre"><input className={inputClass} value={name} placeholder="Nombre de quien vende" onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="Correo"><input className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
          <Field label="Rol">
            <select className={inputClass} value={roleId} onChange={(event) => setRoleId(event.target.value)}>
              {editableRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
          </Field>
          <Field label="Clave inicial"><input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void send({ action: 'create', name, email, password, roleId }, 'Cuenta creada').then(() => { setPassword(''); setEmail(''); setName('') })}>Crear con clave</Button>
          <Button variant="ghost" disabled={busy} onClick={() => void send({ action: 'invite', name, email, roleId }, 'Invitación enviada')}>Enviar invitación</Button>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 font-serif text-2xl">Quién entra</h2>
        <ul className="space-y-3">
          {users.map((user) => (
            <li key={user.id} className="rounded-2xl border border-line bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p>{user.display_name}{user.id === actor.id ? ' · tú' : ''}</p>
                  <p className="mt-1 text-xs text-muted">{user.email} · {user.active ? 'Activa' : 'Inactiva'}</p>
                </div>
                {user.role_id === 'dueno' ? <p className="text-sm text-muted">Dueño</p> : (
                  <div className="flex flex-wrap gap-2">
                    <select className={inputClass} value={user.role_id} onChange={(event) => void send({ action: 'role', userId: user.id, roleId: event.target.value }, 'Rol actualizado')}>
                      {editableRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                    </select>
                    <Button variant="ghost" onClick={() => void send({ action: 'active', userId: user.id, active: !user.active }, user.active ? 'Acceso suspendido' : 'Acceso reactivado')}>{user.active ? 'Desactivar' : 'Activar'}</Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Nueva clave">
            <input className={inputClass} type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} />
          </Field>
          <Field label="Para">
            <select className={inputClass} value={personId} onChange={(event) => setPersonId(event.target.value)}>
              {users.filter((user) => user.id !== actor.id).map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}
            </select>
          </Field>
          <Button variant="ghost" disabled={busy} onClick={() => void send({ action: 'reset', userId: personId, password: resetPassword }, 'Clave actualizada').then(() => setResetPassword(''))}>Cambiar clave</Button>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-line p-5">
        <h2 className="font-serif text-2xl">Qué puede cada rol</h2>
        <p className="mt-2 text-sm text-muted">El dueño siempre puede todo. Aquí se ajusta Administrador y Trabajador. Un permiso marcado solo en una persona queda por encima del rol.</p>
        <select className={`${inputClass} mt-4 max-w-xs`} value={matrixRole} onChange={(event) => {
          const next = event.target.value
          setMatrixRole(next)
          setGrants(roles.find((role) => role.id === next)?.permissions ?? [])
        }}>
          {editableRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
        </select>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {catalog.map((item) => (
            <label key={item.id} className="flex items-start gap-3 rounded-xl border border-line px-3 py-2 text-sm">
              <input type="checkbox" className="mt-1" checked={grants.includes(item.id)} onChange={(event) => setGrants((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />
              <span><span className="block text-[11px] tracking-[0.14em] text-muted uppercase">{item.grp}</span>{item.label}</span>
            </label>
          ))}
        </div>
        <Button className="mt-4" disabled={busy} onClick={() => void send({ action: 'roleGrants', roleId: matrixRole, grants }, 'Permisos del rol guardados')}>Guardar rol</Button>
      </section>

      {selected && selected.role_id !== 'dueno' ? (
        <section className="mt-6 rounded-3xl border border-line p-5">
          <h2 className="font-serif text-2xl">Permisos de {selected.display_name}</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {catalog.map((item) => {
              const current = overrides[item.id] ?? (selected.overrides && item.id in selected.overrides ? selected.overrides[item.id] : 'inherit')
              return (
                <label key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-sm">
                  <span>{item.label}</span>
                  <select className="rounded-lg border border-line bg-paper px-2 py-1" value={String(current)} onChange={(event) => {
                    const value = event.target.value
                    setOverrides((map) => ({ ...map, [item.id]: value === 'inherit' ? 'inherit' : value === 'true' }))
                  }}>
                    <option value="inherit">Como el rol</option>
                    <option value="true">Permitir</option>
                    <option value="false">Quitar</option>
                  </select>
                </label>
              )
            })}
          </div>
          <Button className="mt-4" variant="ghost" disabled={busy} onClick={() => {
            const payload: Record<string, boolean> = {}
            for (const item of catalog) {
              const current = overrides[item.id] ?? (selected.overrides && item.id in selected.overrides ? selected.overrides[item.id] : 'inherit')
              if (typeof current === 'boolean') payload[item.id] = current
            }
            void send({ action: 'overrides', userId: selected.id, overrides: payload }, 'Permisos de la persona guardados')
          }}>Guardar persona</Button>
        </section>
      ) : null}
    </div>
  )
}
