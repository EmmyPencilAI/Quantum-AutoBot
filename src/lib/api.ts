/**
 * Authenticated API utility
 *
 * All requests to protected backend endpoints must include a Firebase ID token
 * in the Authorization header. This utility wraps fetch() to do that automatically
 * using the currently signed-in Firebase user.
 */

import { auth } from "../firebase";

/**
 * Makes an authenticated HTTP request with the current user's Firebase ID token.
 * Throws if no user is signed in and `requireAuth` is true (default).
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
  requireAuth = true
): Promise<Response> {
  const currentUser = auth.currentUser;

  if (requireAuth && !currentUser) {
    throw new Error("Authentication required: no user is currently signed in.");
  }

  let authHeaders: Record<string, string> = {};

  if (currentUser) {
    try {
      // Force refresh ensures we always use a valid, non-expired token
      const idToken = await currentUser.getIdToken(false);
      authHeaders["Authorization"] = `Bearer ${idToken}`;
    } catch (e: any) {
      throw new Error(`Failed to get auth token: ${e.message}`);
    }
  }

  // If an API URL is specified, prepend it to relative /api/ routes
  const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";
  const finalUrl = url.startsWith("/api/") ? `${baseUrl}${url}` : url;

  return fetch(finalUrl, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      // Allow callers to override any header
      ...(options.headers as Record<string, string> | undefined),
    },
  });
}

/**
 * Convenience wrapper that parses JSON and throws on non-OK responses.
 */
export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {},
  requireAuth = true
): Promise<T> {
  const res = await fetchWithAuth(url, options, requireAuth);

  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      errorMessage = body.error || body.message || errorMessage;
    } catch {
      // If response isn't JSON, use the status text
      errorMessage = `${res.status}: ${res.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return res.json() as Promise<T>;
}
