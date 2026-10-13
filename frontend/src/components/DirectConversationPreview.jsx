import PresenceStatusDot from "./PresenceStatusDot";
import UserAvatar from "./UserAvatar";


function DirectConversationPreview({
  conversation,
  user,
  activityControls,
}) {
  if (!conversation) {
    return null;
  }

  const otherParticipants =
    conversation.participants.filter(
      (participant) =>
        participant.user_id !==
        user.id,
    );

  const title =
    conversation.type === "GROUP"
      ? (
          conversation.name?.trim() ||
          otherParticipants
            .map(
              (participant) =>
                participant.username,
            )
            .join(", ")
        )
      : (
          otherParticipants[0]
            ?.username ??
          "Direct message"
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
        </div>
      </header>

      <div className="direct-conversation-preview">
        <div className="direct-conversation-preview-icon">
          {conversation.type ===
          "GROUP"
            ? "G"
            : "@"}
        </div>

        <h2>
          {title}
        </h2>

        <p>
          The conversation is ready.
          Realtime messages will be connected
          in the next step.
        </p>

        <div className="direct-conversation-participants">
          {conversation.participants.map(
            (participant) => (
              <div
                className="direct-conversation-participant"
                key={
                  participant.user_id
                }
              >
                <div className="presence-avatar-shell direct-preview-avatar-shell">
                  <UserAvatar
                    className="direct-preview-avatar"
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
                </div>

                <span>
                  {participant.username}

                  {participant.user_id ===
                    user.id &&
                    " · you"}
                </span>
              </div>
            ),
          )}
        </div>
      </div>
    </>
  );
}


export default DirectConversationPreview;