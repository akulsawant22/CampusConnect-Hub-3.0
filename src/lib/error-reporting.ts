const MAX_SERIALIZED_LENGTH = 2000;

function describeThrown(error: unknown): string {
  if (typeof Response !== "undefined" && error instanceof Response) {
    return `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`;
  }
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  const message = (error as { message?: unknown } | null)?.message;
  if (typeof message === "string" && message.length > 0) return message;
  try {
    return JSON.stringify(error)?.slice(0, MAX_SERIALIZED_LENGTH) ?? String(error);
  } catch {
    return String(error);
  }
}

export function reportAppError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  console.error("CampusConnect application error", {
    source: "react_error_boundary",
    route: window.location.pathname,
    ...context,
    message: describeThrown(error),
  });
}
