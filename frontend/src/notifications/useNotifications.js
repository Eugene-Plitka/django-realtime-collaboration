import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  apiRequest,
  readApiError,
  refreshTokens,
} from "../api/client";
import {
  createNotificationSocket,
} from "../chat/socket";


function sortNotifications(
  notifications,
) {
  return [...notifications].sort(
    (first, second) =>
      new Date(second.created_at) -
      new Date(first.created_at),
  );
}


function mergeNotification(
  notifications,
  incomingNotification,
) {
  const existingIndex =
    notifications.findIndex(
      (notification) =>
        notification.id ===
        incomingNotification.id,
    );

  if (existingIndex === -1) {
    return sortNotifications([
      incomingNotification,
      ...notifications,
    ]);
  }

  return sortNotifications(
    notifications.map(
      (notification) =>
        notification.id ===
        incomingNotification.id
          ? {
              ...notification,
              ...incomingNotification,
            }
          : notification,
    ),
  );
}


export function useNotifications() {
  const [
    notifications,
    setNotifications,
  ] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    socketStatus,
    setSocketStatus,
  ] = useState("connecting");

  const socketRef =
    useRef(null);

  const reconnectTimerRef =
    useRef(null);

  const reconnectAllowedRef =
    useRef(true);


  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (notification) =>
          !notification.is_read,
      ).length,
    [notifications],
  );


  const loadNotifications =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const response =
            await apiRequest(
              "/api/notifications/",
            );

          if (!response.ok) {
            throw new Error(
              await readApiError(
                response,
                "Unable to load notifications.",
              ),
            );
          }

          const data =
            await response.json();

          setNotifications(
            sortNotifications(data),
          );
        } catch (requestError) {
          setError(
            requestError.message,
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );


  const connectSocket =
    useCallback(
      async () => {
        if (
          !reconnectAllowedRef.current
        ) {
          return;
        }

        setSocketStatus(
          "connecting",
        );

        let socket;

        try {
          socket =
            await createNotificationSocket();
        } catch (connectionError) {
          setSocketStatus("error");

          setError(
            connectionError.message,
          );

          return;
        }

        if (
          !reconnectAllowedRef.current
        ) {
          socket.close();
          return;
        }

        socketRef.current =
          socket;

        socket.onopen = () => {
          setSocketStatus(
            "connected",
          );
        };

        socket.onmessage = (
          event,
        ) => {
          let payload;

          try {
            payload =
              JSON.parse(
                event.data,
              );
          } catch {
            return;
          }

          if (
            payload.type !==
            "notification.created"
          ) {
            return;
          }

          setNotifications(
            (currentNotifications) =>
              mergeNotification(
                currentNotifications,
                payload.data,
              ),
          );
        };

        socket.onerror = () => {
          setSocketStatus(
            "error",
          );
        };

        socket.onclose =
          async (event) => {
            if (
              socketRef.current ===
              socket
            ) {
              socketRef.current =
                null;
            }

            if (
              !reconnectAllowedRef.current
            ) {
              return;
            }

            if (
              event.code === 4401
            ) {
              const refreshed =
                await refreshTokens();

              if (!refreshed) {
                setSocketStatus(
                  "error",
                );

                setError(
                  "Your session has expired.",
                );

                return;
              }
            }

            setSocketStatus(
              "reconnecting",
            );

            reconnectTimerRef.current =
              window.setTimeout(
                () => {
                  connectSocket();
                },
                1500,
              );
          };
      },
      [],
    );


  useEffect(() => {
    reconnectAllowedRef.current =
      true;

    loadNotifications();
    connectSocket();

    return () => {
      reconnectAllowedRef.current =
        false;

      if (
        reconnectTimerRef.current
      ) {
        window.clearTimeout(
          reconnectTimerRef.current,
        );

        reconnectTimerRef.current =
          null;
      }

      if (socketRef.current) {
        socketRef.current.close();

        socketRef.current =
          null;
      }
    };
  }, [
    connectSocket,
    loadNotifications,
  ]);


  async function markRead(
    notificationId,
  ) {
    const response =
      await apiRequest(
        `/api/notifications/${notificationId}/read/`,
        {
          method: "POST",
        },
      );

    if (!response.ok) {
      throw new Error(
        await readApiError(
          response,
          "Unable to mark notification as read.",
        ),
      );
    }

    const updated =
      await response.json();

    setNotifications(
      (currentNotifications) =>
        mergeNotification(
          currentNotifications,
          updated,
        ),
    );

    return updated;
  }


  async function markUnread(
    notificationId,
  ) {
    const response =
      await apiRequest(
        `/api/notifications/${notificationId}/unread/`,
        {
          method: "POST",
        },
      );

    if (!response.ok) {
      throw new Error(
        await readApiError(
          response,
          "Unable to mark notification as unread.",
        ),
      );
    }

    const updated =
      await response.json();

    setNotifications(
      (currentNotifications) =>
        mergeNotification(
          currentNotifications,
          updated,
        ),
    );

    return updated;
  }


  return {
    notifications,
    unreadCount,
    loading,
    error,
    socketStatus,
    loadNotifications,
    markRead,
    markUnread,
  };
}