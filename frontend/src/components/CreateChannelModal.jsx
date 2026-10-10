import {
  useEffect,
  useState,
} from "react";

import {
  apiRequest,
  readApiError,
} from "../api/client";


function normalizeChannelName(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "");
}


function CreateChannelModal({
  open,
  workspace,
  onClose,
  onCreated,
}) {
  const [name, setName] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [type, setType] =
    useState("PUBLIC");

  const [error, setError] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);


  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setType("PUBLIC");
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
      const response = await apiRequest(
        `/api/workspaces/${workspace.id}/channels/`,
        {
          method: "POST",
          body: {
            name,
            description,
            type,
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to create channel.",
          ),
        );
      }

      const channel =
        await response.json();

      onCreated(channel);
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
        className="workspace-modal channel-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-channel-title"
      >
        <div className="workspace-modal-header">
          <div>
            <span className="workspace-modal-eyebrow">
              {workspace.name}
            </span>

            <h2 id="create-channel-title">
              Create a channel
            </h2>

            <p>
              Channels organize conversations
              around a topic, project or team.
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
              Channel name
            </span>

            <div className="channel-name-field">
              <span>
                #
              </span>

              <input
                type="text"
                value={name}
                onChange={(event) =>
                  setName(
                    normalizeChannelName(
                      event.target.value,
                    ),
                  )
                }
                placeholder="backend"
                maxLength={100}
                autoFocus
                required
              />
            </div>
          </label>

          <label className="form-field">
            <span>
              Description
            </span>

            <textarea
              className="channel-description-input"
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value,
                )
              }
              placeholder="What is this channel about?"
              rows={4}
            />
          </label>

          <fieldset className="channel-type-fieldset">
            <legend>
              Channel type
            </legend>

            <label
              className={[
                "channel-type-option",
                type === "PUBLIC"
                  ? "selected"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <input
                type="radio"
                name="channel-type"
                value="PUBLIC"
                checked={
                  type === "PUBLIC"
                }
                onChange={() =>
                  setType("PUBLIC")
                }
              />

              <div className="channel-type-icon">
                #
              </div>

              <div>
                <strong>
                  Public
                </strong>

                <span>
                  Visible to workspace members.
                </span>
              </div>
            </label>

            <label
              className={[
                "channel-type-option",
                type === "PRIVATE"
                  ? "selected"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <input
                type="radio"
                name="channel-type"
                value="PRIVATE"
                checked={
                  type === "PRIVATE"
                }
                onChange={() =>
                  setType("PRIVATE")
                }
              />

              <div className="channel-type-icon">
                🔒
              </div>

              <div>
                <strong>
                  Private
                </strong>

                <span>
                  Only explicit members can access it.
                </span>
              </div>
            </label>
          </fieldset>

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
                !name.trim()
              }
            >
              {submitting
                ? "Creating..."
                : "Create channel"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}


export default CreateChannelModal;