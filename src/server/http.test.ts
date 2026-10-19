import { Readable } from 'node:stream'
import type { IncomingMessage } from 'node:http'
import { describe, expect, it } from 'vitest'
import { readRequestJson } from './http'

function parsedRequest(body: unknown) {
  const stream = new Readable({
    read() {
      this.destroy(new Error('el stream no se debe leer'))
    },
  })
  const req = stream as IncomingMessage & { body?: unknown }
  req.body = body
  return req
}

describe('cuerpo de /api/book', () => {
  it('usa el JSON que el servidor ya parseó', async () => {
    const body = await readRequestJson(parsedRequest({ action: 'checkout', input: { total: 1 } }))
    expect(body).toEqual({ action: 'checkout', input: { total: 1 } })
  })

  it('acepta el cuerpo como texto', async () => {
    const body = await readRequestJson(parsedRequest('{"action":"expense","input":{}}'))
    expect(body).toEqual({ action: 'expense', input: {} })
  })

  it('lee el stream cuando nadie parseó el cuerpo', async () => {
    const req = Readable.from([Buffer.from('{"action":"transfer"}')]) as IncomingMessage
    const body = await readRequestJson(req)
    expect(body).toEqual({ action: 'transfer' })
  })
})
