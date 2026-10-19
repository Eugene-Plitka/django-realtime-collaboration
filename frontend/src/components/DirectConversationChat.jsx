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
  createDirectConversationSocket,
} from "../chat/socket";
import PresenceStatusDot from "./PresenceStatusDot";
import UserAvatar from "./UserAvatar";


function normalizeMessage(message) {
  return {
    id: message.id,
    conversation:
      message.conversation ??
      message.conversation_id,
    author:
      message.author ??
      message.author_id,
    author_username:
      message.author_username,
    author_avatar_url:
      message.author_avatar_url ??
      null,
    author_status:
      message.author_status ??
      "ONLINE",
    reply_to:
      message.reply_to ?? null,
    reply_to_message:
      message.reply_to_message ??
      null,
    text: message.text,
    created_at:
      message.created_at,
    updated_at:
      message.updated_at,
    edited_at:
      message.edited_at,
    is_deleted:
      message.is_deleted,
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


function syncReplySnapshots(
  messages,
  changedMessage,
) {
  return messages.map(
    (message) => {
      if (
        message.reply_to !==
        changedMessage.id
      ) {
        return message;
      }

      return {
        ...message,
        reply_to_message: {
          id: changedMessage.id,
          author_id:
            changedMessage.author,
          author_username:
            changedMessage.author_username,
          author_avatar_url:
            changedMessage.author_avatar_url ??
            null,
          text:
            changedMessage.is_deleted
              ? null
              : changedMessage.text,
          is_deleted:
            changedMessage.is_deleted,
        },
      };
    },
  );
}


function apiPathFromUrl(url) {
  if (!url) {
    return null;
  }

  const parsedUrl = new URL(url);

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


function conversationTitle(
  conversation,
  currentUserId,
) {
  const otherParticipants =
    conversation.participants.filter(
      (participant) =>
        participant.user_id !==
        currentUserId,
    );

  if (
    conversation.type ===
    "GROUP"
  ) {
    return (
      conversation.name?.trim() ||
      otherParticipants
        .map(
          (participant) =>
            participant.username,
        )
        .join(", ") ||
      "Group conversation"
    );
  }

  return (
    otherParticipants[0]
      ?.username ??
    "Direct message"
  );
}


function DirectConversationChat({
  conversation,
  user,
  activityControls,
}) {
  const [messages, setMessages] =
    useState([]);
  const [nextPage, setNextPage] =
    useState(null);
  const [historyLoading, setHistoryLoading] =
    useState(true);
  const [olderLoading, setOlderLoading] =
    useState(false);
  const [chatError, setChatError] =
    useState("");
  const [socketStatus, setSocketStatus] =
    useState("connecting");
  const [composer, setComposer] =
    useState("");
  const [typingUsers, setTypingUsers] =
    useState([]);
  const [replyTarget, setReplyTarget] =
    useState(null);
  const [editingMessageId, setEditingMessageId] =
    useState(null);
  const [editText, setEditText] =
    useState("");
  const [mobileMessageMenuId, setMobileMessageMenuId] = useState(null);
  const [pendingDeleteMessageId, setPendingDeleteMessageId] =
    useState(null);
  const [highlightedMessageId, setHighlightedMessageId] =
    useState(null);

  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAllowedRef = useRef(true);
  const typingTimerRef = useRef(null);
  const typingActiveRef = useRef(false);
  const bottomRef = useRef(null);
  const shouldScrollRef = useRef(true);
  const composerRef = useRef(null);
  const highlightTimerRef = useRef(null);

  const title = conversationTitle(
    conversation,
    user.id,
  );

  const otherParticipants =
    conversation.participants.filter(
      (participant) =>
        participant.user_id !==
        user.id,
    );

  const sendSocketEvent = useCallback(
    (type, data = {}) => {
      const socket = socketRef.current;

      if (
        !socket ||
        socket.readyState !==
          WebSocket.OPEN
      ) {
        return false;
      }

      socket.send(
        JSON.stringify({
          type,
          data,
        }),
      );

      return true;
    },
    [],
  );

  const stopTyping = useCallback(
    () => {
      if (typingTimerRef.current) {
        window.clearTimeout(
          typingTimerRef.current,
        );
        typingTimerRef.current = null;
      }

      if (typingActiveRef.current) {
        sendSocketEvent(
          "typing.stop",
        );
        typingActiveRef.current = false;
      }
    },
    [sendSocketEvent],
  );

  const loadHistory = useCallback(
    async () => {
      const response = await apiRequest(
        `/api/direct-conversations/${conversation.id}/messages/`,
      );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to load direct messages.",
          ),
        );
      }

      const data = await response.json();

      shouldScrollRef.current = true;

      setMessages(
        data.results ?? [],
      );

      setNextPage(
        apiPathFromUrl(
          data.next,
        ),
      );
    },
    [conversation.id],
  );

  const connectSocket = useCallback(
    async () => {
      if (!reconnectAllowedRef.current) {
        return;
      }

      setSocketStatus(
        "connecting",
      );

      let socket;

      try {
        socket =
          await createDirectConversationSocket(
            conversation.id,
          );
      } catch (connectionError) {
        setSocketStatus(
          "error",
        );
        setChatError(
          connectionError.message,
        );
        return;
      }

      if (!reconnectAllowedRef.current) {
        socket.close();
        return;
      }

      socketRef.current = socket;

      socket.onopen = () => {
        setSocketStatus(
          "connected",
        );
        setChatError("");
      };

      socket.onmessage = (event) => {
        let payload;

        try {
          payload = JSON.parse(
            event.data,
          );
        } catch {
          return;
        }

        if (
          payload.type ===
            "direct_message.created" ||
          payload.type ===
            "direct_message.updated" ||
          payload.type ===
            "direct_message.deleted"
        ) {
          const changedMessage =
            normalizeMessage(
              payload.data,
            );

          if (
            payload.type ===
            "direct_message.created"
          ) {
            shouldScrollRef.current = true;
          }

          setMessages(
            (currentMessages) => {
              const merged = mergeMessages(
                currentMessages,
                [changedMessage],
              );

              return syncReplySnapshots(
                merged,
                changedMessage,
              );
            },
          );

          if (
            payload.type ===
              "direct_message.updated"
          ) {
            setEditingMessageId(
              (currentMessageId) =>
                currentMessageId ===
                changedMessage.id
                  ? null
                  : currentMessageId,
            );

            setEditText(
              "",
            );
          }

          if (
            payload.type ===
              "direct_message.deleted"
          ) {
            setReplyTarget(
              (currentReplyTarget) =>
                currentReplyTarget?.id ===
                changedMessage.id
                  ? null
                  : currentReplyTarget,
            );

            setPendingDeleteMessageId(
              (currentMessageId) =>
                currentMessageId ===
                changedMessage.id
                  ? null
                  : currentMessageId,
            );
          }

          return;
        }

        if (
          payload.type ===
          "typing.started"
        ) {
          setTypingUsers(
            (currentUsers) => {
              const exists =
                currentUsers.some(
                  (typingUser) =>
                    typingUser.user_id ===
                    payload.data.user_id,
                );

              if (exists) {
                return currentUsers;
              }

              return [
                ...currentUsers,
                payload.data,
              ];
            },
          );

          return;
        }

        if (
          payload.type ===
          "typing.stopped"
        ) {
          setTypingUsers(
            (currentUsers) =>
              currentUsers.filter(
                (typingUser) =>
                  typingUser.user_id !==
                  payload.data.user_id,
              ),
          );

          return;
        }

        if (
          payload.type ===
          "error"
        ) {
          setChatError(
            payload.data?.message ??
              "A WebSocket error occurred.",
          );
        }
      };

      socket.onerror = () => {
        setSocketStatus(
          "error",
        );
      };

      socket.onclose = async (event) => {
        if (
          socketRef.current ===
          socket
        ) {
          socketRef.current = null;
        }

        setTypingUsers([]);

        if (!reconnectAllowedRef.current) {
          return;
        }

        if (event.code === 4403) {
          setSocketStatus(
            "error",
          );
          setChatError(
            "You no longer have access to this conversation.",
          );
          return;
        }

        if (event.code === 4401) {
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
    [conversation.id],
  );

  useEffect(() => {
    let cancelled = false;

    reconnectAllowedRef.current = true;

    setMessages([]);
    setNextPage(null);
    setChatError("");
    setSocketStatus("connecting");
    setComposer("");
    setTypingUsers([]);
    setReplyTarget(null);
    setEditingMessageId(null);
    setEditText("");
    setPendingDeleteMessageId(null);
    setHighlightedMessageId(null);
    setHistoryLoading(true);

    async function prepareConversation() {
      try {
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

    prepareConversation();

    return () => {
      cancelled = true;
      reconnectAllowedRef.current = false;

      if (reconnectTimerRef.current) {
        window.clearTimeout(
          reconnectTimerRef.current,
        );
        reconnectTimerRef.current = null;
      }

      if (typingTimerRef.current) {
        window.clearTimeout(
          typingTimerRef.current,
        );
        typingTimerRef.current = null;
      }

      if (highlightTimerRef.current) {
        window.clearTimeout(
          highlightTimerRef.current,
        );
        highlightTimerRef.current = null;
      }

      typingActiveRef.current = false;

      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [
    conversation.id,
    connectSocket,
    loadHistory,
  ]);

  useEffect(() => {
    if (!shouldScrollRef.current) {
      return;
    }

    shouldScrollRef.current = false;

    window.requestAnimationFrame(
      () => {
        // Keep auto-scroll confined to the messages pane, not the page.
        const chatBody = bottomRef.current?.closest(".chat-body");
        if (chatBody) {
          chatBody.scrollTop = chatBody.scrollHeight;
        }
      },
    );
  }, [messages]);

  async function loadOlderMessages() {
    if (!nextPage || olderLoading) {
      return;
    }

    setOlderLoading(true);
    setChatError("");

    try {
      const response = await apiRequest(
        nextPage,
      );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to load older direct messages.",
          ),
        );
      }

      const data = await response.json();

      shouldScrollRef.current = false;

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

  function handleComposerChange(event) {
    const value = event.target.value;

    setComposer(value);

    if (!value.trim()) {
      stopTyping();
      return;
    }

    if (!typingActiveRef.current) {
      const started = sendSocketEvent(
        "typing.start",
      );

      if (started) {
        typingActiveRef.current = true;
      }
    }

    if (typingTimerRef.current) {
      window.clearTimeout(
        typingTimerRef.current,
      );
    }

    typingTimerRef.current =
      window.setTimeout(
        () => {
          stopTyping();
        },
        1400,
      );
  }

  function sendMessage() {
    const text = composer.trim();

    if (!text) {
      return;
    }

    const sent = sendSocketEvent(
      "direct_message.create",
      {
        text,
        reply_to_id:
          replyTarget?.id ?? null,
      },
    );

    if (!sent) {
      setChatError(
        "Chat connection is not ready yet.",
      );
      return;
    }

    setComposer("");
    setReplyTarget(null);
    stopTyping();
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage();
  }

  function handleComposerKeyDown(event) {
    if (
      event.key === "Escape" &&
      replyTarget
    ) {
      event.preventDefault();
      setReplyTarget(null);
      return;
    }

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendMessage();
    }
  }

  function startReply(message) {
    if (message.is_deleted) {
      return;
    }

    setEditingMessageId(null);
    setEditText("");
    setPendingDeleteMessageId(null);

    setReplyTarget({
      id: message.id,
      author: message.author,
      author_username:
        message.author_username,
      text: message.text,
    });

    window.requestAnimationFrame(
      () => {
        composerRef.current?.focus();
      },
    );
  }

  function cancelReply() {
    setReplyTarget(null);
  }

  function startEditing(message) {
    if (
      message.is_deleted ||
      message.author !== user.id
    ) {
      return;
    }

    setReplyTarget(null);
    setPendingDeleteMessageId(null);
    setEditingMessageId(
      message.id,
    );
    setEditText(
      message.text ?? "",
    );
  }

  function cancelEditing() {
    setEditingMessageId(null);
    setEditText("");
  }

  function saveEditedMessage(messageId) {
    const text = editText.trim();

    if (!text) {
      return;
    }

    const sent = sendSocketEvent(
      "direct_message.update",
      {
        message_id: messageId,
        text,
      },
    );

    if (!sent) {
      setChatError(
        "Chat connection is not ready yet.",
      );
    }
  }

  function handleEditKeyDown(
    event,
    messageId,
  ) {
    if (event.key === "Escape") {
      cancelEditing();
      return;
    }

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      saveEditedMessage(
        messageId,
      );
    }
  }

  function requestDeleteMessage(messageId) {
    setEditingMessageId(null);
    setEditText("");

    if (
      replyTarget?.id ===
      messageId
    ) {
      setReplyTarget(null);
    }

    setPendingDeleteMessageId(
      messageId,
    );
  }

  function cancelDeleteMessage() {
    setPendingDeleteMessageId(null);
  }

  function confirmDeleteMessage(message) {
    const sent = sendSocketEvent(
      "direct_message.delete",
      {
        message_id: message.id,
      },
    );

    if (!sent) {
      setChatError(
        "Chat connection is not ready yet.",
      );
      return;
    }

    setPendingDeleteMessageId(null);
  }

  function scrollToMessage(messageId) {
    const element =
      document.querySelector(
        `[data-message-id="${messageId}"]`,
      );

    if (!element) {
      return;
    }

    const chatBody = element.closest(".chat-body");
    if (chatBody) {
      const bodyRect = chatBody.getBoundingClientRect();
      const messageRect = element.getBoundingClientRect();
      chatBody.scrollTo({
        top: chatBody.scrollTop + messageRect.top - bodyRect.top
          - (chatBody.clientHeight - messageRect.height) / 2,
        behavior: "smooth",
      });
    }

    setHighlightedMessageId(
      messageId,
    );

    if (highlightTimerRef.current) {
      window.clearTimeout(
        highlightTimerRef.current,
      );
    }

    highlightTimerRef.current =
      window.setTimeout(
        () => {
          setHighlightedMessageId(
            null,
          );
        },
        1500,
      );
  }

  const visibleTypingUsers =
    typingUsers.slice(0, 3);

  const hiddenTypingCount =
    Math.max(
      typingUsers.length - 3,
      0,
    );

  return (
    <>
      <header className="channel-content-header">
        <div className="channel-heading-main">
          <div className="channel-heading-title">
            <span>
              {conversation.type ===
              "GROUP"
                ? "G"
                : "@"}
            </span>

            <h1>
              {title}
            </h1>
          </div>

          <p>
            {conversation.type ===
            "GROUP"
              ? `${conversation.participants.length} participants`
              : "Private direct conversation"}
          </p>
        </div>

        <div className="channel-header-actions">
          {activityControls}

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
            Private
          </span>
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
              onClick={loadOlderMessages}
              disabled={olderLoading}
            >
              {olderLoading
                ? "Loading..."
                : "Load older messages"}
            </button>
          )}

        {!historyLoading &&
          messages.length === 0 && (
            <div className="channel-intro direct-chat-intro">
              <div className="channel-intro-icon">
                {conversation.type ===
                "GROUP"
                  ? "G"
                  : "@"}
              </div>

              <h2>
                {title}
              </h2>

              <p>
                {conversation.type ===
                "GROUP"
                  ? "This is the beginning of this group conversation."
                  : `This is the beginning of your conversation with ${title}.`}
              </p>

              <div className="direct-chat-participants">
                {otherParticipants.map(
                  (participant) => (
                    <span
                      className="direct-chat-participant"
                      key={
                        participant.user_id
                      }
                    >
                      <span className="presence-avatar-shell direct-chat-participant-avatar-shell">
                        <UserAvatar
                          className="direct-chat-participant-avatar"
                          username={
                            participant.username
                          }
                          avatarUrl={
                            participant.avatar_url
                          }
                        />

                        <PresenceStatusDot
                          userId={
                            participant.user_id
                          }
                          status={
                            participant.status
                          }
                        />
                      </span>

                      {participant.username}
                    </span>
                  ),
                )}
              </div>
            </div>
          )}

        {!historyLoading &&
          messages.length > 0 && (
            <div className="message-list">
              {messages.map(
                (message) => {
                  const isOwn =
                    message.author ===
                    user.id;
                  const isEditing =
                    editingMessageId ===
                    message.id;
                  const isDeletePending =
                    pendingDeleteMessageId ===
                    message.id;

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
                        highlightedMessageId ===
                        message.id
                          ? "highlighted"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={message.id}
                      data-message-id={
                        message.id
                      }
                    >
                      <div className="presence-avatar-shell message-avatar-shell">
                        <UserAvatar
                          className="message-avatar"
                          username={
                            message.author_username
                          }
                          avatarUrl={
                            message.author_avatar_url
                          }
                        />

                        <PresenceStatusDot
                          userId={
                            message.author
                          }
                          status={
                            message.author_status
                          }
                        />
                      </div>

                      <div className="message-content">
                        <div className="message-meta">
                          <strong>
                            {message.author_username}
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

                        {message.reply_to_message && (
                          <button
                            className="message-reply-reference"
                            type="button"
                            onClick={() =>
                              scrollToMessage(
                                message.reply_to,
                              )
                            }
                          >
                            <span>
                              ↪
                            </span>

                            <strong>
                              {
                                message.reply_to_message
                                  .author_username
                              }
                            </strong>

                            <span>
                              {message.reply_to_message
                                .is_deleted
                                ? "Deleted message"
                                : message.reply_to_message
                                    .text}
                            </span>
                          </button>
                        )}

                        {message.is_deleted ? (
                          <p className="deleted-message-text">
                            This message was deleted.
                          </p>
                        ) : isEditing ? (
                          <div className="message-edit-box">
                            <textarea
                              value={editText}
                              onChange={(event) =>
                                setEditText(
                                  event.target.value,
                                )
                              }
                              onKeyDown={(event) =>
                                handleEditKeyDown(
                                  event,
                                  message.id,
                                )
                              }
                              autoFocus
                            />

                            <div className="message-edit-actions">
                              <span>
                                Enter to save · Shift + Enter for new line
                              </span>

                              <button
                                className="message-action-cancel"
                                type="button"
                                onClick={cancelEditing}
                              >
                                Cancel
                              </button>

                              <button
                                className="message-action-save"
                                type="button"
                                disabled={
                                  !editText.trim()
                                }
                                onClick={() =>
                                  saveEditedMessage(
                                    message.id,
                                  )
                                }
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="message-text">
                            {message.text}
                          </p>
                        )}

                        {!message.is_deleted &&
                          !isEditing && (
                            <div className={`message-actions ${mobileMessageMenuId === message.id ? "mobile-actions-open" : ""}`}>
                            <button
                              className="mobile-message-more"
                              type="button"
                              aria-label="Message actions"
                              aria-expanded={mobileMessageMenuId === message.id}
                              onClick={() => setMobileMessageMenuId((current) => current === message.id ? null : message.id)}
                            >•••</button>
                            <div className="mobile-message-action-items">
                              {!isDeletePending && (
                                <button
                                  type="button"
                                  title="Reply to message"
                                  onClick={() =>
                                    startReply(
                                      message,
                                    )
                                  }
                                >
                                  Reply
                                </button>
                              )}

                              {isOwn &&
                                !isDeletePending && (
                                  <button
                                    type="button"
                                    title="Edit message"
                                    onClick={() =>
                                      startEditing(
                                        message,
                                      )
                                    }
                                  >
                                    Edit
                                  </button>
                                )}

                              {isOwn &&
                                !isDeletePending && (
                                  <button
                                    className="danger"
                                    type="button"
                                    title="Delete message"
                                    onClick={() =>
                                      requestDeleteMessage(
                                        message.id,
                                      )
                                    }
                                  >
                                    Delete
                                  </button>
                                )}

                              {isDeletePending && (
                                <div className="message-delete-confirm">
                                  <button
                                    className="confirm"
                                    type="button"
                                    title="Confirm delete"
                                    aria-label="Confirm delete"
                                    onClick={() =>
                                      confirmDeleteMessage(
                                        message,
                                      )
                                    }
                                  >
                                    ✓
                                  </button>

                                  <button
                                    className="cancel"
                                    type="button"
                                    title="Cancel delete"
                                    aria-label="Cancel delete"
                                    onClick={cancelDeleteMessage}
                                  >
                                    ×
                                  </button>
                                </div>
                              )}
                              </div>
                            </div>
                          )}
                      </div>
                    </article>
                  );
                },
              )}

              <div ref={bottomRef} />
            </div>
          )}
      </div>

      <div className="typing-indicator-row">
        {typingUsers.length > 0 && (
          <div className="typing-indicator">
            <span className="typing-dots">
              <i />
              <i />
              <i />
            </span>

            <div className="typing-users-list">
              {visibleTypingUsers.map(
                (
                  typingUser,
                  index,
                ) => (
                  <span
                    className="typing-user"
                    key={typingUser.user_id}
                  >
                    <strong>
                      {typingUser.username}
                    </strong>
                    {" is typing..."}
                    {(
                      index <
                        visibleTypingUsers.length -
                          1 ||
                      hiddenTypingCount > 0
                    ) && (
                      <b>
                        /
                      </b>
                    )}
                  </span>
                ),
              )}

              {hiddenTypingCount > 0 && (
                <span className="typing-user typing-more">
                  <strong>
                    +{hiddenTypingCount}
                  </strong>
                  {hiddenTypingCount === 1
                    ? " member is typing..."
                    : " members are typing..."}
                </span>
              )}
            </div>
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
        {replyTarget && (
          <div className="composer-reply-preview">
            <div className="composer-reply-icon">
              ↪
            </div>

            <div className="composer-reply-copy">
              <span>
                Replying to{" "}
                <strong>
                  {replyTarget.author_username}
                </strong>
              </span>

              <p>
                {replyTarget.text}
              </p>
            </div>

            <button
              type="button"
              className="composer-reply-close"
              title="Cancel reply"
              aria-label="Cancel reply"
              onClick={cancelReply}
            >
              ×
            </button>
          </div>
        )}

        <textarea
          ref={composerRef}
          value={composer}
          onChange={handleComposerChange}
          onKeyDown={handleComposerKeyDown}
          placeholder={
            replyTarget
              ? `Reply to ${replyTarget.author_username}`
              : `Message ${title}`
          }
          rows={1}
          disabled={
            socketStatus !==
            "connected"
          }
        />

        <div className="composer-footer">
          <span>
            Enter to send · Shift + Enter for new line
            {replyTarget &&
              " · Esc to cancel reply"}
          </span>

          <button
            type="submit"
            disabled={
              !composer.trim() ||
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


export default DirectConversationChat;
