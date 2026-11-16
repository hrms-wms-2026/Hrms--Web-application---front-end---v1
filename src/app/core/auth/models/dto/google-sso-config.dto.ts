/** Public, anonymous GET /auth/google-config. Never carries secret material. */
export interface GoogleSsoConfigDto {
  enabled: boolean;
  clientId: string | null;
}
