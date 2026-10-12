import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  apiRequest,
  readApiError,
} from "../api/client";


function WorkspaceActionsMenu({
  workspace,
  workspaceRole,
  onWorkspaceUpdated,
  onWorkspaceRemoved,
}) {
  const rootRef = useRef(null);

  const [open, setOpen] =
    useState(false);

  const [view, setView] =
    useState("menu");

  const [name, setName] =
    useState(
      workspace.name,
    );

  const [error, setError] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [leaving, setLeaving] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const [
    leaveConfirmation,
    setLeaveConfirmation,
  ] = useState(false);

  const [
    deleteConfirmation,
    setDeleteConfirmation,
  ] = useState(false);


  const canEdit =
    workspaceRole === "OWNER" ||
    workspaceRole === "ADMIN";

  const canDelete =
    workspaceRole === "OWNER";

  const canLeave =
    workspaceRole !== "OWNER";


  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (
        rootRef.current &&
        !rootRef.current.contains(
          event.target,
        )
      ) {
        setOpen(false);
        setView("menu");
        setError("");
        setLeaveConfirmation(false);
        setDeleteConfirmation(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
        setView("menu");
        setError("");
        setLeaveConfirmation(false);
        setDeleteConfirmation(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown,
    );

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown,
      );

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [open]);


  function closeMenu() {
    setOpen(false);
    setView("menu");
    setError("");
    setLeaveConfirmation(false);
    setDeleteConfirmation(false);
  }


  function toggleMenu() {
    setOpen(
      (currentOpen) =>
        !currentOpen,
    );

    setView("menu");
    setError("");
    setLeaveConfirmation(false);
    setDeleteConfirmation(false);
  }


  function openEditView() {
    setName(
      workspace.name,
    );

    setError("");
    setLeaveConfirmation(false);
    setDeleteConfirmation(false);
    setView("edit");
  }


  async function saveWorkspace() {
    const nextName =
      name.trim();

    if (!nextName) {
      setError(
        "Workspace name is required.",
      );

      return;
    }

    setSaving(true);
    setError("");

    try {
      const response =
        await apiRequest(
          `/api/workspaces/${workspace.id}/`,
          {
            method: "PATCH",
            body: {
              name: nextName,
            },
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to update workspace.",
          ),
        );
      }

      const data =
        await response.json();

      onWorkspaceUpdated({
        ...workspace,
        ...data,
      });

      closeMenu();
    } catch (requestError) {
      setError(
        requestError.message,
      );
    } finally {
      setSaving(false);
    }
  }


  async function leaveWorkspace() {
    if (
      !canLeave ||
      leaving
    ) {
      return;
    }

    setLeaving(true);
    setError("");

    try {
      const response =
        await apiRequest(
          `/api/workspaces/${workspace.id}/leave/`,
          {
            method: "POST",
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to leave workspace.",
          ),
        );
      }

      closeMenu();

      onWorkspaceRemoved(
        workspace,
      );
    } catch (requestError) {
      setError(
        requestError.message,
      );
    } finally {
      setLeaving(false);
    }
  }


  async function deleteWorkspace() {
    if (
      !canDelete ||
      deleting
    ) {
      return;
    }

    setDeleting(true);
    setError("");

    try {
      const response =
        await apiRequest(
          `/api/workspaces/${workspace.id}/`,
          {
            method: "DELETE",
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to delete workspace.",
          ),
        );
      }

      closeMenu();

      onWorkspaceRemoved(
        workspace,
      );
    } catch (requestError) {
      setError(
        requestError.message,
      );
    } finally {
      setDeleting(false);
    }
  }


  return (
    <div
      className="workspace-actions-root"
      ref={rootRef}
    >
      <button
        className="workspace-more-button"
        type="button"
        title="Workspace actions"
        aria-label={`Actions for ${workspace.name}`}
        aria-expanded={open}
        onClick={toggleMenu}
      >
        •••
      </button>

      {open && (
        <div className="workspace-actions-popover">
          {view === "menu" && (
            <>
              <div className="workspace-actions-heading">
                <div>
                  <strong>
                    {workspace.name}
                  </strong>

                  <span>
                    {workspaceRole}
                  </span>
                </div>

                <button
                  type="button"
                  aria-label="Close workspace actions"
                  onClick={closeMenu}
                >
                  ×
                </button>
              </div>

              {error && (
                <div className="workspace-actions-error">
                  {error}
                </div>
              )}

              <div className="workspace-actions-menu">
                {canEdit && (
                  <button
                    type="button"
                    onClick={
                      openEditView
                    }
                  >
                    <span>
                      Edit Workspace
                    </span>

                    <small>
                      Rename
                    </small>
                  </button>
                )}

                {canLeave &&
                  !leaveConfirmation && (
                    <button
                      className="danger"
                      type="button"
                      onClick={() => {
                        setDeleteConfirmation(
                          false,
                        );

                        setLeaveConfirmation(
                          true,
                        );
                      }}
                    >
                      <span>
                        Leave Workspace
                      </span>
                    </button>
                  )}

                {canLeave &&
                  leaveConfirmation && (
                    <div className="workspace-action-confirmation">
                      <span>
                        Leave workspace?
                      </span>

                      <div>
                        <button
                          className="confirm"
                          type="button"
                          title="Confirm leave"
                          aria-label="Confirm leave workspace"
                          disabled={
                            leaving
                          }
                          onClick={
                            leaveWorkspace
                          }
                        >
                          {leaving
                            ? "…"
                            : "✓"}
                        </button>

                        <button
                          className="cancel"
                          type="button"
                          title="Cancel"
                          aria-label="Cancel leaving workspace"
                          disabled={
                            leaving
                          }
                          onClick={() =>
                            setLeaveConfirmation(
                              false,
                            )
                          }
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )}

                {!canLeave && (
                  <button
                    type="button"
                    disabled
                  >
                    <span>
                      Leave Workspace
                    </span>

                    <small>
                      Transfer ownership first
                    </small>
                  </button>
                )}

                {canDelete &&
                  !deleteConfirmation && (
                    <button
                      className="danger"
                      type="button"
                      onClick={() => {
                        setLeaveConfirmation(
                          false,
                        );

                        setDeleteConfirmation(
                          true,
                        );
                      }}
                    >
                      <span>
                        Delete Workspace
                      </span>
                    </button>
                  )}

                {canDelete &&
                  deleteConfirmation && (
                    <div className="workspace-action-confirmation delete">
                      <span>
                        Delete permanently?
                      </span>

                      <div>
                        <button
                          className="confirm-danger"
                          type="button"
                          title="Confirm delete"
                          aria-label="Confirm delete workspace"
                          disabled={
                            deleting
                          }
                          onClick={
                            deleteWorkspace
                          }
                        >
                          {deleting
                            ? "…"
                            : "✓"}
                        </button>

                        <button
                          className="cancel"
                          type="button"
                          title="Cancel"
                          aria-label="Cancel deleting workspace"
                          disabled={
                            deleting
                          }
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
              <div className="workspace-actions-heading">
                <button
                  className="workspace-actions-back"
                  type="button"
                  aria-label="Back"
                  onClick={() => {
                    setError("");
                    setView("menu");
                  }}
                >
                  ←
                </button>

                <div>
                  <strong>
                    Edit Workspace
                  </strong>

                  <span>
                    Change workspace name
                  </span>
                </div>
              </div>

              {error && (
                <div className="workspace-actions-error">
                  {error}
                </div>
              )}

              <div className="workspace-edit-form">
                <label>
                  <span>
                    Workspace name
                  </span>

                  <input
                    type="text"
                    value={name}
                    maxLength={150}
                    autoFocus
                    onChange={(event) =>
                      setName(
                        event.target.value,
                      )
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key ===
                        "Enter"
                      ) {
                        saveWorkspace();
                      }
                    }}
                  />
                </label>

                <div className="workspace-edit-note">
                  The workspace slug stays unchanged.
                </div>

                <div className="workspace-edit-actions">
                  <button
                    className="secondary"
                    type="button"
                    disabled={
                      saving
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
                      saving ||
                      !name.trim()
                    }
                    onClick={
                      saveWorkspace
                    }
                  >
                    {saving
                      ? "Saving..."
                      : "Save changes"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}


export default WorkspaceActionsMenu;