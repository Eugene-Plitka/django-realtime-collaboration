import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  apiRequest,
  readApiError,
} from "../api/client";


const AVATAR_COLORS = [
  "#4057f6",
  "#7c3aed",
  "#0f766e",
  "#b45309",
  "#be123c",
  "#0369a1",
  "#4f46e5",
];


function avatarFallbackColor(
  username,
) {
  const value =
    username ?? "";

  let hash = 0;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash =
      (
        hash * 31 +
        value.charCodeAt(index)
      ) >>> 0;
  }

  return AVATAR_COLORS[
    hash %
      AVATAR_COLORS.length
  ];
}


function ProfileSettings({
  user,
  onUserChanged,
}) {
  const fileInputRef =
    useRef(null);

  const [username, setUsername] =
    useState(
      user.username,
    );

  const [saving, setSaving] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [removing, setRemoving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [
    avatarFailed,
    setAvatarFailed,
  ] = useState(false);


  useEffect(() => {
    setUsername(
      user.username,
    );
  }, [user.username]);


  useEffect(() => {
    setAvatarFailed(false);
  }, [user.avatar_url]);


  async function saveUsername(
    event,
  ) {
    event.preventDefault();

    const nextUsername =
      username.trim();

    if (!nextUsername) {
      setError(
        "Username is required.",
      );
      return;
    }

    if (
      nextUsername ===
      user.username
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response =
        await apiRequest(
          "/api/auth/me/",
          {
            method: "PATCH",
            body: {
              username:
                nextUsername,
            },
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to update username.",
          ),
        );
      }

      await onUserChanged();

      setSuccess(
        "Username updated.",
      );
    } catch (requestError) {
      setError(
        requestError.message,
      );
    } finally {
      setSaving(false);
    }
  }


  async function uploadAvatar(
    event,
  ) {
    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (
      !allowedTypes.includes(
        file.type,
      )
    ) {
      setError(
        "Avatar must be JPEG, PNG or WebP.",
      );
      return;
    }

    const maxSize =
      5 * 1024 * 1024;

    if (
      file.size >
      maxSize
    ) {
      setError(
        "Avatar must be 5 MB or smaller.",
      );
      return;
    }

    const formData =
      new FormData();

    formData.append(
      "avatar",
      file,
    );

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      const response =
        await apiRequest(
          "/api/auth/avatar/",
          {
            method: "POST",
            body: formData,
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to upload avatar.",
          ),
        );
      }

      await onUserChanged();

      setSuccess(
        "Avatar updated.",
      );
    } catch (requestError) {
      setError(
        requestError.message,
      );
    } finally {
      setUploading(false);
    }
  }


  async function removeAvatar() {
    if (
      user.avatar_source !==
      "custom"
    ) {
      return;
    }

    setRemoving(true);
    setError("");
    setSuccess("");

    try {
      const response =
        await apiRequest(
          "/api/auth/avatar/",
          {
            method: "DELETE",
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to remove avatar.",
          ),
        );
      }

      await onUserChanged();

      setSuccess(
        "Custom avatar removed.",
      );
    } catch (requestError) {
      setError(
        requestError.message,
      );
    } finally {
      setRemoving(false);
    }
  }


  const showAvatarImage =
    Boolean(user.avatar_url) &&
    !avatarFailed;

  const effectiveAvatarSource =
    showAvatarImage
      ? user.avatar_source
      : "fallback";

  const avatarSourceLabel = {
    custom:
      "Custom avatar",
    google:
      "Google avatar",
    github:
      "GitHub avatar",
    fallback:
      "Generated avatar",
  }[
    effectiveAvatarSource
  ] ?? "Avatar";


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

        {error && (
          <div className="settings-message error">
            {error}
          </div>
        )}

        {success && (
          <div className="settings-message success">
            {success}
          </div>
        )}

        <section className="settings-card settings-profile-card">
          <div className="settings-profile-editor">
            <div className="settings-profile-avatar-large">
              {showAvatarImage ? (
                <img
                  src={
                    user.avatar_url
                  }
                  alt=""
                  onError={() =>
                    setAvatarFailed(
                      true,
                    )
                  }
                />
              ) : (
                <span
                  style={{
                    backgroundColor:
                      avatarFallbackColor(
                        user.username,
                      ),
                  }}
                >
                  {user.username
                    ?.slice(0, 1)
                    .toUpperCase()}
                </span>
              )}
            </div>

            <div className="settings-profile-summary">
              <strong>
                {user.username}
              </strong>

              <span>
                {user.email}
              </span>

              <small>
                {
                  avatarSourceLabel
                }
              </small>
            </div>

            <div className="settings-avatar-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={
                  uploadAvatar
                }
              />

              <button
                className="settings-secondary-button"
                type="button"
                disabled={
                  uploading ||
                  removing
                }
                onClick={() =>
                  fileInputRef.current
                    ?.click()
                }
              >
                {uploading
                  ? "Uploading..."
                  : user.avatar_source ===
                      "custom"
                    ? "Change avatar"
                    : "Upload avatar"}
              </button>

              {user.avatar_source ===
                "custom" && (
                <button
                  className="settings-danger-button"
                  type="button"
                  disabled={
                    uploading ||
                    removing
                  }
                  onClick={
                    removeAvatar
                  }
                >
                  {removing
                    ? "Removing..."
                    : "Remove"}
                </button>
              )}
            </div>
          </div>

          <div className="settings-avatar-help">
            JPEG, PNG or WebP. Maximum file
            size 5 MB. If you remove your
            custom avatar, CollabSpace will
            use your connected social account
            avatar when available.
          </div>

          <div className="settings-card-divider" />

          <form
            className="settings-profile-form"
            onSubmit={
              saveUsername
            }
          >
            <div className="settings-card-heading">
              <div>
                <h2>
                  Profile information
                </h2>

                <p>
                  Your username is visible
                  to other workspace members
                  and is used for mentions.
                </p>
              </div>
            </div>

            <label className="settings-form-field">
              <span>
                Username
              </span>

              <input
                type="text"
                value={username}
                maxLength={150}
                autoComplete="username"
                onChange={(event) =>
                  setUsername(
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="settings-form-field">
              <span>
                Email
              </span>

              <input
                type="email"
                value={
                  user.email
                }
                disabled
                readOnly
              />

              <small>
                Email changes are not supported
                from profile settings.
              </small>
            </label>

            <div className="settings-form-actions">
              <button
                className="settings-primary-button"
                type="submit"
                disabled={
                  saving ||
                  !username.trim() ||
                  username.trim() ===
                    user.username
                }
              >
                {saving
                  ? "Saving..."
                  : "Save changes"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}


function AppearanceSettings() {
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


function SignInSettings() {
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


function SettingsContent({
  section,
  user,
  onUserChanged,
}) {
  if (
    section === "appearance"
  ) {
    return (
      <AppearanceSettings />
    );
  }

  if (
    section === "sign-in"
  ) {
    return (
      <SignInSettings />
    );
  }

  return (
    <ProfileSettings
      user={user}
      onUserChanged={
        onUserChanged
      }
    />
  );
}


export default SettingsContent;