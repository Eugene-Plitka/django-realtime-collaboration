import { useAuth } from "../auth/AuthContext";


function DashboardPage() {
  const {
    user,
    logout,
  } = useAuth();


  return (
    <main className="dashboard-page">
      <aside className="workspace-rail">
        <div className="workspace-logo">
          C
        </div>

        <button
          className="workspace-item active"
          type="button"
        >
          A
        </button>

        <button
          className="workspace-item"
          type="button"
        >
          T
        </button>

        <button
          className="workspace-add"
          type="button"
        >
          +
        </button>
      </aside>

      <section className="dashboard-sidebar">
        <div className="dashboard-brand">
          <span className="status-dot" />

          CollabSpace
        </div>

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

        <nav className="dashboard-nav">
          <button
            className="nav-item active"
            type="button"
          >
            Home
          </button>

          <button
            className="nav-item"
            type="button"
          >
            Mentions
          </button>

          <button
            className="nav-item"
            type="button"
          >
            Notifications
          </button>
        </nav>

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
              Authentication connected
            </span>

            <h1>
              Welcome, {user.username}
            </h1>
          </div>

          <div className="online-pill">
            <span />

            Online
          </div>
        </div>

        <div className="dashboard-empty">
          <div className="empty-icon">
            #
          </div>

          <h2>
            Your workspace is next
          </h2>

          <p>
            Authentication is now connected
            to Django. The next step is loading
            real workspaces and channels from
            the API.
          </p>
        </div>
      </section>
    </main>
  );
}


export default DashboardPage;