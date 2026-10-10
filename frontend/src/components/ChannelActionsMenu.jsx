import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  apiRequest,
  readApiError,
} from "../api/client";


function initial(username) {
  return (
    username
      ?.slice(0, 1)
      .toUpperCase() ?? "?"
  );
}


function ChannelActionsMenu({
  channel,
  workspace,
  user,
  workspaceRole,
  onLeftChannel,
  onChannelUpdated,
  onChannelDeleted,
}) {
  const [open, setOpen] =
    useState(false);

  const [view, setView] =
    useState("menu");

  const [
    channelMembers,
    setChannelMembers,
  ] = useState([]);

  const [
    workspaceMembers,
    setWorkspaceMembers,
  ] = useState([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    workingMemberId,
    setWorkingMemberId,
  ] = useState(null);

  const [
    leaving,
    setLeaving,
  ] = useState(false);

  const [
    savingChannel,
    setSavingChannel,
  ] = useState(false);

  const [
    deletingChannel,
    setDeletingChannel,
  ] = useState(false);

  const [
    deleteConfirmation,
    setDeleteConfirmation,
  ] = useState(false);

  const [
    editName,
    setEditName,
  ] = useState(
    channel.name,
  );

  const [
    editDescription,
    setEditDescription,
  ] = useState(
    channel.description ?? "",
  );

  const [
    popupPosition,
    setPopupPosition,
  ] = useState({
    top: 0,
    left: 0,
  });

  const rootRef =
    useRef(null);

  const triggerRef =
    useRef(null);

  const popupRef =
    useRef(null);


  const canManageChannel =
    workspaceRole === "OWNER" ||
    workspaceRole === "ADMIN";


  const canManageMembers =
    canManageChannel;


  const currentMembership =
    useMemo(
      () =>
        channelMembers.find(
          (membership) =>
            membership.user_id ===
            user.id,
        ) ?? null,
      [
        channelMembers,
        user.id,
      ],
    );


  const availableWorkspaceMembers =
    useMemo(
      () => {
        const memberIds =
          new Set(
            channelMembers.map(
              (membership) =>
                membership.user_id,
            ),
          );

        return workspaceMembers.filter(
          (member) =>
            !memberIds.has(
              member.user_id,
            ),
        );
      },
      [
        channelMembers,
        workspaceMembers,
      ],
    );


  const updatePopupPosition =
    useCallback(() => {
      const trigger =
        triggerRef.current;

      if (!trigger) {
        return;
      }

      const rect =
        trigger.getBoundingClientRect();

      const popupWidth = 370;
      const viewportPadding = 12;
      const gap = 8;

      let left =
        rect.left;

      if (
        left +
          popupWidth +
          viewportPadding >
        window.innerWidth
      ) {
        left =
          window.innerWidth -
          popupWidth -
          viewportPadding;
      }

      left = Math.max(
        viewportPadding,
        left,
      );

      let top =
        rect.bottom + gap;

      const estimatedHeight = 430;

      if (
        top +
          estimatedHeight +
          viewportPadding >
          window.innerHeight &&
        rect.top >
          estimatedHeight
      ) {
        top =
          rect.top -
          estimatedHeight -
          gap;
      }

      setPopupPosition({
        top,
        left,
      });
    }, []);


  const loadData =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const [
            channelMembersResponse,
            workspaceMembersResponse,
          ] = await Promise.all([
            apiRequest(
              `/api/channels/${channel.id}/members/`,
            ),
            apiRequest(
              `/api/workspaces/${workspace.id}/members/`,
            ),
          ]);

          if (
            !channelMembersResponse.ok
          ) {
            throw new Error(
              await readApiError(
                channelMembersResponse,
                "Unable to load channel members.",
              ),
            );
          }

          if (
            !workspaceMembersResponse.ok
          ) {
            throw new Error(
              await readApiError(
                workspaceMembersResponse,
                "Unable to load workspace members.",
              ),
            );
          }

          const [
            channelMemberData,
            workspaceMemberData,
          ] = await Promise.all([
            channelMembersResponse.json(),
            workspaceMembersResponse.json(),
          ]);

          setChannelMembers(
            channelMemberData,
          );

          setWorkspaceMembers(
            workspaceMemberData,
          );
        } catch (requestError) {
          setError(
            requestError.message,
          );
        } finally {
          setLoading(false);
        }
      },
      [
        channel.id,
        workspace.id,
      ],
    );


  useEffect(() => {
    setEditName(
      channel.name,
    );

    setEditDescription(
      channel.description ?? "",
    );
  }, [
    channel.name,
    channel.description,
  ]);


  useEffect(() => {
    function handleOutsideClick(
      event,
    ) {
      const clickedTrigger =
        rootRef.current?.contains(
          event.target,
        );

      const clickedPopup =
        popupRef.current?.contains(
          event.target,
        );

      if (
        !clickedTrigger &&
        !clickedPopup
      ) {
        setOpen(false);
        setView("menu");
        setDeleteConfirmation(
          false,
        );
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );
    };
  }, []);


  useEffect(() => {
    if (!open) {
      return;
    }

    updatePopupPosition();
    loadData();

    function handleViewportChange() {
      updatePopupPosition();
    }

    window.addEventListener(
      "resize",
      handleViewportChange,
    );

    window.addEventListener(
      "scroll",
      handleViewportChange,
      true,
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleViewportChange,
      );

      window.removeEventListener(
        "scroll",
        handleViewportChange,
        true,
      );
    };
  }, [
    open,
    loadData,
    updatePopupPosition,
  ]);


  function toggleMenu(event) {
    event.stopPropagation();

    if (!open) {
      updatePopupPosition();
    }

    setOpen(
      (currentOpen) =>
        !currentOpen,
    );

    setView("menu");
    setError("");
    setDeleteConfirmation(false);
  }


  function closeMenu() {
    setOpen(false);
    setView("menu");
    setError("");
    setDeleteConfirmation(false);
  }


  function openEditView() {
    setEditName(
      channel.name,
    );

    setEditDescription(
      channel.description ?? "",
    );

    setError("");
    setDeleteConfirmation(false);
    setView("edit");
  }


  async function saveChannel() {
    const name =
      editName.trim();

    const description =
      editDescription.trim();

    if (!name) {
      setError(
        "Channel name is required.",
      );
      return;
    }

    setSavingChannel(true);
    setError("");

    try {
      const response =
        await apiRequest(
          `/api/channels/${channel.id}/`,
          {
            method: "PATCH",
            body: {
              name,
              description,
            },
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to update channel.",
          ),
        );
      }

      const updatedChannel =
        await response.json();

      onChannelUpdated(
        updatedChannel,
      );

      setView("menu");
    } catch (requestError) {
      setError(
        requestError.message,
      );
    } finally {
      setSavingChannel(false);
    }
  }


  async function deleteChannel() {
    if (
      channel.is_general ||
      deletingChannel
    ) {
      return;
    }

    setDeletingChannel(true);
    setError("");

    try {
      const response =
        await apiRequest(
          `/api/channels/${channel.id}/`,
          {
            method: "DELETE",
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to delete channel.",
          ),
        );
      }

      closeMenu();

      await onChannelDeleted(
        channel,
      );
    } catch (requestError) {
      setError(
        requestError.message,
      );
    } finally {
      setDeletingChannel(false);
    }
  }


  async function addMember(
    member,
  ) {
    setWorkingMemberId(
      member.user_id,
    );

    setError("");

    try {
      const response =
        await apiRequest(
          `/api/channels/${channel.id}/members/`,
          {
            method: "POST",
            body: {
              user_id:
                member.user_id,
            },
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to add member.",
          ),
        );
      }

      const membership =
        await response.json();

      setChannelMembers(
        (currentMembers) => [
          ...currentMembers,
          membership,
        ],
      );
    } catch (requestError) {
      setError(
        requestError.message,
      );
    } finally {
      setWorkingMemberId(null);
    }
  }


  async function removeMember(
    membership,
  ) {
    setWorkingMemberId(
      membership.user_id,
    );

    setError("");

    try {
      const response =
        await apiRequest(
          `/api/channels/${channel.id}/members/${membership.id}/`,
          {
            method: "DELETE",
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to remove member.",
          ),
        );
      }

      setChannelMembers(
        (currentMembers) =>
          currentMembers.filter(
            (currentMembership) =>
              currentMembership.id !==
              membership.id,
          ),
      );
    } catch (requestError) {
      setError(
        requestError.message,
      );
    } finally {
      setWorkingMemberId(null);
    }
  }


  async function leaveChannel() {
    setLeaving(true);
    setError("");

    try {
      const response =
        await apiRequest(
          `/api/channels/${channel.id}/leave/`,
          {
            method: "POST",
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to leave channel.",
          ),
        );
      }

      closeMenu();

      await onLeftChannel(
        channel,
      );
    } catch (requestError) {
      setError(
        requestError.message,
      );
    } finally {
      setLeaving(false);
    }
  }


  const popup = open
    ? createPortal(
        <div
          ref={popupRef}
          className="channel-actions-popover channel-actions-portal"
          style={{
            top:
              popupPosition.top,
            left:
              popupPosition.left,
          }}
        >
          {view === "menu" && (
            <>
              <div className="channel-actions-heading">
                <div>
                  <strong>
                    {channel.type ===
                    "PRIVATE"
                      ? "🔒 "
                      : "# "}
                    {channel.name}
                  </strong>

                  <span>
                    {channel.type ===
                    "PRIVATE"
                      ? "Private channel"
                      : "Public channel"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={
                    closeMenu
                  }
                >
                  ×
                </button>
              </div>

              {error && (
                <div className="channel-actions-error">
                  {error}
                </div>
              )}

              <div className="channel-actions-menu">
                <button
                  type="button"
                  onClick={() =>
                    setView(
                      "members",
                    )
                  }
                >
                  <span>
                    Members
                  </span>

                  <small>
                    {
                      channelMembers.length
                    }
                  </small>
                </button>

                {channel.type ===
                  "PRIVATE" &&
                  canManageMembers && (
                    <button
                      type="button"
                      onClick={() =>
                        setView(
                          "add",
                        )
                      }
                    >
                      <span>
                        Add members
                      </span>

                      <small>
                        +
                      </small>
                    </button>
                  )}

                {canManageChannel && (
                  <button
                    type="button"
                    onClick={
                      openEditView
                    }
                  >
                    <span>
                      Edit channel
                    </span>
                  </button>
                )}

                {currentMembership &&
                  !channel.is_general && (
                    <button
                      className="danger"
                      type="button"
                      disabled={leaving}
                      onClick={
                        leaveChannel
                      }
                    >
                      <span>
                        {leaving
                          ? "Leaving..."
                          : "Leave channel"}
                      </span>
                    </button>
                  )}

                {canManageChannel &&
                  !channel.is_general &&
                  !deleteConfirmation && (
                    <button
                      className="danger"
                      type="button"
                      onClick={() =>
                        setDeleteConfirmation(
                          true,
                        )
                      }
                    >
                      <span>
                        Delete channel
                      </span>
                    </button>
                  )}

                {canManageChannel &&
                  !channel.is_general &&
                  deleteConfirmation && (
                    <div className="channel-delete-confirmation">
                      <span>
                        Delete channel?
                      </span>

                      <div>
                        <button
                          className="confirm"
                          type="button"
                          disabled={
                            deletingChannel
                          }
                          title="Confirm delete"
                          onClick={
                            deleteChannel
                          }
                        >
                          ✓
                        </button>

                        <button
                          className="cancel"
                          type="button"
                          disabled={
                            deletingChannel
                          }
                          title="Cancel delete"
                          onClick={() =>
                            setDeleteConfirmation(
                              false,
                            )
                          }
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )}
              </div>
            </>
          )}

          {view === "edit" && (
            <>
              <div className="channel-actions-heading">
                <button
                  className="channel-actions-back"
                  type="button"
                  onClick={() => {
                    setError("");
                    setView("menu");
                  }}
                >
                  ←
                </button>

                <div>
                  <strong>
                    Edit channel
                  </strong>

                  <span>
                    {channel.type ===
                    "PRIVATE"
                      ? "Private channel"
                      : "Public channel"}
                  </span>
                </div>
              </div>

              {error && (
                <div className="channel-actions-error">
                  {error}
                </div>
              )}

              <div className="channel-edit-form">
                <label>
                  <span>
                    Channel name
                  </span>

                  <input
                    type="text"
                    value={editName}
                    maxLength={100}
                    autoFocus
                    onChange={(event) =>
                      setEditName(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Description
                  </span>

                  <textarea
                    value={
                      editDescription
                    }
                    rows={4}
                    onChange={(event) =>
                      setEditDescription(
                        event.target.value,
                      )
                    }
                  />
                </label>

                {channel.is_general && (
                  <div className="channel-edit-note">
                    #general is a protected
                    workspace channel and
                    cannot be deleted.
                  </div>
                )}

                <div className="channel-edit-actions">
                  <button
                    className="secondary"
                    type="button"
                    disabled={
                      savingChannel
                    }
                    onClick={() => {
                      setError("");
                      setView("menu");
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    className="primary"
                    type="button"
                    disabled={
                      savingChannel ||
                      !editName.trim()
                    }
                    onClick={
                      saveChannel
                    }
                  >
                    {savingChannel
                      ? "Saving..."
                      : "Save changes"}
                  </button>
                </div>
              </div>
            </>
          )}

          {view === "members" && (
            <>
              <div className="channel-actions-heading">
                <button
                  className="channel-actions-back"
                  type="button"
                  onClick={() =>
                    setView(
                      "menu",
                    )
                  }
                >
                  ←
                </button>

                <div>
                  <strong>
                    Channel members
                  </strong>

                  <span>
                    {
                      channelMembers.length
                    }{" "}
                    members
                  </span>
                </div>
              </div>

              {error && (
                <div className="channel-actions-error">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="channel-actions-state">
                  Loading members...
                </div>
              ) : (
                <div className="channel-member-list">
                  {channelMembers.map(
                    (membership) => (
                      <div
                        className="channel-member-row"
                        key={
                          membership.id
                        }
                      >
                        <div className="channel-member-avatar">
                          {initial(
                            membership.username,
                          )}
                        </div>

                        <div className="channel-member-copy">
                          <strong>
                            {
                              membership.username
                            }

                            {membership.user_id ===
                              user.id && (
                                <small>
                                  you
                                </small>
                              )}
                          </strong>

                          <span>
                            {
                              membership.email
                            }
                          </span>
                        </div>

                        {canManageMembers &&
                          membership.user_id !==
                            user.id &&
                          !channel.is_general && (
                            <button
                              className="channel-member-remove"
                              type="button"
                              disabled={
                                workingMemberId ===
                                membership.user_id
                              }
                              onClick={() =>
                                removeMember(
                                  membership,
                                )
                              }
                            >
                              Remove
                            </button>
                          )}
                      </div>
                    ),
                  )}
                </div>
              )}
            </>
          )}

          {view === "add" && (
            <>
              <div className="channel-actions-heading">
                <button
                  className="channel-actions-back"
                  type="button"
                  onClick={() =>
                    setView(
                      "menu",
                    )
                  }
                >
                  ←
                </button>

                <div>
                  <strong>
                    Add members
                  </strong>

                  <span>
                    Workspace members
                  </span>
                </div>
              </div>

              {error && (
                <div className="channel-actions-error">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="channel-actions-state">
                  Loading members...
                </div>
              ) : availableWorkspaceMembers.length ===
                0 ? (
                <div className="channel-actions-state">
                  Everyone in this workspace
                  is already in the channel.
                </div>
              ) : (
                <div className="channel-member-list">
                  {availableWorkspaceMembers.map(
                    (member) => (
                      <div
                        className="channel-member-row"
                        key={
                          member.user_id
                        }
                      >
                        <div className="channel-member-avatar">
                          {initial(
                            member.username,
                          )}
                        </div>

                        <div className="channel-member-copy">
                          <strong>
                            {
                              member.username
                            }
                          </strong>

                          <span>
                            {
                              member.email
                            }
                          </span>
                        </div>

                        <button
                          className="channel-member-add"
                          type="button"
                          disabled={
                            workingMemberId ===
                            member.user_id
                          }
                          onClick={() =>
                            addMember(
                              member,
                            )
                          }
                        >
                          {workingMemberId ===
                          member.user_id
                            ? "..."
                            : "Add"}
                        </button>
                      </div>
                    ),
                  )}
                </div>
              )}
            </>
          )}
        </div>,
        document.body,
      )
    : null;


  return (
    <>
      <div
        className={[
          "channel-actions-root",
          open
            ? "open"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
        ref={rootRef}
      >
        <button
          ref={triggerRef}
          className="channel-more-button"
          type="button"
          title="Channel actions"
          aria-label={`Actions for ${channel.name}`}
          onClick={toggleMenu}
        >
          •••
        </button>
      </div>

      {popup}
    </>
  );
}


export default ChannelActionsMenu;