import {
  getAccessToken,
  refreshTokens,
} from "../api/client";


function getWebSocketBaseUrl() {
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL ??
    "http://localhost:8000";

  const url = new URL(apiBaseUrl);

  url.protocol =
    url.protocol === "https:"
      ? "wss:"
      : "ws:";

  return url.origin;
}


export async function createChannelSocket(
  channelId,
) {
  let accessToken =
    getAccessToken();

  if (!accessToken) {
    const refreshed =
      await refreshTokens();

    if (!refreshed) {
      throw new Error(
        "Authentication is required.",
      );
    }

    accessToken =
      getAccessToken();
  }

  const baseUrl =
    getWebSocketBaseUrl();

  return new WebSocket(
    `${baseUrl}/ws/channels/${channelId}/`,
    [
      `jwt.${accessToken}`,
    ],
  );
}