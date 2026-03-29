const BASE_URL = 'http://localhost:8889/de'

export const IS_MOCK = false
// console.log("import.meta.env.VITE_MOCK_API", import.meta.env.VITE_MOCK_API)

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function randomDelay(min = 300, max = 800): Promise<void> {
  return delay(Math.floor(Math.random() * (max - min) + min))
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token')
  return token ? { 'Tenant-User-Token': token } : {}
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${path}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...(options.headers ?? {}),
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `HTTP ${response.status}`)
  }

  return response.json() as Promise<T>
}
