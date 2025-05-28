import { User } from "@shared/schema";

interface AuthState {
  user: User | null;
  sessionId: string | null;
}

const AUTH_STORAGE_KEY = "groove_garden_studios_auth";

export function getAuthState(): AuthState {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to parse auth state:", error);
  }
  return { user: null, sessionId: null };
}

export function setAuthState(state: AuthState): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
}

export function clearAuthState(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getAuthHeaders(): Record<string, string> {
  const { sessionId } = getAuthState();
  if (sessionId) {
    return { Authorization: `Bearer ${sessionId}` };
  }
  return {};
}
