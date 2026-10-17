import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleBook } from '../src/server/http'

export default async function book(req: IncomingMessage, res: ServerResponse) {
  try {
    await handleBook(req, res)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo guardar'
    res.statusCode = 500
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: message }))
  }
}
