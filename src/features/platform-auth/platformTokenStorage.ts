let platformAccessToken: string | null = null

export function getPlatformAccessToken(): string | null {
  return platformAccessToken
}

export function setPlatformAccessToken(token: string | null): void {
  platformAccessToken = token
}

export function clearPlatformAccessToken(): void {
  platformAccessToken = null
}
