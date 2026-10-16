import { describe, expect, it } from 'vitest'
import { interpretSignup } from './signup'

describe('interpretSignup', () => {
  it('opens the owner form only when the check returns true', () => {
    expect(interpretSignup(true)).toEqual({ status: 'open' })
    expect(interpretSignup(false)).toEqual({ status: 'closed' })
  })

  it('does not treat a failed check as a closed registry', () => {
    expect(interpretSignup(null, 'permission denied for function signup_open')).toEqual({
      status: 'error',
      message: 'permission denied for function signup_open',
    })
    expect(interpretSignup(null)).toEqual({
      status: 'error',
      message: 'La consulta no dijo si el registro está abierto.',
    })
    expect(interpretSignup(undefined, 'Could not find the function public.signup_open without parameters in the schema cache')).toEqual({
      status: 'error',
      message: 'Could not find the function public.signup_open without parameters in the schema cache',
    })
  })
})
