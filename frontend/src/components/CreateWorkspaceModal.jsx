import {
  useEffect,
  useState,
} from "react";

import {
  apiRequest,
  readApiError,
} from "../api/client";


function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}


function CreateWorkspaceModal({
  open,
  onClose,
  onCreated,
}) {
  const [name, setName] =
    useState("");

  const [slug, setSlug] =
    useState("");

  const [slugEdited, setSlugEdited] =
    useState(false);

  const [error, setError] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);


  useEffect(() => {
    if (!open) {
      setName("");
      setSlug("");
      setSlugEdited(false);
      setError("");
      setSubmitting(false);
    }
  }, [open]);


  if (!open) {
    return null;
  }


  function handleNameChange(event) {
    const nextName = event.target.value;

    setName(nextName);

    if (!slugEdited) {
      setSlug(
        slugify(nextName),
      );
    }
  }


  function handleSlugChange(event) {
    setSlugEdited(true);

    setSlug(
      slugify(event.target.value),
    );
  }


  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSubmitting(true);

    try {
      const response = await apiRequest(
        "/api/workspaces/",
        {
          method: "POST",
          body: {
            name,
            slug,
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to create workspace.",
          ),
        );
      }

      const workspace =
        await response.json();

      onCreated(workspace);
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
        className="workspace-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-workspace-title"
      >
        <div className="workspace-modal-header">
          <div>
            <span className="workspace-modal-eyebrow">
              New workspace
            </span>

            <h2
              id="create-workspace-title"
            >
              Create a workspace
            </h2>

            <p>
              A workspace keeps your team,
              channels and conversations
              together.
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
              Workspace name
            </span>

            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="Acme Development"
              maxLength={150}
              autoFocus
              required
            />
          </label>

          <label className="form-field">
            <span>
              Workspace slug
            </span>

            <div className="slug-field">
              <span>
                /
              </span>

              <input
                type="text"
                value={slug}
                onChange={handleSlugChange}
                placeholder="acme-development"
                required
              />
            </div>
          </label>

          <p className="workspace-form-hint">
            The slug must be unique and is
            generated automatically from the
            workspace name. You can edit it.
          </p>

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
                !name.trim() ||
                !slug.trim()
              }
            >
              {submitting
                ? "Creating..."
                : "Create workspace"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}


export default CreateWorkspaceModal;