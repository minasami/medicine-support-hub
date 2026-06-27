export type CustomFetchOptions = RequestInit & {
  responseType?: "json" | "text" | "blob" | "auto";
};

export type ErrorType<T = unknown> = ApiError<T>;
export type BodyType<T> = T;
export type AuthTokenGetter = () => Promise<string | null> | string | null;

let baseUrl: string | null = null;
let authTokenGetter: AuthTokenGetter | null = null;

export function setBaseUrl(url: string | null): void {
  baseUrl = url ? url.replace(/\/+$/, "") : null;
}

export function setAuthTokenGetter(getter: AuthTokenGetter | null): void {
  authTokenGetter = getter;
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function resolveMethod(input: RequestInfo | URL, method?: string): string {
  if (method) return method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.method.toUpperCase();
  }
  return "GET";
}

function absoluteUrl(input: RequestInfo | URL): RequestInfo | URL {
  const url = resolveUrl(input);
  if (!baseUrl || !url.startsWith("/")) return input;
  return `${baseUrl}${url}`;
}

function getSupabaseConfig(): { url: string; key: string } | null {
  const env = (import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  }).env;
  const url = env?.VITE_SUPABASE_URL?.replace(/\/+$/, "");
  const key = env?.VITE_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

function relativePath(input: RequestInfo | URL): string {
  const raw = resolveUrl(input);
  try {
    return new URL(raw, "https://local.invalid").pathname;
  } catch {
    return raw.split("?", 1)[0];
  }
}

function queryParams(input: RequestInfo | URL): URLSearchParams {
  const raw = resolveUrl(input);
  try {
    return new URL(raw, "https://local.invalid").searchParams;
  } catch {
    return new URLSearchParams(raw.split("?", 2)[1] ?? "");
  }
}

async function supabaseFetch<T>(
  input: RequestInfo | URL,
  options: CustomFetchOptions,
): Promise<T | undefined> {
  const config = getSupabaseConfig();
  if (!config) return undefined;

  const method = resolveMethod(input, options.method);
  const path = relativePath(input);
  const headers = new Headers(options.headers);
  headers.set("apikey", config.key);
  headers.set("Authorization", `Bearer ${config.key}`);
  headers.set("Accept", "application/json");

  let target: string | null = null;
  const body = options.body;

  if (method === "GET" && path === "/api/medicines") {
    const params = queryParams(input);
    const search = (params.get("search") ?? "").trim();
    const requestedLimit = Number(params.get("limit") ?? "20");
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 50)
      : 20;

    const rest = new URL(`${config.url}/rest/v1/medicines`);
    rest.searchParams.set(
      "select",
      "id,name_en,name_ar,dosage_form,strength,category",
    );
    rest.searchParams.set("is_active", "eq.true");
    rest.searchParams.set("order", "name_en.asc");
    rest.searchParams.set("limit", String(limit));

    if (search) {
      const safeSearch = search.replace(/[(),]/g, " ").trim();
      rest.searchParams.set(
        "or",
        `(name_en.ilike.*${safeSearch}*,name_ar.ilike.*${safeSearch}*)`,
      );
    }

    target = rest.toString();
  }

  if (method === "POST" && path === "/api/requests") {
    target = `${config.url}/functions/v1/submit-medicine-request`;
    headers.set("Content-Type", "application/json");
  }

  if (!target) return undefined;

  const response = await fetch(target, {
    ...options,
    method,
    headers,
    body,
  });

  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    throw new ApiError(response, data, { method, url: target });
  }

  if (method === "POST" && path === "/api/requests" && Array.isArray(data)) {
    return data[0] as T;
  }

  return data as T;
}

function getMessage(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  for (const key of ["message", "detail", "error_description", "error"]) {
    if (typeof record[key] === "string" && record[key]) return record[key];
  }
  return undefined;
}

export class ApiError<T = unknown> extends Error {
  readonly name = "ApiError";
  readonly status: number;
  readonly statusText: string;
  readonly data: T | null;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;

  constructor(
    response: Response,
    data: T | null,
    requestInfo: { method: string; url: string },
  ) {
    super(
      `HTTP ${response.status} ${response.statusText}${
        getMessage(data) ? `: ${getMessage(data)}` : ""
      }`,
    );
    Object.setPrototypeOf(this, new.target.prototype);
    this.status = response.status;
    this.statusText = response.statusText;
    this.data = data;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
  }
}

export class ResponseParseError extends Error {
  readonly name = "ResponseParseError";
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

async function parseResponse<T>(
  response: Response,
  responseType: CustomFetchOptions["responseType"],
  method: string,
  url: string,
): Promise<T> {
  if (method === "HEAD" || [204, 205, 304].includes(response.status)) {
    return undefined as T;
  }

  const type = responseType ?? "auto";
  const contentType = response.headers.get("content-type") ?? "";

  try {
    if (type === "blob") return (await response.blob()) as T;
    if (type === "text") return (await response.text()) as T;
    if (type === "json" || contentType.includes("json")) {
      return (await response.json()) as T;
    }

    const text = await response.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  } catch (cause) {
    throw new ResponseParseError(
      `Failed to parse response from ${method} ${url}: ${String(cause)}`,
    );
  }
}

export async function customFetch<T = unknown>(
  input: RequestInfo | URL,
  options: CustomFetchOptions = {},
): Promise<T> {
  const supabaseResult = await supabaseFetch<T>(input, options);
  if (supabaseResult !== undefined) return supabaseResult;

  const resolvedInput = absoluteUrl(input);
  const method = resolveMethod(resolvedInput, options.method);
  const headers = new Headers(options.headers);

  if (authTokenGetter && !headers.has("authorization")) {
    const token = await authTokenGetter();
    if (token) headers.set("authorization", `Bearer ${token}`);
  }

  if (
    typeof options.body === "string" &&
    !headers.has("content-type") &&
    /^[\s]*[\[{]/.test(options.body)
  ) {
    headers.set("content-type", "application/json");
  }

  const url = resolveUrl(resolvedInput);
  const response = await fetch(resolvedInput, {
    ...options,
    method,
    headers,
  });

  if (!response.ok) {
    let errorData: unknown = null;
    try {
      errorData = await response.clone().json();
    } catch {
      errorData = await response.text();
    }
    throw new ApiError(response, errorData, { method, url });
  }

  return parseResponse<T>(response, options.responseType, method, url);
}
