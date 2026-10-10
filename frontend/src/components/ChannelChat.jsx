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
  createChannelSocket,
} from "../chat/socket";
import MemberProfilePopover from "./MemberProfilePopover";
import ChannelActionsMenu from "./ChannelActionsMenu";


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
    reply_to:
      message.reply_to ?? null,
    reply_to_message:
      message.reply_to_message ??
      null,
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


function findMentionAtCursor(
  text,
  cursorPosition,
) {
  const beforeCursor =
    text.slice(
      0,
      cursorPosition,
    );

  const match =
    beforeCursor.match(
      /(^|\s)@([A-Za-z0-9_.+-]*)$/,
    );

  if (!match) {
    return null;
  }

  const prefix =
    match[1] ?? "";

  const query =
    match[2] ?? "";

  const start =
    match.index +
    prefix.length;

  return {
    start,
    end: cursorPosition,
    query,
  };
}


function ChannelChat({
  channel,
  workspace,
  user,
  activityControls,
  onLeftChannel,
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

  const [
    workspaceRole,
    setWorkspaceRole,
  ] = useState(null);

  const [
    workspaceMembers,
    setWorkspaceMembers,
  ] = useState([]);

  const [
    selectedProfileMember,
    setSelectedProfileMember,
  ] = useState(null);

  const [
    mentionState,
    setMentionState,
  ] = useState(null);

  const [
    mentionActiveIndex,
    setMentionActiveIndex,
  ] = useState(0);

  const [
    typingUsers,
    setTypingUsers,
  ] = useState([]);

  const [
    editingMessageId,
    setEditingMessageId,
  ] = useState(null);

  const [editText, setEditText] =
    useState("");

  const [
    pendingDeleteMessageId,
    setPendingDeleteMessageId,
  ] = useState(null);

  const [
    replyTarget,
    setReplyTarget,
  ] = useState(null);

  const [
    highlightedMessageId,
    setHighlightedMessageId,
  ] = useState(null);

  const socketRef =
    useRef(null);

  const reconnectTimerRef =
    useRef(null);

  const reconnectAllowedRef =
    useRef(true);

  const typingTimerRef =
    useRef(null);

  const typingActiveRef =
    useRef(false);

  const highlightTimerRef =
    useRef(null);

  const bottomRef =
    useRef(null);

  const shouldScrollRef =
    useRef(true);

  const composerRef =
    useRef(null);


  const filteredMentionMembers =
    useMemo(
      () => {
        if (!mentionState) {
          return [];
        }

        const query =
          mentionState.query
            .toLowerCase();

        return workspaceMembers.filter(
          (member) => {
            if (
              member.user_id ===
              user.id
            ) {
              return false;
            }

            return member.username
              .toLowerCase()
              .startsWith(query);
          },
        );
      },
      [
        mentionState,
        workspaceMembers,
        user.id,
      ],
    );


  const sendSocketEvent =
    useCallback(
      (type, data = {}) => {
        const socket =
          socketRef.current;

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


  const stopTyping =
    useCallback(
      () => {
        if (
          typingTimerRef.current
        ) {
          window.clearTimeout(
            typingTimerRef.current,
          );

          typingTimerRef.current =
            null;
        }

        if (
          typingActiveRef.current
        ) {
          sendSocketEvent(
            "typing.stop",
          );

          typingActiveRef.current =
            false;
        }
      },
      [sendSocketEvent],
    );


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


  const loadWorkspaceMembers =
    useCallback(
      async () => {
        const response =
          await apiRequest(
            `/api/workspaces/${workspace.id}/members/`,
          );

        if (!response.ok) {
          throw new Error(
            await readApiError(
              response,
              "Unable to load workspace members.",
            ),
          );
        }

        const members =
          await response.json();

        setWorkspaceMembers(
          members,
        );

        const membership =
          members.find(
            (member) =>
              member.user_id ===
              user.id,
          );

        setWorkspaceRole(
          membership?.role ?? null,
        );
      },
      [
        workspace.id,
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
          setSocketStatus(
            "error",
          );

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
            const changedMessage =
              normalizeMessage(
                payload.data,
              );

            shouldScrollRef.current =
              payload.type ===
              "message.created";

            setMessages(
              (currentMessages) => {
                const merged =
                  mergeMessages(
                    currentMessages,
                    [
                      changedMessage,
                    ],
                  );

                return syncReplySnapshots(
                  merged,
                  changedMessage,
                );
              },
            );

            if (
              payload.type ===
              "message.deleted"
            ) {
              setPendingDeleteMessageId(
                (currentId) =>
                  currentId ===
                  changedMessage.id
                    ? null
                    : currentId,
              );

              setReplyTarget(
                (currentReplyTarget) =>
                  currentReplyTarget?.id ===
                  changedMessage.id
                    ? null
                    : currentReplyTarget,
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

            setTypingUsers([]);

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
      [channel.id],
    );


  useEffect(() => {
    let cancelled = false;

    reconnectAllowedRef.current =
      true;

    setMessages([]);
    setNextPage(null);
    setComposer("");
    setChatError("");
    setTypingUsers([]);
    setWorkspaceRole(null);
    setWorkspaceMembers([]);
    setEditingMessageId(null);
    setEditText("");
    setMentionState(null);
    setMentionActiveIndex(0);
    setSelectedProfileMember(null);
    setReplyTarget(null);
    setHighlightedMessageId(null);

    setPendingDeleteMessageId(
      null,
    );

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

        await Promise.all([
          loadHistory(),
          loadWorkspaceMembers(),
        ]);

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

      if (
        typingTimerRef.current
      ) {
        window.clearTimeout(
          typingTimerRef.current,
        );

        typingTimerRef.current =
          null;
      }

      if (
        highlightTimerRef.current
      ) {
        window.clearTimeout(
          highlightTimerRef.current,
        );

        highlightTimerRef.current =
          null;
      }

      typingActiveRef.current =
        false;

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
    loadWorkspaceMembers,
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


  useEffect(() => {
    if (
      mentionActiveIndex <
      filteredMentionMembers.length
    ) {
      return;
    }

    setMentionActiveIndex(0);
  }, [
    filteredMentionMembers.length,
    mentionActiveIndex,
  ]);


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


  function updateMentionState(
    value,
    cursorPosition,
  ) {
    const nextMentionState =
      findMentionAtCursor(
        value,
        cursorPosition,
      );

    setMentionState(
      nextMentionState,
    );

    setMentionActiveIndex(0);
  }


  function handleComposerChange(
    event,
  ) {
    const value =
      event.target.value;

    const cursorPosition =
      event.target.selectionStart ??
      value.length;

    setComposer(value);

    updateMentionState(
      value,
      cursorPosition,
    );

    if (
      socketStatus !==
      "connected"
    ) {
      return;
    }

    if (!value.trim()) {
      stopTyping();
      return;
    }

    if (
      !typingActiveRef.current
    ) {
      sendSocketEvent(
        "typing.start",
      );

      typingActiveRef.current =
        true;
    }

    if (
      typingTimerRef.current
    ) {
      window.clearTimeout(
        typingTimerRef.current,
      );
    }

    typingTimerRef.current =
      window.setTimeout(
        () => {
          stopTyping();
        },
        1200,
      );
  }


  function selectMention(member) {
    if (!mentionState) {
      return;
    }

    const beforeMention =
      composer.slice(
        0,
        mentionState.start,
      );

    const afterMention =
      composer.slice(
        mentionState.end,
      );

    const insertedMention =
      `@${member.username} `;

    const nextComposer =
      beforeMention +
      insertedMention +
      afterMention;

    const nextCursorPosition =
      beforeMention.length +
      insertedMention.length;

    setComposer(
      nextComposer,
    );

    setMentionState(null);
    setMentionActiveIndex(0);

    window.requestAnimationFrame(
      () => {
        composerRef.current
          ?.focus();

        composerRef.current
          ?.setSelectionRange(
            nextCursorPosition,
            nextCursorPosition,
          );
      },
    );
  }


  function sendMessage() {
    const text =
      composer.trim();

    if (!text || sending) {
      return;
    }

    const data = {
      text,
    };

    if (replyTarget) {
      data.reply_to_id =
        replyTarget.id;
    }

    if (
      !sendSocketEvent(
        "message.create",
        data,
      )
    ) {
      setChatError(
        "Chat connection is not ready yet.",
      );

      return;
    }

    setSending(true);
    setChatError("");

    stopTyping();

    setComposer("");
    setMentionState(null);
    setReplyTarget(null);

    shouldScrollRef.current =
      true;

    window.setTimeout(
      () => {
        setSending(false);
      },
      150,
    );
  }


  function handleSubmit(event) {
    event.preventDefault();

    sendMessage();
  }


  function handleComposerKeyDown(
    event,
  ) {
    if (
      mentionState &&
      filteredMentionMembers.length >
        0
    ) {
      if (
        event.key ===
        "ArrowDown"
      ) {
        event.preventDefault();

        setMentionActiveIndex(
          (currentIndex) =>
            (
              currentIndex + 1
            ) %
            filteredMentionMembers.length,
        );

        return;
      }

      if (
        event.key ===
        "ArrowUp"
      ) {
        event.preventDefault();

        setMentionActiveIndex(
          (currentIndex) =>
            (
              currentIndex -
              1 +
              filteredMentionMembers.length
            ) %
            filteredMentionMembers.length,
        );

        return;
      }

      if (
        event.key === "Enter" ||
        event.key === "Tab"
      ) {
        event.preventDefault();

        selectMention(
          filteredMentionMembers[
            mentionActiveIndex
          ],
        );

        return;
      }

      if (
        event.key === "Escape"
      ) {
        event.preventDefault();

        setMentionState(null);

        return;
      }
    }

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


  function handleComposerClick(
    event,
  ) {
    const cursorPosition =
      event.currentTarget
        .selectionStart ??
      composer.length;

    updateMentionState(
      composer,
      cursorPosition,
    );
  }


  function startReply(message) {
    if (message.is_deleted) {
      return;
    }

    setEditingMessageId(null);
    setEditText("");
    setPendingDeleteMessageId(
      null,
    );

    setReplyTarget({
      id: message.id,
      author:
        message.author,
      author_username:
        message.author_username,
      text: message.text,
    });

    window.requestAnimationFrame(
      () => {
        composerRef.current
          ?.focus();
      },
    );
  }


  function cancelReply() {
    setReplyTarget(null);
  }


  function scrollToMessage(
    messageId,
  ) {
    const element =
      document.querySelector(
        `[data-message-id="${messageId}"]`,
      );

    if (!element) {
      return;
    }

    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    setHighlightedMessageId(
      messageId,
    );

    if (
      highlightTimerRef.current
    ) {
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


  function startEditing(message) {
    setReplyTarget(null);

    setPendingDeleteMessageId(
      null,
    );

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


  function saveEditedMessage(
    messageId,
  ) {
    const text =
      editText.trim();

    if (!text) {
      return;
    }

    if (
      !sendSocketEvent(
        "message.update",
        {
          message_id:
            messageId,
          text,
        },
      )
    ) {
      setChatError(
        "Chat connection is not ready yet.",
      );

      return;
    }

    cancelEditing();
  }


  function handleEditKeyDown(
    event,
    messageId,
  ) {
    if (
      event.key === "Escape"
    ) {
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


  function requestDeleteMessage(
    messageId,
  ) {
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
    setPendingDeleteMessageId(
      null,
    );
  }


  function confirmDeleteMessage(
    message,
  ) {
    if (
      !sendSocketEvent(
        "message.delete",
        {
          message_id:
            message.id,
        },
      )
    ) {
      setChatError(
        "Chat connection is not ready yet.",
      );

      return;
    }

    setPendingDeleteMessageId(
      null,
    );
  }


  function canDeleteMessage(
    message,
  ) {
    if (message.is_deleted) {
      return false;
    }

    if (
      message.author === user.id
    ) {
      return true;
    }

    return (
      workspaceRole === "OWNER" ||
      workspaceRole === "ADMIN"
    );
  }


  function openMentionProfile(
    username,
  ) {
    const member =
      workspaceMembers.find(
        (workspaceMember) =>
          workspaceMember.username
            .toLowerCase() ===
          username.toLowerCase(),
      );

    if (!member) {
      return;
    }

    setSelectedProfileMember(
      member,
    );
  }


  function renderMessageText(text) {
    if (!text) {
      return null;
    }

    const parts =
      text.split(
        /(@[A-Za-z0-9_.+-]+)/g,
      );

    return parts.map(
      (part, index) => {
        if (
          !part.startsWith("@")
        ) {
          return (
            <span
              key={`text-${index}`}
            >
              {part}
            </span>
          );
        }

        const username =
          part.slice(1);

        const member =
          workspaceMembers.find(
            (workspaceMember) =>
              workspaceMember.username
                .toLowerCase() ===
              username.toLowerCase(),
          );

        if (!member) {
          return (
            <span
              key={`mention-${index}`}
            >
              {part}
            </span>
          );
        }

        return (
          <button
            className="message-mention"
            type="button"
            key={`mention-${index}`}
            onClick={() =>
              openMentionProfile(
                member.username,
              )
            }
          >
            @{member.username}
          </button>
        );
      },
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
            {channel.type ===
            "PRIVATE"
              ? "Private"
              : "Public"}
          </span>

          <ChannelActionsMenu
            channel={channel}
            workspace={workspace}
            user={user}
            workspaceRole={
              workspaceRole
            }
            onLeftChannel={
              onLeftChannel
            }
          />
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

                  const isEditing =
                    editingMessageId ===
                    message.id;

                  const isDeletePending =
                    pendingDeleteMessageId ===
                    message.id;

                  const isHighlighted =
                    highlightedMessageId ===
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
                        isHighlighted
                          ? "reply-highlight"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={
                        message.id
                      }
                      data-message-id={
                        message.id
                      }
                    >
                      <div className="message-avatar">
                        {messageInitial(
                          message.author_username,
                        )}
                      </div>

                      <div className="message-content">
                        {message.reply_to_message && (
                          <button
                            className="message-reply-reference"
                            type="button"
                            onClick={() =>
                              scrollToMessage(
                                message.reply_to_message.id,
                              )
                            }
                          >
                            <span className="reply-reference-line" />

                            <span className="reply-reference-avatar">
                              {messageInitial(
                                message.reply_to_message
                                  .author_username,
                              )}
                            </span>

                            <strong>
                              {
                                message.reply_to_message
                                  .author_username
                              }
                            </strong>

                            <span className="reply-reference-text">
                              {message.reply_to_message
                                .is_deleted
                                ? "Message deleted"
                                : message.reply_to_message
                                    .text}
                            </span>
                          </button>
                        )}

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
                        ) : isEditing ? (
                          <div className="message-edit-box">
                            <textarea
                              value={
                                editText
                              }
                              onChange={(
                                event,
                              ) =>
                                setEditText(
                                  event
                                    .target
                                    .value,
                                )
                              }
                              onKeyDown={(
                                event,
                              ) =>
                                handleEditKeyDown(
                                  event,
                                  message.id,
                                )
                              }
                              rows={2}
                              autoFocus
                            />

                            <div className="message-edit-actions">
                              <span>
                                Esc to cancel ·
                                Enter to save
                              </span>

                              <button
                                className="message-action-cancel"
                                type="button"
                                onClick={
                                  cancelEditing
                                }
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
                            {renderMessageText(
                              message.text,
                            )}
                          </p>
                        )}
                      </div>

                      {!message.is_deleted &&
                        !isEditing && (
                          <div className="message-actions">
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

                            {canDeleteMessage(
                              message,
                            ) &&
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
                                  onClick={
                                    cancelDeleteMessage
                                  }
                                >
                                  ×
                                </button>
                              </div>
                            )}
                          </div>
                        )}
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

      <div className="typing-indicator-row">
        {typingUsers.length >
          0 && (
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
                      key={
                        typingUser.user_id
                      }
                    >
                      <strong>
                        {
                          typingUser.username
                        }
                      </strong>

                      {" is typing..."}

                      {(
                        index <
                          visibleTypingUsers.length -
                            1 ||
                        hiddenTypingCount >
                          0
                      ) && (
                        <b>
                          /
                        </b>
                      )}
                    </span>
                  ),
                )}

                {hiddenTypingCount >
                  0 && (
                    <span className="typing-user typing-more">
                      <strong>
                        +
                        {
                          hiddenTypingCount
                        }
                      </strong>

                      {hiddenTypingCount ===
                      1
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
        {mentionState && (
          <div className="mention-suggestions">
            <div className="mention-suggestions-header">
              Members
            </div>

            {filteredMentionMembers.length >
            0 ? (
              filteredMentionMembers.map(
                (
                  member,
                  index,
                ) => (
                  <button
                    className={[
                      "mention-suggestion",
                      index ===
                      mentionActiveIndex
                        ? "active"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    type="button"
                    key={
                      member.user_id
                    }
                    onMouseDown={(
                      event,
                    ) => {
                      event.preventDefault();

                      selectMention(
                        member,
                      );
                    }}
                  >
                    <span className="mention-suggestion-avatar">
                      {messageInitial(
                        member.username,
                      )}
                    </span>

                    <span className="mention-suggestion-copy">
                      <strong>
                        {member.username}
                      </strong>

                      <span>
                        {member.email}
                      </span>
                    </span>
                  </button>
                ),
              )
            ) : (
              <div className="mention-suggestions-empty">
                No matching members.
              </div>
            )}
          </div>
        )}

        {replyTarget && (
          <div className="composer-reply-preview">
            <div className="composer-reply-icon">
              ↪
            </div>

            <div className="composer-reply-copy">
              <span>
                Replying to{" "}
                <strong>
                  {
                    replyTarget.author_username
                  }
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
              onClick={
                cancelReply
              }
            >
              ×
            </button>
          </div>
        )}

        <textarea
          ref={composerRef}
          value={composer}
          onChange={
            handleComposerChange
          }
          onKeyDown={
            handleComposerKeyDown
          }
          onClick={
            handleComposerClick
          }
          onKeyUp={(event) => {
            if (
              [
                "ArrowUp",
                "ArrowDown",
                "Enter",
                "Tab",
                "Escape",
              ].includes(
                event.key,
              )
            ) {
              return;
            }

            const cursorPosition =
              event.currentTarget
                .selectionStart ??
              composer.length;

            updateMentionState(
              composer,
              cursorPosition,
            );
          }}
          placeholder={
            replyTarget
              ? `Reply to ${replyTarget.author_username}`
              : `Message #${channel.name}`
          }
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
            {replyTarget &&
              " · Esc to cancel reply"}
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

      <MemberProfilePopover
        member={
          selectedProfileMember
        }
        onClose={() =>
          setSelectedProfileMember(
            null,
          )
        }
      />
    </>
  );
}


export default ChannelChat;