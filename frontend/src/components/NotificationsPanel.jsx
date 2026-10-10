function formatNotificationDate(value) {
  return new Intl.DateTimeFormat(
    undefined,
    {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(
    new Date(value),
  );
}


function notificationContent(
  notification,
) {
  const payload =
    notification.payload ?? {};

  if (
    notification.type ===
    "mention"
  ) {
    return {
      icon: "@",
      title: `${
        payload.author_username ??
        "Someone"
      } mentioned you`,
      description:
        `In #${
          payload.channel_name ??
          "channel"
        }`,
    };
  }

  if (
    notification.type ===
    "channel_added"
  ) {
    return {
      icon: "#",
      title:
        "Added to a channel",
      description:
        `You were added to #${
          payload.channel_name ??
          "channel"
        }`,
    };
  }

  if (
    notification.type ===
    "workspace_invitation"
  ) {
    return {
      icon: "W",
      title:
        "Workspace invitation",
      description:
        `${
          payload.invited_by_username ??
          "Someone"
        } invited you to ${
          payload.workspace_name ??
          "a workspace"
        }`,
    };
  }

  return {
    icon: "N",
    title: "Notification",
    description:
      "You have a new notification.",
  };
}


function NotificationsPanel({
  notifications,
  unreadCount,
  loading,
  error,
  socketStatus,
  onMarkRead,
  onMarkUnread,
  onOpen,
}) {
  async function handleOpen(
    notification,
  ) {
    if (!notification.is_read) {
      try {
        await onMarkRead(
          notification.id,
        );
      } catch {
        return;
      }
    }

    onOpen(notification);
  }


  return (
    <div className="notifications-page">
      <header className="notifications-header">
        <div>
          <span className="members-eyebrow">
            Activity
          </span>

          <h1>
            Notifications
          </h1>

          <p>
            Mentions, channel access and
            workspace activity.
          </p>
        </div>

        <div className="notifications-summary">
          <span
            className={[
              "notification-live-status",
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

          <strong>
            {unreadCount}
          </strong>

          <span>
            unread
          </span>
        </div>
      </header>

      {error && (
        <div className="notifications-error form-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="members-loading">
          <div className="state-spinner" />

          <span>
            Loading notifications...
          </span>
        </div>
      ) : notifications.length ===
        0 ? (
        <div className="notification-empty-state">
          <div className="state-icon">
            N
          </div>

          <h2>
            No notifications yet
          </h2>

          <p>
            Mentions and workspace
            activity will appear here.
          </p>
        </div>
      ) : (
        <div className="notification-list">
          {notifications.map(
            (notification) => {
              const content =
                notificationContent(
                  notification,
                );

              return (
                <article
                  className={[
                    "notification-card",
                    notification.is_read
                      ? "read"
                      : "unread",
                  ].join(" ")}
                  key={
                    notification.id
                  }
                >
                  <button
                    className="notification-main"
                    type="button"
                    onClick={() =>
                      handleOpen(
                        notification,
                      )
                    }
                  >
                    <div className="notification-icon">
                      {content.icon}
                    </div>

                    <div className="notification-copy">
                      <div className="notification-title-row">
                        <strong>
                          {
                            content.title
                          }
                        </strong>

                        {!notification.is_read && (
                          <i className="notification-unread-dot" />
                        )}
                      </div>

                      <p>
                        {
                          content.description
                        }
                      </p>

                      <time>
                        {formatNotificationDate(
                          notification.created_at,
                        )}
                      </time>
                    </div>
                  </button>

                  <div className="notification-actions">
                    {notification.is_read ? (
                      <button
                        type="button"
                        onClick={() =>
                          onMarkUnread(
                            notification.id,
                          )
                        }
                      >
                        Mark unread
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          onMarkRead(
                            notification.id,
                          )
                        }
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </article>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}


export default NotificationsPanel;