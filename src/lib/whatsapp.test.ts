import { describe, expect, it } from 'vitest'
import { debtReminder, reminderLink, whatsappNumber } from './whatsapp'

describe('recordatorio por WhatsApp', () => {
  it('pone el indicativo de Colombia a un celular de diez dígitos', () => {
    expect(whatsappNumber('310 482 1190')).toBe('573104821190')
    expect(whatsappNumber('+57 310-482-1190')).toBe('573104821190')
    expect(whatsappNumber('')).toBeNull()
    expect(whatsappNumber('6051234')).toBeNull()
  })

  it('arma el mensaje con la deuda del cliente', () => {
    const text = debtReminder(40_000)
    expect(text).toContain('La Grasita Store')
    expect(text).toContain('40.000')
    const link = reminderLink('3104821190', 40_000)
    expect(link?.startsWith('https://wa.me/573104821190?text=')).toBe(true)
    expect(decodeURIComponent(link!.split('text=')[1])).toBe(text)
  })
})
