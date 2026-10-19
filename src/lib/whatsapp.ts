import { money } from './format'

export function whatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10 && digits.startsWith('3')) return `57${digits}`
  if (digits.length === 12 && digits.startsWith('57')) return digits
  return null
}

export function debtReminder(balance: number) {
  return `Buenas, espero te encuentres bien. Te escribimos de parte de La Grasita Store para que no se te olvide cancelar la deuda de ${money(balance)}. ¡Que tengas buen día!`
}

export function reminderLink(phone: string, balance: number) {
  const number = whatsappNumber(phone)
  if (!number) return null
  return `https://wa.me/${number}?text=${encodeURIComponent(debtReminder(balance))}`
}
