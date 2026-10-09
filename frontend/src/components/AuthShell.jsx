function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
}) {
  return (
    <main className="auth-page">
      <section className="auth-showcase">
        <div className="brand-row">
          <div className="brand-mark">
            C
          </div>

          <span>
            CollabSpace
          </span>
        </div>

        <div className="showcase-content">
          <span className="showcase-badge">
            Real-time collaboration
          </span>

          <h1>
            Where teams move
            work forward.
          </h1>

          <p>
            Channels, conversations,
            notifications and collaboration
            in one focused workspace.
          </p>

          <div className="workspace-preview">
            <div className="preview-rail">
              <div className="preview-workspace active">
                A
              </div>

              <div className="preview-workspace">
                T
              </div>

              <div className="preview-workspace green">
                D
              </div>

              <div className="preview-add">
                +
              </div>
            </div>

            <div className="preview-sidebar">
              <strong>
                Acme Development
              </strong>

              <span className="preview-meta">
                12 members ·
                <i />
                Online
              </span>

              <div className="preview-label">
                Channels
              </div>

              <div className="preview-channel">
                # general
              </div>

              <div className="preview-channel selected">
                # backend
              </div>

              <div className="preview-channel">
                # frontend
              </div>

              <div className="preview-channel">
                # devops
              </div>
            </div>

            <div className="preview-chat">
              <div className="preview-chat-header">
                <div>
                  <strong>
                    # backend
                  </strong>

                  <span>
                    Backend development
                    and infrastructure
                  </span>
                </div>

                <span>
                  •••
                </span>
              </div>

              <div className="preview-message">
                <div className="avatar">
                  A
                </div>

                <div>
                  <strong>
                    Alex
                  </strong>

                  <p>
                    Real-time events
                    are working reliably.
                  </p>
                </div>
              </div>

              <div className="preview-message">
                <div className="avatar alt">
                  M
                </div>

                <div>
                  <strong>
                    Maria
                  </strong>

                  <p>
                    WebSocket connection
                    looks stable.
                  </p>
                </div>
              </div>

              <div className="preview-input">
                Message #backend...
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-heading">
            <span className="auth-eyebrow">
              {eyebrow}
            </span>

            <h2>
              {title}
            </h2>

            <p>
              {subtitle}
            </p>
          </div>

          {children}
        </div>
      </section>
    </main>
  );
}


export default AuthShell;