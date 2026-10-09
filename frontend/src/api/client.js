const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "http://localhost:8000";


const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";


export function getAccessToken() {
  return localStorage.getItem(
    ACCESS_TOKEN_KEY,
  );
}


export function getRefreshToken() {
  return localStorage.getItem(
    REFRESH_TOKEN_KEY,
  );
}


export function setTokens({
  access,
  refresh,
}) {
  if (access) {
    localStorage.setItem(
      ACCESS_TOKEN_KEY,
      access,
    );
  }

  if (refresh) {
    localStorage.setItem(
      REFRESH_TOKEN_KEY,
      refresh,
    );
  }
}


export function clearTokens() {
  localStorage.removeItem(
    ACCESS_TOKEN_KEY,
  );

  localStorage.removeItem(
    REFRESH_TOKEN_KEY,
  );
}


export async function refreshTokens() {
  const refresh = getRefreshToken();

  if (!refresh) {
    return false;
  }

  const response = await fetch(
    `${API_BASE_URL}/api/auth/refresh/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh,
      }),
    },
  );

  if (!response.ok) {
    clearTokens();
    return false;
  }

  const data = await response.json();

  setTokens({
    access: data.access,
    refresh: data.refresh ?? refresh,
  });

  return true;
}


export async function apiRequest(
  path,
  {
    method = "GET",
    body = null,
    headers = {},
    skipAuth = false,
  } = {},
  allowRefresh = true,
) {
  const requestHeaders = new Headers(
    headers,
  );

  let requestBody = body;

  if (
    body !== null &&
    !(body instanceof FormData)
  ) {
    requestHeaders.set(
      "Content-Type",
      "application/json",
    );

    requestBody = JSON.stringify(
      body,
    );
  }

  if (!skipAuth) {
    const access = getAccessToken();

    if (access) {
      requestHeaders.set(
        "Authorization",
        `Bearer ${access}`,
      );
    }
  }

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      method,
      headers: requestHeaders,
      body: requestBody,
    },
  );

  if (
    response.status === 401 &&
    !skipAuth &&
    allowRefresh &&
    getRefreshToken()
  ) {
    const refreshed =
      await refreshTokens();

    if (refreshed) {
      return apiRequest(
        path,
        {
          method,
          body,
          headers,
          skipAuth,
        },
        false,
      );
    }
  }

  return response;
}


export async function readApiError(
  response,
  fallbackMessage,
) {
  try {
    const data = await response.json();

    if (
      typeof data.detail === "string"
    ) {
      return data.detail;
    }

    const messages = Object.values(data)
      .flat()
      .filter(
        (value) =>
          typeof value === "string",
      );

    if (messages.length > 0) {
      return messages.join(" ");
    }
  } catch {
    return fallbackMessage;
  }

  return fallbackMessage;
}