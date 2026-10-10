import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  apiRequest,
  readApiError,
} from "../api/client";
import { useAuth } from "../auth/AuthContext";
import CreateWorkspaceModal from "../components/CreateWorkspaceModal";


function workspaceInitial(workspace) {
  return (
    workspace.name
      ?.trim()
      .slice(0, 1)
      .toUpperCase() || "W"
  );
}


function DashboardPage() {
  const {
    user,
    logout,
  } = useAuth();

  const [workspaces, setWorkspaces] =
    useState([]);

  const [
    activeWorkspace,
    setActiveWorkspace,
  ] = useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    createModalOpen,
    setCreateModalOpen,
  ] = useState(false);


  const loadWorkspaces = useCallback(
    async () => {
      setLoading(true);
      setError("");

      try {
        const response = await apiRequest(
          "/api/workspaces/",
        );

        if (!response.ok) {
          throw new Error(
            await readApiError(
              response,
              "Unable to load workspaces.",
            ),
          );
        }

        const data =
          await response.json();

        setWorkspaces(data);

        setActiveWorkspace(
          (currentWorkspace) => {
            if (!data.length) {
              return null;
            }

            if (currentWorkspace) {
              const existing =
                data.find(
                  (workspace) =>
                    workspace.id ===
                    currentWorkspace.id,
                );

              if (existing) {
                return existing;
              }
            }

            return data[0];
          },
        );
      } catch (requestError) {
        setError(
          requestError.message,
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );


  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);


  function handleWorkspaceCreated(
    workspace,
  ) {
    setWorkspaces(
      (currentWorkspaces) => [
        ...currentWorkspaces,
        workspace,
      ],
    );

    setActiveWorkspace(
      workspace,
    );
  }


  return (
    <>
      <main className="dashboard-page">
        <aside className="workspace-rail">
          <div
            className="workspace-logo"
            title="CollabSpace"
          >
            C
          </div>

          <div className="workspace-rail-list">
            {workspaces.map(
              (
                workspace,
                index,
              ) => (
                <button
                  className={[
                    "workspace-item",
                    `workspace-tone-${
                      index % 5
                    }`,
                    activeWorkspace?.id ===
                    workspace.id
                      ? "active"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  type="button"
                  key={workspace.id}
                  title={workspace.name}
                  onClick={() =>
                    setActiveWorkspace(
                      workspace,
                    )
                  }
                >
                  {workspaceInitial(
                    workspace,
                  )}
                </button>
              ),
            )}
          </div>

          <button
            className="workspace-add"
            type="button"
            title="Create workspace"
            aria-label="Create workspace"
            onClick={() =>
              setCreateModalOpen(
                true,
              )
            }
          >
            +
          </button>
        </aside>

        <section className="dashboard-sidebar">
          <div className="dashboard-brand">
            <span className="status-dot" />

            CollabSpace
          </div>

          {activeWorkspace ? (
            <div className="active-workspace-summary">
              <span className="active-workspace-label">
                Workspace
              </span>

              <strong>
                {activeWorkspace.name}
              </strong>

              <span>
                /{activeWorkspace.slug}
              </span>
            </div>
          ) : (
            <div className="active-workspace-summary muted">
              <span className="active-workspace-label">
                Workspace
              </span>

              <strong>
                No workspace selected
              </strong>
            </div>
          )}

          <nav className="dashboard-nav">
            <button
              className="nav-item active"
              type="button"
            >
              Overview
            </button>

            <button
              className="nav-item"
              type="button"
              disabled={!activeWorkspace}
            >
              Channels
            </button>

            <button
              className="nav-item"
              type="button"
              disabled={!activeWorkspace}
            >
              Members
            </button>

            <button
              className="nav-item"
              type="button"
            >
              Notifications
            </button>
          </nav>

          <div className="dashboard-user">
            <div className="dashboard-avatar">
              {user.username
                .slice(0, 1)
                .toUpperCase()}
            </div>

            <div>
              <strong>
                {user.username}
              </strong>

              <span>
                {user.email}
              </span>
            </div>
          </div>

          <button
            className="logout-button"
            type="button"
            onClick={logout}
          >
            Sign out
          </button>
        </section>

        <section className="dashboard-content">
          <div className="dashboard-topbar">
            <div>
              <span className="dashboard-eyebrow">
                Workspace hub
              </span>

              <h1>
                {activeWorkspace
                  ? activeWorkspace.name
                  : "Your workspaces"}
              </h1>
            </div>

            <div className="dashboard-topbar-actions">
              <div className="online-pill">
                <span />

                Online
              </div>

              <button
                className="topbar-create-button"
                type="button"
                onClick={() =>
                  setCreateModalOpen(
                    true,
                  )
                }
              >
                + New workspace
              </button>
            </div>
          </div>

          {loading && (
            <div className="workspace-state">
              <div className="state-spinner" />

              <h2>
                Loading workspaces
              </h2>

              <p>
                Fetching your team spaces
                from the server.
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="workspace-state">
              <div className="state-icon error">
                !
              </div>

              <h2>
                Could not load workspaces
              </h2>

              <p>
                {error}
              </p>

              <button
                className="primary-button state-action"
                type="button"
                onClick={loadWorkspaces}
              >
                Try again
              </button>
            </div>
          )}

          {!loading &&
            !error &&
            workspaces.length === 0 && (
              <div className="workspace-state">
                <div className="state-icon">
                  W
                </div>

                <h2>
                  Create your first workspace
                </h2>

                <p>
                  Workspaces organize your
                  team, channels, members and
                  real-time conversations.
                </p>

                <button
                  className="primary-button state-action"
                  type="button"
                  onClick={() =>
                    setCreateModalOpen(
                      true,
                    )
                  }
                >
                  Create workspace
                </button>
              </div>
            )}

          {!loading &&
            !error &&
            activeWorkspace && (
              <div className="workspace-overview">
                <section className="workspace-hero">
                  <div className="workspace-hero-icon">
                    {workspaceInitial(
                      activeWorkspace,
                    )}
                  </div>

                  <div className="workspace-hero-copy">
                    <span>
                      Active workspace
                    </span>

                    <h2>
                      {activeWorkspace.name}
                    </h2>

                    <p>
                      /{activeWorkspace.slug}
                    </p>
                  </div>

                  <button
                    className="primary-button workspace-open-button"
                    type="button"
                    disabled
                    title="Channels will be connected on the next step."
                  >
                    Open channels
                  </button>
                </section>

                <div className="workspace-card-grid">
                  <article className="workspace-info-card">
                    <div className="workspace-card-icon">
                      #
                    </div>

                    <div>
                      <span>
                        Channels
                      </span>

                      <strong>
                        Ready to connect
                      </strong>

                      <p>
                        The next step will load
                        real public and private
                        channels.
                      </p>
                    </div>
                  </article>

                  <article className="workspace-info-card">
                    <div className="workspace-card-icon">
                      M
                    </div>

                    <div>
                      <span>
                        Members
                      </span>

                      <strong>
                        Team access
                      </strong>

                      <p>
                        Owner, admin, member and
                        guest roles are already
                        supported by the API.
                      </p>
                    </div>
                  </article>

                  <article className="workspace-info-card">
                    <div className="workspace-card-icon">
                      N
                    </div>

                    <div>
                      <span>
                        Notifications
                      </span>

                      <strong>
                        Real-time ready
                      </strong>

                      <p>
                        Persistent notifications,
                        WebSocket delivery and
                        Celery email are already
                        available.
                      </p>
                    </div>
                  </article>
                </div>

                <section className="workspace-details-card">
                  <div>
                    <span>
                      Workspace ID
                    </span>

                    <strong>
                      {activeWorkspace.id}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Slug
                    </span>

                    <strong>
                      {activeWorkspace.slug}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Created
                    </span>

                    <strong>
                      {new Date(
                        activeWorkspace.created_at,
                      ).toLocaleDateString()}
                    </strong>
                  </div>
                </section>
              </div>
            )}
        </section>
      </main>

      <CreateWorkspaceModal
        open={createModalOpen}
        onClose={() =>
          setCreateModalOpen(false)
        }
        onCreated={
          handleWorkspaceCreated
        }
      />
    </>
  );
}


export default DashboardPage;