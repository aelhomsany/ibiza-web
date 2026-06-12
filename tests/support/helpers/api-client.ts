import type { APIRequestContext } from '@playwright/test'

const defaultApiUrl = process.env.API_URL ?? process.env.VITE_API_URL ?? 'http://localhost:8080'

export type ApiRequestParams = {
  request: APIRequestContext
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  data?: unknown
  token?: string
  apiUrl?: string
}

export async function apiRequest<T = unknown>({
  request,
  method,
  path,
  data,
  token,
  apiUrl = defaultApiUrl,
}: ApiRequestParams): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Correlation-Id': crypto.randomUUID(),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await request.fetch(`${apiUrl}${path}`, {
    method,
    data: data === undefined ? undefined : JSON.stringify(data),
    headers,
  })

  if (!response.ok()) {
    throw new Error(`API ${method} ${path} failed: ${response.status()} ${await response.text()}`)
  }

  if (response.status() === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}
