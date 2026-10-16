import { describe, expect, it } from 'vitest'
import { projectUrl } from './supabaseUrl'

describe('projectUrl', () => {
  it('quita el /rest/v1 que el cliente vuelve a agregar', () => {
    expect(projectUrl('https://ozllzbfmzdfahiefrgpg.supabase.co/rest/v1/')).toBe(
      'https://ozllzbfmzdfahiefrgpg.supabase.co',
    )
    expect(projectUrl('https://ozllzbfmzdfahiefrgpg.supabase.co')).toBe(
      'https://ozllzbfmzdfahiefrgpg.supabase.co',
    )
  })
})
