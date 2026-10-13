import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  apiRequest,
  readApiError,
} from "../api/client";
import PresenceStatusDot from "./PresenceStatusDot";
import UserAvatar from "./UserAvatar";


function CreateDirectConversationModal({
  open,
  user,
  onClose,
  onCreated,
}) {
  const [members, setMembers] =
    useState([]);

  const [type, setType] =
    useState("DIRECT");

  const [selectedIds, setSelectedIds] =
    useState([]);

  const [name, setName] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");


  useEffect(() => {
    if (!open) {
      setMembers([]);
      setSelectedIds([]);
      setType("DIRECT");
      setName("");
      setError("");
      setLoading(false);
      setSubmitting(false);

      return;
    }

    let cancelled = false;

    async function loadMembers() {
      setLoading(true);
      setError("");

      try {
        const response =
          await apiRequest(
            "/api/direct-conversations/participants/",
          );

        if (!response.ok) {
          throw new Error(
            await readApiError(
              response,
              "Unable to load available members.",
            ),
          );
        }

        const data =
          await response.json();

        if (cancelled) {
          return;
        }

        setMembers(
          data.filter(
            (member) =>
              member.user_id !==
              user.id,
          ),
        );
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError.message,
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMembers();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    user.id,
  ]);


  const selectedMembers =
    useMemo(
      () =>
        members.filter(
          (member) =>
            selectedIds.includes(
              member.user_id,
            ),
        ),
      [
        members,
        selectedIds,
      ],
    );


  if (!open) {
    return null;
  }


  function selectMember(
    memberId,
  ) {
    if (type === "DIRECT") {
      setSelectedIds([
        memberId,
      ]);

      return;
    }

    setSelectedIds(
      (currentIds) => {
        if (
          currentIds.includes(
            memberId,
          )
        ) {
          return currentIds.filter(
            (currentId) =>
              currentId !==
              memberId,
          );
        }

        return [
          ...currentIds,
          memberId,
        ];
      },
    );
  }


  function changeType(
    nextType,
  ) {
    setType(nextType);
    setSelectedIds([]);
    setName("");
    setError("");
  }


  async function handleSubmit(
    event,
  ) {
    event.preventDefault();

    setError("");

    if (
      type === "DIRECT" &&
      selectedIds.length !== 1
    ) {
      setError(
        "Select one member for a direct message.",
      );

      return;
    }

    if (
      type === "GROUP" &&
      selectedIds.length < 2
    ) {
      setError(
        "Select at least two members for a group conversation.",
      );

      return;
    }

    setSubmitting(true);

    try {
      const response =
        await apiRequest(
          "/api/direct-conversations/",
          {
            method: "POST",
            body: {
              type,
              participant_ids:
                selectedIds,
              name:
                type === "GROUP"
                  ? name.trim()
                  : "",
            },
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to create conversation.",
          ),
        );
      }

      const conversation =
        await response.json();

      onCreated(
        conversation,
      );

      onClose();
    } catch (requestError) {
      setError(
        requestError.message,
      );
    } finally {
      setSubmitting(false);
    }
  }


  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <section
        className="workspace-modal direct-conversation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-direct-conversation-title"
      >
        <div className="workspace-modal-header">
          <div>
            <span className="workspace-modal-eyebrow">
              Messages
            </span>

            <h2 id="create-direct-conversation-title">
              New conversation
            </h2>

            <p>
              Start a private conversation with people
              from your workspaces.
            </p>
          </div>

          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form
          className="workspace-form"
          onSubmit={handleSubmit}
        >
          <div className="dm-type-switch">
            <button
              className={
                type === "DIRECT"
                  ? "active"
                  : ""
              }
              type="button"
              onClick={() =>
                changeType(
                  "DIRECT",
                )
              }
            >
              Direct message
            </button>

            <button
              className={
                type === "GROUP"
                  ? "active"
                  : ""
              }
              type="button"
              onClick={() =>
                changeType(
                  "GROUP",
                )
              }
            >
              Group DM
            </button>
          </div>

          {type === "GROUP" && (
            <label className="form-field">
              <span>
                Group name
              </span>

              <input
                type="text"
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value,
                  )
                }
                placeholder="Backend team"
                maxLength={100}
              />
            </label>
          )}

          <div className="dm-member-picker">
            <div className="dm-member-picker-heading">
              <span>
                {type === "DIRECT"
                  ? "Choose a member"
                  : "Choose members"}
              </span>

              {selectedMembers.length >
                0 && (
                <small>
                  {
                    selectedMembers.length
                  } selected
                </small>
              )}
            </div>

            {loading && (
              <div className="dm-member-picker-state">
                Loading members...
              </div>
            )}

            {!loading &&
              members.length === 0 && (
                <div className="dm-member-picker-state">
                  No available members.
                </div>
              )}

            {!loading &&
              members.map(
                (member) => {
                  const selected =
                    selectedIds.includes(
                      member.user_id,
                    );

                  return (
                    <button
                      className={[
                        "dm-member-option",
                        selected
                          ? "selected"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      type="button"
                      key={
                        member.user_id
                      }
                      onClick={() =>
                        selectMember(
                          member.user_id,
                        )
                      }
                    >
                      <div className="presence-avatar-shell dm-member-avatar-shell">
                        <UserAvatar
                          className="dm-member-avatar"
                          username={
                            member.username
                          }
                          avatarUrl={
                            member.avatar_url
                          }
                        />

                        <PresenceStatusDot
                          userId={
                            member.user_id
                          }
                          status={
                            member.status
                          }
                        />
                      </div>

                      <div className="dm-member-copy">
                        <strong>
                          {member.username}
                        </strong>

                        <span>
                          {member.email}
                        </span>
                      </div>

                      <span className="dm-member-check">
                        {selected
                          ? "✓"
                          : ""}
                      </span>
                    </button>
                  );
                },
              )}
          </div>

          {error && (
            <div
              className="form-error"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="workspace-modal-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>

            <button
              className="primary-button workspace-create-submit"
              type="submit"
              disabled={
                submitting ||
                (
                  type === "DIRECT"
                    ? selectedIds.length !==
                      1
                    : selectedIds.length <
                      2
                )
              }
            >
              {submitting
                ? "Creating..."
                : "Start conversation"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}


export default CreateDirectConversationModal;
