import PresenceStatusDot from "./PresenceStatusDot";
import UserAvatar from "./UserAvatar";


function conversationTitle(
  conversation,
  currentUserId,
) {
  if (
    conversation.type ===
    "GROUP"
  ) {
    if (
      conversation.name?.trim()
    ) {
      return conversation.name;
    }

    return conversation.participants
      .filter(
        (participant) =>
          participant.user_id !==
          currentUserId,
      )
      .map(
        (participant) =>
          participant.username,
      )
      .join(", ");
  }

  const otherParticipant =
    conversation.participants.find(
      (participant) =>
        participant.user_id !==
        currentUserId,
    );

  return (
    otherParticipant?.username ??
    "Direct message"
  );
}


function DirectMessagesSection({
  conversations,
  activeConversation,
  user,
  loading,
  error,
  onSelect,
  onCreate,
  onRetry,
}) {
  return (
    <div className="channel-section direct-messages-section">
      <div className="channel-section-heading">
        <span>
          Direct Messages
        </span>

        <button
          type="button"
          title="New conversation"
          aria-label="New conversation"
          onClick={onCreate}
        >
          +
        </button>
      </div>

      {loading && (
        <div className="direct-messages-state">
          Loading conversations...
        </div>
      )}

      {!loading &&
        error && (
          <div className="direct-messages-error">
            <span>
              {error}
            </span>

            <button
              type="button"
              onClick={onRetry}
            >
              Retry
            </button>
          </div>
        )}

      {!loading &&
        !error &&
        conversations.length ===
          0 && (
          <div className="direct-messages-state">
            No direct messages yet.
          </div>
        )}

      {!loading &&
        !error && (
          <div className="direct-message-list">
            {conversations.map(
              (conversation) => {
                const otherParticipant =
                  conversation.type ===
                  "DIRECT"
                    ? conversation.participants.find(
                        (participant) =>
                          participant.user_id !==
                          user.id,
                      )
                    : null;

                return (
                  <button
                    className={[
                      "direct-message-list-item",
                      activeConversation?.id ===
                      conversation.id
                        ? "active"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    type="button"
                    key={
                      conversation.id
                    }
                    onClick={() =>
                      onSelect(
                        conversation,
                      )
                    }
                  >
                    {conversation.type ===
                    "DIRECT" ? (
                      <div className="presence-avatar-shell direct-message-avatar-shell">
                        <UserAvatar
                          className="direct-message-avatar"
                          username={
                            otherParticipant
                              ?.username ??
                            "DM"
                          }
                          avatarUrl={
                            otherParticipant
                              ?.avatar_url ??
                            null
                          }
                        />

                        {otherParticipant && (
                          <PresenceStatusDot
                            userId={
                              otherParticipant
                                .user_id
                            }
                            status={
                              otherParticipant
                                .status
                            }
                          />
                        )}
                      </div>
                    ) : (
                      <div className="direct-message-group-avatar">
                        G
                      </div>
                    )}

                    <span className="direct-message-list-copy">
                      <strong>
                        {conversationTitle(
                          conversation,
                          user.id,
                        )}
                      </strong>

                      <small>
                        {conversation.type ===
                        "GROUP"
                          ? `${conversation.participants.length} members`
                          : "Direct message"}
                      </small>
                    </span>
                  </button>
                );
              },
            )}
          </div>
        )}
    </div>
  );
}


export default DirectMessagesSection;