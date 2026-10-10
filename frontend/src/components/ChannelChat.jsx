import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  apiRequest,
  readApiError,
  refreshTokens,
} from "../api/client";
import {
  createChannelSocket,
} from "../chat/socket";


function normalizeMessage(message) {
  return {
    id: message.id,
    channel:
      message.channel ??
      message.channel_id,
    author:
      message.author ??
      message.author_id,
    author_username:
      message.author_username,
    text: message.text,
    created_at: message.created_at,
    updated_at: message.updated_at,
    edited_at: message.edited_at,
    is_deleted: message.is_deleted,
  };
}


function mergeMessages(
  currentMessages,
  incomingMessages,
) {
  const messageMap = new Map();

  for (const message of currentMessages) {
    messageMap.set(
      message.id,
      normalizeMessage(message),
    );
  }

  for (const message of incomingMessages) {
    messageMap.set(
      message.id,
      normalizeMessage(message),
    );
  }

  return Array.from(
    messageMap.values(),
  ).sort(
    (first, second) =>
      new Date(first.created_at) -
      new Date(second.created_at),
  );
}


function apiPathFromUrl(url) {
  if (!url) {
    return null;
  }

  const parsedUrl =
    new URL(url);

  return (
    parsedUrl.pathname +
    parsedUrl.search
  );
}


function formatMessageTime(value) {
  return new Intl.DateTimeFormat(
    undefined,
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(
    new Date(value),
  );
}


function messageInitial(username) {
  return (
    username
      ?.slice(0, 1)
      .toUpperCase() || "?"
  );
}


function ChannelChat({
  channel,
  workspace,
  user,
}) {
  const [messages, setMessages] =
    useState([]);

  const [nextPage, setNextPage] =
    useState(null);

  const [
    historyLoading,
    setHistoryLoading,
  ] = useState(true);

  const [
    olderLoading,
    setOlderLoading,
  ] = useState(false);

  const [chatError, setChatError] =
    useState("");

  const [
    socketStatus,
    setSocketStatus,
  ] = useState("connecting");

  const [composer, setComposer] =
    useState("");

  const [sending, setSending] =
    useState(false);

  const socketRef =
    useRef(null);

  const reconnectTimerRef =
    useRef(null);

  const reconnectAllowedRef =
    useRef(true);

  const bottomRef =
    useRef(null);

  const shouldScrollRef =
    useRef(true);


  const ensureMembership =
    useCallback(
      async () => {
        const membersResponse =
          await apiRequest(
            `/api/channels/${channel.id}/members/`,
          );

        if (!membersResponse.ok) {
          throw new Error(
            await readApiError(
              membersResponse,
              "Unable to check channel membership.",
            ),
          );
        }

        const members =
          await membersResponse.json();

        const isMember =
          members.some(
            (membership) =>
              membership.user_id ===
              user.id,
          );

        if (isMember) {
          return;
        }

        if (
          channel.type !== "PUBLIC"
        ) {
          throw new Error(
            "You are not a member of this private channel.",
          );
        }

        const joinResponse =
          await apiRequest(
            `/api/channels/${channel.id}/join/`,
            {
              method: "POST",
            },
          );

        if (!joinResponse.ok) {
          throw new Error(
            await readApiError(
              joinResponse,
              "Unable to join channel.",
            ),
          );
        }
      },
      [
        channel.id,
        channel.type,
        user.id,
      ],
    );


  const loadHistory =
    useCallback(
      async () => {
        const response =
          await apiRequest(
            `/api/channels/${channel.id}/messages/`,
          );

        if (!response.ok) {
          throw new Error(
            await readApiError(
              response,
              "Unable to load messages.",
            ),
          );
        }

        const data =
          await response.json();

        shouldScrollRef.current =
          true;

        setMessages(
          (currentMessages) =>
            mergeMessages(
              currentMessages,
              data.results ?? [],
            ),
        );

        setNextPage(
          apiPathFromUrl(
            data.next,
          ),
        );
      },
      [channel.id],
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
            await createChannelSocket(
              channel.id,
            );
        } catch (connectionError) {
          setSocketStatus("error");
          setChatError(
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

          setChatError("");
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
            payload.type ===
              "message.created" ||
            payload.type ===
              "message.updated" ||
            payload.type ===
              "message.deleted"
          ) {
            shouldScrollRef.current =
              payload.type ===
              "message.created";

            setMessages(
              (currentMessages) =>
                mergeMessages(
                  currentMessages,
                  [
                    payload.data,
                  ],
                ),
            );

            return;
          }

          if (
            payload.type ===
            "error"
          ) {
            setChatError(
              payload.data
                ?.message ??
                "A WebSocket error occurred.",
            );
          }
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
              event.code === 4403
            ) {
              setSocketStatus(
                "error",
              );

              setChatError(
                "You no longer have access to this channel.",
              );

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

                setChatError(
                  "Your session has expired. Please sign in again.",
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
        channel.id,
      ],
    );


  useEffect(() => {
    let cancelled = false;

    reconnectAllowedRef.current =
      true;

    setMessages([]);
    setNextPage(null);
    setComposer("");
    setChatError("");
    setHistoryLoading(true);
    setSocketStatus(
      "connecting",
    );

    async function prepareChannel() {
      try {
        await ensureMembership();

        if (cancelled) {
          return;
        }

        await loadHistory();

        if (cancelled) {
          return;
        }

        await connectSocket();
      } catch (requestError) {
        if (!cancelled) {
          setChatError(
            requestError.message,
          );

          setSocketStatus(
            "error",
          );
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(
            false,
          );
        }
      }
    }

    prepareChannel();

    return () => {
      cancelled = true;

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
    channel.id,
    connectSocket,
    ensureMembership,
    loadHistory,
  ]);


  useEffect(() => {
    if (
      !shouldScrollRef.current
    ) {
      return;
    }

    bottomRef.current
      ?.scrollIntoView({
        behavior: "smooth",
      });

    shouldScrollRef.current =
      false;
  }, [messages]);


  async function loadOlderMessages() {
    if (
      !nextPage ||
      olderLoading
    ) {
      return;
    }

    setOlderLoading(true);
    setChatError("");

    try {
      const response =
        await apiRequest(
          nextPage,
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to load older messages.",
          ),
        );
      }

      const data =
        await response.json();

      shouldScrollRef.current =
        false;

      setMessages(
        (currentMessages) =>
          mergeMessages(
            currentMessages,
            data.results ?? [],
          ),
      );

      setNextPage(
        apiPathFromUrl(
          data.next,
        ),
      );
    } catch (requestError) {
      setChatError(
        requestError.message,
      );
    } finally {
      setOlderLoading(false);
    }
  }


  function sendMessage() {
    const text =
      composer.trim();

    if (!text || sending) {
      return;
    }

    const socket =
      socketRef.current;

    if (
      !socket ||
      socket.readyState !==
        WebSocket.OPEN
    ) {
      setChatError(
        "Chat connection is not ready yet.",
      );

      return;
    }

    setSending(true);
    setChatError("");

    try {
      socket.send(
        JSON.stringify({
          type: "message.create",
          data: {
            text,
          },
        }),
      );

      setComposer("");

      shouldScrollRef.current =
        true;
    } finally {
      setSending(false);
    }
  }


  function handleSubmit(event) {
    event.preventDefault();
    sendMessage();
  }


  function handleComposerKeyDown(
    event,
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendMessage();
    }
  }


  return (
    <>
      <header className="channel-content-header">
        <div className="channel-heading-main">
          <div className="channel-heading-title">
            <span>
              {channel.type ===
              "PRIVATE"
                ? "🔒"
                : "#"}
            </span>

            <h1>
              {channel.name}
            </h1>
          </div>

          <p>
            {channel.description ||
              (channel.is_general
                ? "General workspace conversation."
                : "No channel description yet.")}
          </p>
        </div>

        <div className="channel-header-actions">
          <span
            className={[
              "socket-status",
              socketStatus,
            ].join(" ")}
          >
            <i />

            {socketStatus ===
              "connected" &&
              "Live"}

            {socketStatus ===
              "connecting" &&
              "Connecting"}

            {socketStatus ===
              "reconnecting" &&
              "Reconnecting"}

            {socketStatus ===
              "error" &&
              "Offline"}
          </span>

          <span className="channel-visibility-pill">
            {channel.type ===
            "PRIVATE"
              ? "Private"
              : "Public"}
          </span>

          <button
            className="channel-more-button"
            type="button"
            title="Channel actions will be added later."
          >
            •••
          </button>
        </div>
      </header>

      <div className="chat-body">
        {historyLoading && (
          <div className="chat-loading">
            <div className="state-spinner" />

            <span>
              Loading conversation...
            </span>
          </div>
        )}

        {!historyLoading &&
          nextPage && (
            <button
              className="load-older-button"
              type="button"
              onClick={
                loadOlderMessages
              }
              disabled={
                olderLoading
              }
            >
              {olderLoading
                ? "Loading..."
                : "Load older messages"}
            </button>
          )}

        {!historyLoading &&
          messages.length === 0 && (
            <div className="chat-start">
              <div className="channel-placeholder-icon">
                {channel.type ===
                "PRIVATE"
                  ? "🔒"
                  : "#"}
              </div>

              <h2>
                Welcome to #
                {channel.name}
              </h2>

              <p>
                This is the beginning
                of this channel.
                Send the first message
                below.
              </p>
            </div>
          )}

        {!historyLoading &&
          messages.length > 0 && (
            <div className="message-list">
              <div className="channel-intro">
                <div className="channel-intro-icon">
                  {channel.type ===
                  "PRIVATE"
                    ? "🔒"
                    : "#"}
                </div>

                <h2>
                  #{channel.name}
                </h2>

                <p>
                  {channel.description ||
                    `Welcome to ${workspace.name}.`}
                </p>
              </div>

              {messages.map(
                (message) => {
                  const isOwn =
                    message.author ===
                    user.id;

                  return (
                    <article
                      className={[
                        "chat-message",
                        isOwn
                          ? "own"
                          : "",
                        message.is_deleted
                          ? "deleted"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={
                        message.id
                      }
                    >
                      <div className="message-avatar">
                        {messageInitial(
                          message.author_username,
                        )}
                      </div>

                      <div className="message-content">
                        <div className="message-meta">
                          <strong>
                            {
                              message.author_username
                            }
                          </strong>

                          {isOwn && (
                            <span className="message-you">
                              you
                            </span>
                          )}

                          <time
                            dateTime={
                              message.created_at
                            }
                          >
                            {formatMessageTime(
                              message.created_at,
                            )}
                          </time>

                          {message.edited_at &&
                            !message.is_deleted && (
                              <span className="message-edited">
                                edited
                              </span>
                            )}
                        </div>

                        {message.is_deleted ? (
                          <p className="deleted-message-text">
                            Message deleted
                          </p>
                        ) : (
                          <p className="message-text">
                            {message.text}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                },
              )}

              <div
                ref={bottomRef}
              />
            </div>
          )}
      </div>

      {chatError && (
        <div className="chat-error">
          <span>
            {chatError}
          </span>

          <button
            type="button"
            onClick={() =>
              setChatError("")
            }
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      <form
        className="message-composer"
        onSubmit={handleSubmit}
      >
        <textarea
          value={composer}
          onChange={(event) =>
            setComposer(
              event.target.value,
            )
          }
          onKeyDown={
            handleComposerKeyDown
          }
          placeholder={`Message #${channel.name}`}
          rows={1}
          disabled={
            socketStatus !==
            "connected"
          }
        />

        <div className="composer-footer">
          <span>
            Enter to send ·
            Shift + Enter for new line
          </span>

          <button
            type="submit"
            disabled={
              !composer.trim() ||
              sending ||
              socketStatus !==
                "connected"
            }
          >
            Send
          </button>
        </div>
      </form>
    </>
  );
}


export default ChannelChat;