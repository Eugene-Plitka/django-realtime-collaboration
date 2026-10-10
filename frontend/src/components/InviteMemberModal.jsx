import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  apiRequest,
  readApiError,
} from "../api/client";


function InviteMemberModal({
  open,
  workspace,
  workspaceRole,
  onClose,
  onInvited,
}) {
  const [email, setEmail] =
    useState("");

  const [role, setRole] =
    useState("MEMBER");

  const [error, setError] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);


  const availableRoles = useMemo(
    () => {
      if (
        workspaceRole === "OWNER"
      ) {
        return [
          "ADMIN",
          "MEMBER",
          "GUEST",
        ];
      }

      return [
        "MEMBER",
        "GUEST",
      ];
    },
    [workspaceRole],
  );


  useEffect(() => {
    if (!open) {
      setEmail("");
      setRole("MEMBER");
      setError("");
      setSubmitting(false);
    }
  }, [open]);


  if (!open || !workspace) {
    return null;
  }


  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSubmitting(true);

    try {
      const response =
        await apiRequest(
          `/api/workspaces/${workspace.id}/invitations/`,
          {
            method: "POST",
            body: {
              email,
              role,
            },
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to send invitation.",
          ),
        );
      }

      const invitation =
        await response.json();

      onInvited(invitation);
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
        className="workspace-modal invite-member-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-member-title"
      >
        <div className="workspace-modal-header">
          <div>
            <span className="workspace-modal-eyebrow">
              {workspace.name}
            </span>

            <h2 id="invite-member-title">
              Invite a member
            </h2>

            <p>
              Send a workspace invitation
              to an email address.
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
          <label className="form-field">
            <span>
              Email address
            </span>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value,
                )
              }
              placeholder="nick@example.com"
              autoComplete="email"
              autoFocus
              required
            />
          </label>

          <label className="form-field">
            <span>
              Workspace role
            </span>

            <select
              className="workspace-role-select"
              value={role}
              onChange={(event) =>
                setRole(
                  event.target.value,
                )
              }
            >
              {availableRoles.map(
                (availableRole) => (
                  <option
                    key={availableRole}
                    value={availableRole}
                  >
                    {availableRole}
                  </option>
                ),
              )}
            </select>
          </label>

          <div className="role-help">
            {role === "ADMIN" && (
              <p>
                Admins can manage channels,
                members and invitations.
              </p>
            )}

            {role === "MEMBER" && (
              <p>
                Members can access public
                channels and join them.
              </p>
            )}

            {role === "GUEST" && (
              <p>
                Guests only access channels
                where they are explicitly
                added.
              </p>
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
                !email.trim()
              }
            >
              {submitting
                ? "Sending..."
                : "Send invitation"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}


export default InviteMemberModal;