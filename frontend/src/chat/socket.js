import {
  getAccessToken,
  refreshTokens,
} from "../api/client";


function getWebSocketBaseUrl() {
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL;

  const url = apiBaseUrl
    ? new URL(apiBaseUrl)
    : new URL(
        window.location.origin,
      );

  url.protocol =
    url.protocol === "https:"
      ? "wss:"
      : "ws:";

  return url.origin;
}


async function getValidAccessToken() {
  let accessToken =
    getAccessToken();

  if (accessToken) {
    return accessToken;
  }

  const refreshed =
    await refreshTokens();

  if (!refreshed) {
    throw new Error(
      "Authentication is required.",
    );
  }

  accessToken =
    getAccessToken();

  if (!accessToken) {
    throw new Error(
      "Authentication is required.",
    );
  }

  return accessToken;
}


async function createAuthenticatedSocket(
  path,
) {
  const accessToken =
    await getValidAccessToken();

  const baseUrl =
    getWebSocketBaseUrl();

  return new WebSocket(
    `${baseUrl}${path}`,
    [
      `jwt.${accessToken}`,
    ],
  );
}


export async function createChannelSocket(
  channelId,
) {
  return createAuthenticatedSocket(
    `/ws/channels/${channelId}/`,
  );
}


export async function createDirectConversationSocket(
  conversationId,
) {
  return createAuthenticatedSocket(
    `/ws/direct-conversations/${conversationId}/`,
  );
}


export async function createNotificationSocket() {
  return createAuthenticatedSocket(
    "/ws/notifications/",
  );
}


export async function createPresenceSocket() {
  return createAuthenticatedSocket(
    "/ws/presence/",
  );
}