import type { IncomingMessage, ServerResponse } from 'node:http'

function fail(res: ServerResponse | undefined, message: string) {
  if (res && typeof res.end === 'function') {
    res.statusCode = 500
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: message }))
    return
  }
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status: 500,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export default async function book(req: IncomingMessage, res?: ServerResponse) {
  try {
    const { handleBook } = await import('../src/server/http')
    await handleBook(req, res as ServerResponse)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo guardar'
    return fail(res, message)
  }
}
