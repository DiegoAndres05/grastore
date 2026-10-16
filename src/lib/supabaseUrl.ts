export function projectUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '')
  return trimmed.replace(/\/rest\/v1$/i, '').replace(/\/+$/, '')
}
