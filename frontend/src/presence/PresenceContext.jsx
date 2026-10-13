import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  refreshTokens,
} from "../api/client";
import {
  useAuth,
} from "../auth/AuthContext";
import {
  createPresenceSocket,
} from "../chat/socket";


const PresenceContext =
  createContext(null);


const VALID_STATUSES =
  new Set([
    "ONLINE",
    "AWAY",
    "DND",
  ]);


export function PresenceProvider({
  children,
}) {
  const {
    user,
  } = useAuth();

  const userId =
    user?.id ?? null;

  const [
    statusByUserId,
    setStatusByUserId,
  ] = useState({});

  const [
    socketStatus,
    setSocketStatus,
  ] = useState(
    "disconnected",
  );

  const socketRef =
    useRef(null);

  const reconnectTimerRef =
    useRef(null);

  const reconnectAllowedRef =
    useRef(false);


  const connectSocket =
    useCallback(
      async () => {
        if (
          !userId ||
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
            await createPresenceSocket();
        } catch {
          setSocketStatus(
            "error",
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
            "presence.status_changed"
          ) {
            return;
          }

          const changedUserId =
            payload.data?.user_id;

          const status =
            payload.data?.status;

          if (
            !Number.isInteger(
              changedUserId,
            ) ||
            !VALID_STATUSES.has(
              status,
            )
          ) {
            return;
          }

          setStatusByUserId(
            (
              currentStatuses,
            ) => ({
              ...currentStatuses,
              [changedUserId]:
                status,
            }),
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
      [
        userId,
      ],
    );


  useEffect(() => {
    setStatusByUserId({});

    if (!userId) {
      setSocketStatus(
        "disconnected",
      );

      return undefined;
    }

    reconnectAllowedRef.current =
      true;

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
    userId,
  ]);


  const getPresenceStatus =
    useCallback(
      (
        targetUserId,
        fallbackStatus = "ONLINE",
      ) =>
        statusByUserId[
          targetUserId
        ] ??
        fallbackStatus ??
        "ONLINE",
      [
        statusByUserId,
      ],
    );


  const value =
    useMemo(
      () => ({
        socketStatus,
        getPresenceStatus,
      }),
      [
        socketStatus,
        getPresenceStatus,
      ],
    );


  return (
    <PresenceContext.Provider
      value={value}
    >
      {children}
    </PresenceContext.Provider>
  );
}


export function usePresence() {
  const context =
    useContext(
      PresenceContext,
    );

  if (!context) {
    throw new Error(
      "usePresence must be used inside PresenceProvider.",
    );
  }

  return context;
}