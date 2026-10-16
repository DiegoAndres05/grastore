import { useEffect, useState } from 'react'
import { supabase } from '../lib/cloud'
import { interpretSignup, type SignupCheck } from '../lib/signup'
import { Button, Field, FormError, inputClass } from '../components/ui'

type SignupView = SignupCheck | { status: 'checking' }

export function Login() {
  const [mode, setMode] = useState<'entrar' | 'crear'>('entrar')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [signup, setSignup] = useState<SignupView>({ status: 'checking' })

  async function refreshSignup() {
    setSignup({ status: 'checking' })
    const db = supabase()
    if (!db) {
      setSignup({ status: 'error', message: 'Este sitio no tiene la configuración de Supabase.' })
      setMode('entrar')
      return
    }
    const { data, error: checkError } = await db.rpc('signup_open')
    const next = interpretSignup(data, checkError?.message)
    setSignup(next)
    setMode(next.status === 'open' ? 'crear' : 'entrar')
  }

  useEffect(() => {
    void refreshSignup()
  }, [])

  useEffect(() => {
    const node = document.getElementById('boot')
    if (!node) {
      document.documentElement.classList.add('ready')
      return
    }
    node.remove()
    document.documentElement.classList.add('ready')
  }, [])

  async function submit() {
    const db = supabase()
    if (!db) return
    setBusy(true)
    setError('')
    setInfo('')
    if (mode === 'crear') {
      const { error: signError } = await db.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: name.trim() || email.trim() } },
      })
      setBusy(false)
      if (signError) {
        setError(signError.message)
        return
      }
      setInfo('Cuenta creada. Si el proyecto pide confirmar el correo, ábrelo y luego entra. Si no, ya quedaste adentro.')
      return
    }
    const { error: signError } = await db.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (signError) setError(signError.message)
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-line bg-card p-6 sm:p-8">
        <img src="/logo.svg" alt="La Grasita Store" className="mx-auto w-40" />
        <p className="mt-4 text-center text-[11px] tracking-[0.22em] text-brass uppercase">Cartagena</p>
        <h1 className="mt-3 text-center font-serif text-3xl">{mode === 'entrar' ? 'Entrar al libro' : 'Crear el acceso del dueño'}</h1>
        <p className="mt-2 text-center text-sm text-muted">
          {signup.status === 'checking'
            ? 'Comprobando si ya hay un dueño…'
            : signup.status === 'open'
              ? 'La primera cuenta queda como dueño del negocio. Después solo esa persona crea trabajadores y administradores.'
              : signup.status === 'closed'
                ? 'El registro público ya está cerrado. Entra con el correo que te dio el dueño.'
                : 'No pude comprobar si el registro está abierto. No asumas que ya hay un dueño.'}
        </p>
        {signup.status === 'error' ? (
          <div className="mt-4 space-y-3">
            <FormError>{signup.message}</FormError>
            <Button className="w-full" variant="ghost" type="button" onClick={() => void refreshSignup()}>Reintentar</Button>
          </div>
        ) : null}
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          {mode === 'crear' ? (
            <Field label="Nombre">
              <input className={inputClass} value={name} placeholder="Tu nombre" onChange={(event) => setName(event.target.value)} />
            </Field>
          ) : null}
          <Field label="Correo">
            <input className={inputClass} type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label="Clave">
            <input className={inputClass} type="password" autoComplete={mode === 'crear' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          <FormError>{error}</FormError>
          {info ? <p className="text-sm text-muted">{info}</p> : null}
          <Button className="w-full" type="submit" disabled={busy || !email || password.length < 6}>
            {busy ? 'Espera…' : mode === 'entrar' ? 'Entrar' : 'Crear cuenta'}
          </Button>
        </form>
        {signup.status === 'open' ? (
          <button type="button" className="mt-4 w-full text-center text-sm text-brass-deep" onClick={() => setMode(mode === 'entrar' ? 'crear' : 'entrar')}>
            {mode === 'entrar' ? 'Crear la cuenta del dueño' : 'Ya tengo cuenta'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
