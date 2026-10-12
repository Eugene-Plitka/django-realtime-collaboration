function SettingsContent({
  section,
  user,
}) {
  if (section === "appearance") {
    return (
      <div className="settings-page">
        <div className="settings-page-inner">
          <header className="settings-page-header">
            <span>
              Personal settings
            </span>

            <h1>
              Appearance
            </h1>

            <p>
              Customize how CollabSpace
              looks and feels.
            </p>
          </header>

          <section className="settings-card">
            <div className="settings-card-heading">
              <div>
                <h2>
                  Font size
                </h2>

                <p>
                  Adjust the interface text
                  size across CollabSpace.
                </p>
              </div>

              <span className="settings-coming-badge">
                Next step
              </span>
            </div>

            <div className="settings-preview-row">
              <span>
                Smaller
              </span>

              <div className="settings-preview-track">
                <i />
                <i />
                <i className="active" />
                <i />
                <i />
                <i />
                <i />
              </div>

              <span>
                Larger
              </span>
            </div>

            <div className="settings-info-box">
              The third position will be the
              default size. Your preference
              will be saved and restored
              automatically.
            </div>
          </section>
        </div>
      </div>
    );
  }


  if (section === "sign-in") {
    return (
      <div className="settings-page">
        <div className="settings-page-inner">
          <header className="settings-page-header">
            <span>
              Account security
            </span>

            <h1>
              Sign-in Methods
            </h1>

            <p>
              Manage the ways you can sign
              in to your CollabSpace account.
            </p>
          </header>

          <section className="settings-card">
            <div className="settings-card-heading">
              <div>
                <h2>
                  Connected methods
                </h2>

                <p>
                  Password, Google and GitHub
                  management will move here.
                </p>
              </div>

              <span className="settings-coming-badge">
                Next step
              </span>
            </div>

            <div className="settings-placeholder-list">
              <div>
                <span className="settings-placeholder-icon">
                  P
                </span>

                <div>
                  <strong>
                    Password
                  </strong>

                  <span>
                    Password sign-in
                  </span>
                </div>
              </div>

              <div>
                <span className="settings-placeholder-icon">
                  G
                </span>

                <div>
                  <strong>
                    Google
                  </strong>

                  <span>
                    Social sign-in
                  </span>
                </div>
              </div>

              <div>
                <span className="settings-placeholder-icon">
                  GH
                </span>

                <div>
                  <strong>
                    GitHub
                  </strong>

                  <span>
                    Social sign-in
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }


  return (
    <div className="settings-page">
      <div className="settings-page-inner">
        <header className="settings-page-header">
          <span>
            Personal settings
          </span>

          <h1>
            Profile
          </h1>

          <p>
            Manage your identity and profile
            information in CollabSpace.
          </p>
        </header>

        <section className="settings-card">
          <div className="settings-profile-preview">
            <div className="settings-profile-avatar">
              {user.username
                ?.slice(0, 1)
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

          <div className="settings-card-divider" />

          <div className="settings-card-heading">
            <div>
              <h2>
                Profile information
              </h2>

              <p>
                Username, avatar and password
                management will be added here.
              </p>
            </div>

            <span className="settings-coming-badge">
              Next step
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}


export default SettingsContent;