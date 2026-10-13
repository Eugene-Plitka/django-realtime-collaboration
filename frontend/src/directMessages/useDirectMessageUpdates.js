import {
  useCallback,
  useEffect,
  useRef,
} from "react";

import {
  refreshTokens,
} from "../api/client";
import {
  createNotificationSocket,
} from "../chat/socket";


export function useDirectMessageUpdates({
  onConversationUpdate,
}) {
  const socketRef =
    useRef(null);

  const reconnectTimerRef =
    useRef(null);

  const reconnectAllowedRef =
    useRef(true);


  const connectSocket =
    useCallback(
      async () => {
        if (
          !reconnectAllowedRef.current
        ) {
          return;
        }

        let socket;

        try {
          socket =
            await createNotificationSocket();
        } catch {
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
            "direct_message.unread_updated"
          ) {
            return;
          }

          const conversation =
            payload.data
              ?.conversation;

          if (!conversation) {
            return;
          }

          onConversationUpdate?.(
            conversation,
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
                return;
              }
            }

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
        onConversationUpdate,
      ],
    );


  useEffect(() => {
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
  ]);
}