import { useEffect, useRef, useState } from 'react'
import { money } from '../lib/format'

export function CountUp({ value, kind = 'money' }: { value: number; kind?: 'money' | 'int' }) {
  const [shown, setShown] = useState(0)
  const from = useRef(0)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      from.current = value
      setShown(value)
      return
    }
    const origin = from.current
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 780)
      const eased = 1 - (1 - t) ** 3
      const next = origin + (value - origin) * eased
      from.current = next
      setShown(next)
      if (t < 1) frame = requestAnimationFrame(tick)
      else from.current = value
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  const rounded = Math.round(shown)
  return kind === 'money' ? money(rounded) : String(rounded)
}

export function Splash({ label, hold = 980, onDone }: { label: string; hold?: number; onDone: () => void }) {
  const [out, setOut] = useState(false)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const wait = hold
    const fade = reduce ? 180 : 460
    const leave = window.setTimeout(() => setOut(true), wait)
    const finish = window.setTimeout(() => done.current(), wait + fade)
    return () => {
      window.clearTimeout(leave)
      window.clearTimeout(finish)
    }
  }, [hold])

  return (
    <div className={`boot ${out ? 'boot-out' : ''}`} role="status" aria-live="polite" aria-label={label}>
      <SplashMark label={label} />
    </div>
  )
}

export function SplashMark({ label }: { label: string }) {
  return (
    <div className="boot-card">
      <div className="boot-lockup">
        <img src="/logo.svg" alt="La Grasita Store" />
      </div>
      <p className="boot-kicker">Cartagena</p>
      <p className="boot-label">{label}</p>
      <div className="boot-track" aria-hidden="true">
        <span />
      </div>
    </div>
  )
}
