import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  apiRequest,
  readApiError,
} from "../api/client";
import UserAvatar from "./UserAvatar";


const STATUS_OPTIONS = [
  {
    value: "ONLINE",
    label: "Online",
    className: "online",
  },
  {
    value: "AWAY",
    label: "Away",
    className: "away",
  },
  {
    value: "DND",
    label: "Do Not Disturb",
    className: "dnd",
  },
];


function getStatusOption(
  status,
) {
  return (
    STATUS_OPTIONS.find(
      (option) =>
        option.value === status,
    ) ??
    STATUS_OPTIONS[0]
  );
}


function AccountConnectionsLauncher({
  user,
  logout,
  onEditProfile,
  onUserChanged,
}) {
  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    statusMenuOpen,
    setStatusMenuOpen,
  ] = useState(false);

  const [
    statusSaving,
    setStatusSaving,
  ] = useState(false);

  const [
    statusError,
    setStatusError,
  ] = useState("");

  const rootRef =
    useRef(null);


  const currentStatus =
    getStatusOption(
      user.status,
    );


  useEffect(() => {
    if (!open) {
      setStatusMenuOpen(false);
      setStatusError("");

      return undefined;
    }

    function handlePointerDown(
      event,
    ) {
      if (
        rootRef.current &&
        !rootRef.current.contains(
          event.target,
        )
      ) {
        setOpen(false);
      }
    }


    function handleKeyDown(
      event,
    ) {
      if (
        event.key === "Escape"
      ) {
        if (statusMenuOpen) {
          setStatusMenuOpen(false);
          return;
        }

        setOpen(false);
      }
    }


    document.addEventListener(
      "mousedown",
      handlePointerDown,
    );

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );


    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown,
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    open,
    statusMenuOpen,
  ]);


  function handleEditProfile() {
    setOpen(false);

    onEditProfile();
  }


  function handleLogout() {
    setOpen(false);

    logout();
  }


  async function updateStatus(
    nextStatus,
  ) {
    if (
      statusSaving ||
      nextStatus === user.status
    ) {
      setStatusMenuOpen(false);
      return;
    }

    setStatusSaving(true);
    setStatusError("");

    try {
      const response =
        await apiRequest(
          "/api/auth/me/",
          {
            method: "PATCH",
            body: {
              status:
                nextStatus,
            },
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to update status.",
          ),
        );
      }

      await onUserChanged();

      setStatusMenuOpen(false);
    } catch (requestError) {
      setStatusError(
        requestError.message,
      );
    } finally {
      setStatusSaving(false);
    }
  }


  return (
    <div
      className="user-menu-root"
      ref={rootRef}
    >
      <div
        className={[
          "user-menu-popover",
          open
            ? "open"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role="menu"
        aria-hidden={
          !open
        }
      >
        <div className="user-menu-heading">
          <UserAvatar
            className="user-menu-heading-avatar"
            username={
              user.username
            }
            avatarUrl={
              user.avatar_url
            }
          />

          <div>
            <strong>
              {user.username}
            </strong>

            <span>
              {user.email}
            </span>
          </div>
        </div>

        <div className="user-menu-divider" />

        <button
          className="user-menu-action"
          type="button"
          role="menuitem"
          tabIndex={
            open
              ? 0
              : -1
          }
          onClick={
            handleEditProfile
          }
        >
          <span className="user-menu-action-icon">
            P
          </span>

          <div>
            <strong>
              Edit Profile
            </strong>

            <small>
              Avatar, username and account
            </small>
          </div>
        </button>

        <button
          className={[
            "user-menu-action",
            statusMenuOpen
              ? "active"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          type="button"
          role="menuitem"
          tabIndex={
            open
              ? 0
              : -1
          }
          onClick={() =>
            setStatusMenuOpen(
              (current) =>
                !current,
            )
          }
        >
          <span
            className={[
              "user-menu-status-dot",
              currentStatus.className,
            ].join(" ")}
          />

          <div>
            <strong>
              Set Status
            </strong>

            <small>
              {currentStatus.label}
            </small>
          </div>

          <span
            className={[
              "user-menu-next",
              statusMenuOpen
                ? "open"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            ›
          </span>
        </button>

        <div
          className={[
            "user-status-options",
            statusMenuOpen
              ? "open"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {STATUS_OPTIONS.map(
            (option) => {
              const selected =
                option.value ===
                user.status;

              return (
                <button
                  className={[
                    "user-status-option",
                    selected
                      ? "selected"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  type="button"
                  key={
                    option.value
                  }
                  disabled={
                    statusSaving
                  }
                  tabIndex={
                    open &&
                    statusMenuOpen
                      ? 0
                      : -1
                  }
                  onClick={() =>
                    updateStatus(
                      option.value,
                    )
                  }
                >
                  <span
                    className={[
                      "user-status-option-dot",
                      option.className,
                    ].join(" ")}
                  />

                  <span>
                    {option.label}
                  </span>

                  {selected && (
                    <strong>
                      ✓
                    </strong>
                  )}
                </button>
              );
            },
          )}
        </div>

        {statusError && (
          <div className="user-status-error">
            {statusError}
          </div>
        )}

        <div className="user-menu-divider" />

        <button
          className="user-menu-action danger"
          type="button"
          role="menuitem"
          tabIndex={
            open
              ? 0
              : -1
          }
          onClick={
            handleLogout
          }
        >
          <span className="user-menu-action-icon">
            ↪
          </span>

          <div>
            <strong>
              Sign out
            </strong>

            <small>
              End this session
            </small>
          </div>
        </button>
      </div>

      <button
        className={[
          "dashboard-user",
          "dashboard-user-button",
          open
            ? "active"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
        type="button"
        aria-haspopup="menu"
        aria-expanded={
          open
        }
        onClick={() =>
          setOpen(
            (current) =>
              !current,
          )
        }
      >
        <div className="dashboard-avatar-shell">
          <UserAvatar
            className="dashboard-avatar"
            username={
              user.username
            }
            avatarUrl={
              user.avatar_url
            }
          />

          <span
            className={[
              "dashboard-user-status",
              currentStatus.className,
            ].join(" ")}
          />
        </div>

        <div className="dashboard-user-copy">
          <strong>
            {user.username}
          </strong>

          <span>
            {currentStatus.label}
          </span>
        </div>
      </button>
    </div>
  );
}


export default AccountConnectionsLauncher;