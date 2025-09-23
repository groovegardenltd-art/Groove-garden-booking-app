import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthHeaders, clearAuthState } from "./auth";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const authHeaders = getAuthHeaders();
  const headers = {
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...authHeaders,
  };

  // Only log in development
  if (import.meta.env.DEV) {
    console.log(`Making ${method} request to ${url} with auth headers:`, authHeaders);
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    console.error(`API request failed: ${res.status} ${res.statusText}`);
    
    // Handle authentication errors by clearing invalid session
    // BUT NOT for login/register requests - they're expected to fail initially
    if (res.status === 401 && !url.includes('/login') && !url.includes('/register')) {
      console.log("Clearing expired session and redirecting to login");
      clearAuthState();
      window.location.href = "/login";
      return res;
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      headers: getAuthHeaders(),
      credentials: "include",
    });

    if (res.status === 401) {
      if (import.meta.env.DEV) {
        console.log("Query failed due to invalid session, clearing auth state");
      }
      // Add small delay to prevent clearing auth state immediately after login
      setTimeout(() => {
        clearAuthState();
        if (unauthorizedBehavior !== "returnNull") {
          window.location.href = "/login";
        }
      }, 100); // 100ms delay
      
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes instead of Infinity
      gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
      retry: 1, // Retry once on failure
    },
    mutations: {
      retry: false,
    },
  },
});
