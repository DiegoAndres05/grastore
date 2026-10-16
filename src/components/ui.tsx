import { Search, X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'

export const inputClass =
  'w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none transition placeholder:text-muted/70 focus:border-ink'

export const thClass = 'pb-3 pr-4 text-left text-[11px] font-medium tracking-[0.16em] uppercase text-muted'
export const tdClass = 'border-t border-line py-3.5 pr-4 align-middle'

const buttonStyles = {
  solid: 'bg-brass font-semibold text-espresso hover:bg-white',
  ghost: 'border border-line bg-card text-ink hover:border-ink/30',
  quiet: 'text-muted hover:text-ink',
}

export function Button({
  variant = 'solid',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonStyles }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm transition duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 ${buttonStyles[variant]} ${className}`}
      {...props}
    />
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] tracking-[0.16em] text-muted uppercase">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-warn">{hint}</span> : null}
    </label>
  )
}

export function MoneyInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <input
      inputMode="numeric"
      className={inputClass}
      value={new Intl.NumberFormat('es-CO').format(value)}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => onChange(Number(event.target.value.replace(/\D/g, '')) || 0)}
    />
  )
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" size={16} />
      <input
        className={`${inputClass} pl-9`}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

export function PageHeader({
  kicker,
  title,
  text,
  action,
}: {
  kicker: string
  title: string
  text?: string
  action?: ReactNode
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] tracking-[0.22em] text-muted uppercase">{kicker}</p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">{title}</h1>
        {text ? <p className="mt-2 max-w-xl text-sm text-muted">{text}</p> : null}
      </div>
      {action}
    </header>
  )
}

export function Badge({ children, tone }: { children: ReactNode; tone: 'ok' | 'warn' | 'danger' | 'ink' }) {
  const tones = {
    ok: 'bg-ok/10 text-ok',
    warn: 'bg-warn/10 text-warn',
    danger: 'bg-danger/10 text-danger',
    ink: 'bg-ink/5 text-ink',
  }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] tracking-wide ${tones[tone]}`}>{children}</span>
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
      <p className="font-serif text-2xl">{title}</p>
      <p className="mt-2 text-sm text-muted">{text}</p>
    </div>
  )
}

export function AccountSelect({
  value,
  onChange,
  accounts,
  allowEmpty = false,
  emptyLabel = 'Queda por pagar',
}: {
  value: string
  onChange: (value: string) => void
  accounts: { id: string; name: string; active: boolean }[]
  allowEmpty?: boolean
  emptyLabel?: string
}) {
  return (
    <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
      {allowEmpty ? <option value="">{emptyLabel}</option> : null}
      {accounts.filter((account) => account.active).map((account) => (
        <option key={account.id} value={account.id}>{account.name}</option>
      ))}
    </select>
  )
}

export function FormError({ children }: { children?: string }) {
  if (!children) return null
  return <p className="text-sm text-danger">{children}</p>
}

export function Modal({
  open,
  kicker,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean
  kicker: string
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6">
      <button type="button" className="modal-scrim absolute inset-0 bg-espresso/60 backdrop-blur-[3px]" aria-label="Cerrar" onClick={onClose} />
      <div className={`modal-panel relative max-h-[92vh] w-full overflow-auto rounded-3xl border border-line bg-card p-6 shadow-2xl sm:p-8 ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.2em] text-muted uppercase">{kicker}</p>
            <h2 className="mt-2 font-serif text-3xl tracking-tight">{title}</h2>
          </div>
          <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full border border-line" aria-label="Cerrar" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
