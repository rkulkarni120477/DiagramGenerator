import type {
  ApiErrorBody,
  DiagramType,
  ProgressSnapshot,
  SessionDetail,
  SessionSummary,
  TurnResponse,
} from "@/lib/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
const REQUEST_TIMEOUT_MS = 120_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === "AbortError";
    throw new ApiError(
      timedOut
        ? "The request timed out. Please try again."
        : "Cannot reach the Diagram Studio API. Check that the backend is running.",
      timedOut ? "client_timeout" : "network_error",
      0,
    );
  } finally {
    clearTimeout(timer);
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as ApiErrorBody | null)?.error;
    throw new ApiError(error?.message ?? `Request failed (${response.status}).`, error?.code ?? "http_error", response.status);
  }
  return body as T;
}

/** Sends a POST. The progress id lets the UI poll the agent's steps while the request runs. */
function post<T>(path: string, data: unknown, progressId: string): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "X-Progress-Id": progressId },
  });
}

export const api = {
  createSession: (diagramType: DiagramType, prompt: string, progressId: string) =>
    post<TurnResponse>("/sessions", { diagram_type: diagramType, prompt }, progressId),

  sendMessage: (sessionId: string, content: string, progressId: string) =>
    post<TurnResponse>(`/sessions/${encodeURIComponent(sessionId)}/messages`, { content }, progressId),

  repair: (sessionId: string, error: string, progressId: string) =>
    post<TurnResponse>(`/sessions/${encodeURIComponent(sessionId)}/repair`, { error }, progressId),

  getProgress: (progressId: string) => request<ProgressSnapshot>(`/progress/${encodeURIComponent(progressId)}`),

  getSession: (sessionId: string) => request<SessionDetail>(`/sessions/${encodeURIComponent(sessionId)}`),

  listSessions: () => request<SessionSummary[]>("/sessions"),
};

/** Random id for one generation request. Falls back where crypto.randomUUID is unavailable. */
export function newProgressId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}
