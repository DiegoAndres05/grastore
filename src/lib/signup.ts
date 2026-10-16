export type SignupCheck =
  | { status: 'open' }
  | { status: 'closed' }
  | { status: 'error'; message: string }

export function interpretSignup(data: unknown, errorMessage?: string | null): SignupCheck {
  if (errorMessage) return { status: 'error', message: errorMessage }
  if (data === true) return { status: 'open' }
  if (data === false) return { status: 'closed' }
  return { status: 'error', message: 'La consulta no dijo si el registro está abierto.' }
}
