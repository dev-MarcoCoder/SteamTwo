const DEFAULT_TIMEOUT_MS = 12_000;

export class ExternalServiceError extends Error {
  constructor(message, { service, status, cause } = {}) {
    super(message, { cause });
    this.name = "ExternalServiceError";
    this.service = service;
    this.status = status;
  }
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Fetches an external endpoint with a bounded timeout and a small exponential
 * retry. The caller can inject fetch for deterministic tests.
 */
export async function requestExternal(url, options = {}) {
  const {
    service = "external",
    fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 2,
    retryDelayMs = 150,
    parse = "json",
    ...requestOptions
  } = options;

  if (typeof fetchImpl !== "function") {
    throw new ExternalServiceError("fetch não está disponível", { service });
  }

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { ...requestOptions, signal: controller.signal });
      if (!response.ok) {
        const error = new ExternalServiceError(`Resposta HTTP ${response.status}`, {
          service,
          status: response.status,
        });
        // Client errors are deterministic and should not be retried.
        if (response.status < 500 && response.status !== 429) throw error;
        throw error;
      }
      return parse === "text" ? response.text() : response.json();
    } catch (error) {
      lastError = error instanceof ExternalServiceError
        ? error
        : new ExternalServiceError("Não foi possível consultar a fonte externa", { service, cause: error });
      const retryable = !lastError.status || lastError.status >= 500 || lastError.status === 429;
      if (!retryable || attempt === retries) break;
      await wait(retryDelayMs * (2 ** attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

export const requestJson = (url, options) => requestExternal(url, { ...options, parse: "json" });
export const requestText = (url, options) => requestExternal(url, { ...options, parse: "text" });
