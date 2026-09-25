import type { AuthMode } from "./authTypes";

export function getOAuthErrorMessage(code: string | null): string;

/**
 * Returns the auth mode that must be reopened after a Google OAuth error, or
 * null when there is nothing to recover from.
 */
export function getOAuthErrorAuthMode(code: string | null): AuthMode | null;
