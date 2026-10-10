import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  apiRequest,
  readApiError,
} from "../api/client";


function formatActivityDate(value) {
  return new Intl.DateTimeFormat(
    undefined,
    {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(new Date(value));
}


function notificationCopy(notification) {
  const payload =
    notification.payload ?? {};

  if (notification.type === "mention") {
    return {
      icon: "@",
      title: `${payload.author_username ?? "Someone"} mentioned you`,
      description: `#${payload.channel_name ?? "channel"}`,
    };
  }

  if (
    notification.type ===
    "channel_added"
  ) {
    return {
      icon: "#",
      title: "Added to channel",
      description: `#${payload.channel_name ?? "channel"}`,
    };
  }

  if (
    notification.type ===
    "workspace_invitation"
  ) {
    return {
      icon: "W",
      title: "Workspace invitation",
      description:
        payload.workspace_name ??
        "New workspace invitation",
    };
  }

  return {
    icon: "N",
    title: "Notification",
    description:
      "New activity",
  };
}


function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


function InvitationIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M16 11h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


function HeaderActivityControls({
  notifications,
  unreadCount,
  notificationsLoading,
  notificationsError,
  markRead,
  markUnread,
  onOpenNotification,
  onInvitationAccepted,
}) {
  const [activePopup, setActivePopup] =
    useState(null);

  const [
    invitations,
    setInvitations,
  ] = useState([]);

  const [
    invitationsLoading,
    setInvitationsLoading,
  ] = useState(true);

  const [
    invitationError,
    setInvitationError,
  ] = useState("");

  const [
    acceptingInvitationId,
    setAcceptingInvitationId,
  ] = useState(null);

  const rootRef = useRef(null);


  const invitationNotificationCount =
    notifications.filter(
      (notification) =>
        notification.type ===
        "workspace_invitation",
    ).length;


  const loadInvitations = useCallback(
    async () => {
      setInvitationsLoading(true);
      setInvitationError("");

      try {
        const response =
          await apiRequest(
            "/api/workspaces/invitations/pending/",
          );

        if (!response.ok) {
          throw new Error(
            await readApiError(
              response,
              "Unable to load invitations.",
            ),
          );
        }

        const data =
          await response.json();

        setInvitations(data);
      } catch (requestError) {
        setInvitationError(
          requestError.message,
        );
      } finally {
        setInvitationsLoading(false);
      }
    },
    [],
  );


  useEffect(() => {
    loadInvitations();
  }, [
    loadInvitations,
    invitationNotificationCount,
  ]);


  useEffect(() => {
    function handleDocumentPointerDown(
      event,
    ) {
      if (
        rootRef.current &&
        !rootRef.current.contains(
          event.target,
        )
      ) {
        setActivePopup(null);
      }
    }

    document.addEventListener(
      "mousedown",
      handleDocumentPointerDown,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleDocumentPointerDown,
      );
    };
  }, []);


  function togglePopup(name) {
    setActivePopup(
      (currentPopup) =>
        currentPopup === name
          ? null
          : name,
    );

    if (name === "invitations") {
      loadInvitations();
    }
  }


  async function acceptInvitation(
    invitation,
  ) {
    setAcceptingInvitationId(
      invitation.id,
    );

    setInvitationError("");

    try {
      const response =
        await apiRequest(
          `/api/workspaces/invitations/${invitation.token}/accept/`,
          {
            method: "POST",
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to accept invitation.",
          ),
        );
      }

      setInvitations(
        (currentInvitations) =>
          currentInvitations.filter(
            (currentInvitation) =>
              currentInvitation.id !==
              invitation.id,
          ),
      );

      const relatedNotification =
        notifications.find(
          (notification) =>
            notification.type ===
              "workspace_invitation" &&
            notification.payload
              ?.invitation_id ===
              invitation.id,
        );

      if (
        relatedNotification &&
        !relatedNotification.is_read
      ) {
        try {
          await markRead(
            relatedNotification.id,
          );
        } catch {
          // Invitation itself was accepted.
        }
      }

      await onInvitationAccepted(
        invitation.workspace,
      );

      setActivePopup(null);
    } catch (requestError) {
      setInvitationError(
        requestError.message,
      );
    } finally {
      setAcceptingInvitationId(
        null,
      );
    }
  }


  async function openNotification(
    notification,
  ) {
    if (!notification.is_read) {
      try {
        await markRead(
          notification.id,
        );
      } catch {
        return;
      }
    }

    if (
      notification.type ===
      "workspace_invitation"
    ) {
      setActivePopup(
        "invitations",
      );

      loadInvitations();
      return;
    }

    setActivePopup(null);

    onOpenNotification(
      notification,
    );
  }


  return (
    <div
      className="header-activity-controls"
      ref={rootRef}
    >
      <div className="header-activity-item">
        <button
          className="header-activity-button invitation"
          type="button"
          title="Workspace invitations"
          aria-label="Workspace invitations"
          onClick={() =>
            togglePopup(
              "invitations",
            )
          }
        >
          <InvitationIcon />

          {invitations.length > 0 && (
            <span className="activity-badge invitation">
              {invitations.length > 99
                ? "99+"
                : invitations.length}
            </span>
          )}
        </button>

        {activePopup ===
          "invitations" && (
          <div className="activity-popover invitation-popover">
            <div className="activity-popover-header">
              <div>
                <strong>
                  Invitations
                </strong>

                <span>
                  {
                    invitations.length
                  }{" "}
                  pending
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  setActivePopup(null)
                }
              >
                ×
              </button>
            </div>

            {invitationError && (
              <div className="activity-popover-error">
                {invitationError}
              </div>
            )}

            {invitationsLoading ? (
              <div className="activity-popover-state">
                Loading invitations...
              </div>
            ) : invitations.length ===
              0 ? (
              <div className="activity-popover-empty">
                <strong>
                  No pending invitations
                </strong>

                <span>
                  New workspace invitations
                  will appear here.
                </span>
              </div>
            ) : (
              <div className="activity-popover-list">
                {invitations.map(
                  (invitation) => (
                    <article
                      className="invitation-popover-item"
                      key={
                        invitation.id
                      }
                    >
                      <div className="activity-item-icon invitation">
                        {invitation.workspace_name
                          ?.slice(0, 1)
                          .toUpperCase() ??
                          "W"}
                      </div>

                      <div className="activity-item-copy">
                        <strong>
                          {
                            invitation.workspace_name
                          }
                        </strong>

                        <span>
                          {
                            invitation.invited_by_username
                          }{" "}
                          invited you as{" "}
                          {
                            invitation.role
                          }
                        </span>
                      </div>

                      <button
                        className="activity-accept-button"
                        type="button"
                        disabled={
                          acceptingInvitationId ===
                          invitation.id
                        }
                        onClick={() =>
                          acceptInvitation(
                            invitation,
                          )
                        }
                      >
                        {acceptingInvitationId ===
                        invitation.id
                          ? "..."
                          : "Accept"}
                      </button>
                    </article>
                  ),
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="header-activity-item">
        <button
          className="header-activity-button notification"
          type="button"
          title="Notifications"
          aria-label="Notifications"
          onClick={() =>
            togglePopup(
              "notifications",
            )
          }
        >
          <BellIcon />

          {unreadCount > 0 && (
            <span className="activity-badge notification">
              {unreadCount > 99
                ? "99+"
                : unreadCount}
            </span>
          )}
        </button>

        {activePopup ===
          "notifications" && (
          <div className="activity-popover notification-popover">
            <div className="activity-popover-header">
              <div>
                <strong>
                  Notifications
                </strong>

                <span>
                  {unreadCount} unread
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  setActivePopup(null)
                }
              >
                ×
              </button>
            </div>

            {notificationsError && (
              <div className="activity-popover-error">
                {
                  notificationsError
                }
              </div>
            )}

            {notificationsLoading ? (
              <div className="activity-popover-state">
                Loading notifications...
              </div>
            ) : notifications.length ===
              0 ? (
              <div className="activity-popover-empty">
                <strong>
                  No notifications
                </strong>

                <span>
                  Mentions and workspace
                  activity will appear here.
                </span>
              </div>
            ) : (
              <div className="activity-popover-list">
                {notifications
                  .slice(0, 15)
                  .map(
                    (notification) => {
                      const copy =
                        notificationCopy(
                          notification,
                        );

                      return (
                        <article
                          className={[
                            "notification-popover-item",
                            notification.is_read
                              ? "read"
                              : "unread",
                          ].join(" ")}
                          key={
                            notification.id
                          }
                        >
                          <button
                            className="notification-popover-main"
                            type="button"
                            onClick={() =>
                              openNotification(
                                notification,
                              )
                            }
                          >
                            <div className="activity-item-icon">
                              {
                                copy.icon
                              }
                            </div>

                            <div className="activity-item-copy">
                              <strong>
                                {
                                  copy.title
                                }
                              </strong>

                              <span>
                                {
                                  copy.description
                                }
                              </span>

                              <time>
                                {formatActivityDate(
                                  notification.created_at,
                                )}
                              </time>
                            </div>

                            {!notification.is_read && (
                              <i className="activity-unread-dot" />
                            )}
                          </button>

                          <button
                            className="activity-read-toggle"
                            type="button"
                            onClick={() =>
                              notification.is_read
                                ? markUnread(
                                    notification.id,
                                  )
                                : markRead(
                                    notification.id,
                                  )
                            }
                          >
                            {notification.is_read
                              ? "Unread"
                              : "Read"}
                          </button>
                        </article>
                      );
                    },
                  )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


export default HeaderActivityControls;