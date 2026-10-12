import {
  useEffect,
  useRef,
  useState,
} from "react";

import UserAvatar from "./UserAvatar";


function AccountConnectionsLauncher({
  user,
  logout,
  onEditProfile,
}) {
  const [
    open,
    setOpen,
  ] = useState(false);

  const rootRef =
    useRef(null);


  useEffect(() => {
    if (!open) {
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
  ]);


  function handleEditProfile() {
    setOpen(false);

    onEditProfile();
  }


  function handleLogout() {
    setOpen(false);

    logout();
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
          className="user-menu-action"
          type="button"
          role="menuitem"
          disabled
          tabIndex="-1"
        >
          <span className="user-menu-status-dot online" />

          <div>
            <strong>
              Set Status
            </strong>

            <small>
              Online · coming next
            </small>
          </div>

          <span className="user-menu-next">
            ›
          </span>
        </button>

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

          <span className="dashboard-user-status online" />
        </div>

        <div className="dashboard-user-copy">
          <strong>
            {user.username}
          </strong>

          <span>
            Online
          </span>
        </div>
      </button>
    </div>
  );
}


export default AccountConnectionsLauncher;