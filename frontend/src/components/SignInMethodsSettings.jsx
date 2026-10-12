import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  apiRequest,
  getApiBaseUrl,
  readApiError,
} from "../api/client";
import SocialProviderIcon from "./SocialProviderIcon";


function PasswordEye({
  visible,
}) {
  if (visible) {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="M3 3l18 18M10.6 10.6A2 2 0 0012 14a2 2 0 001.4-.6M9.9 4.2A10.8 10.8 0 0112 4c5.5 0 9 5 9 5a15.6 15.6 0 01-2.1 2.5M6.6 6.6C4.4 8.1 3 10 3 10s3.5 5 9 5a10.7 10.7 0 004.1-.8"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z"
      />

      <circle
        cx="12"
        cy="12"
        r="2.5"
      />
    </svg>
  );
}


function SignInMethodsSettings() {
  const [
    connectionData,
    setConnectionData,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    busyProvider,
    setBusyProvider,
  ] = useState(null);

  const [
    confirmingProvider,
    setConfirmingProvider,
  ] = useState(null);

  const [
    passwordMode,
    setPasswordMode,
  ] = useState(null);

  const [
    currentPassword,
    setCurrentPassword,
  ] = useState("");

  const [
    newPassword,
    setNewPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    submittingPassword,
    setSubmittingPassword,
  ] = useState(false);

  const [
    showCurrentPassword,
    setShowCurrentPassword,
  ] = useState(false);

  const [
    showNewPassword,
    setShowNewPassword,
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);


  const loadConnections =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const response =
            await apiRequest(
              "/api/auth/social/connections/",
            );

          if (!response.ok) {
            throw new Error(
              await readApiError(
                response,
                "Unable to load sign-in methods.",
              ),
            );
          }

          const data =
            await response.json();

          setConnectionData(
            data,
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
    loadConnections();
  }, [loadConnections]);


  function resetPasswordForm() {
    setPasswordMode(null);

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");

    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  }


  async function connectProvider(
    provider,
  ) {
    setBusyProvider(
      provider,
    );

    setError("");
    setSuccess("");

    try {
      const response =
        await apiRequest(
          `/api/auth/social/connections/${provider}/connect/`,
          {
            method: "POST",
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to connect this provider.",
          ),
        );
      }

      const data =
        await response.json();

      window.location.href =
        `${getApiBaseUrl()}${data.redirect_url}`;
    } catch (requestError) {
      setError(
        requestError.message,
      );

      setBusyProvider(null);
    }
  }


  async function disconnectProvider(
    provider,
  ) {
    setBusyProvider(
      provider,
    );

    setError("");
    setSuccess("");

    try {
      const response =
        await apiRequest(
          `/api/auth/social/connections/${provider}/`,
          {
            method: "DELETE",
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to disconnect this provider.",
          ),
        );
      }

      setConfirmingProvider(
        null,
      );

      setSuccess(
        "Sign-in provider disconnected.",
      );

      await loadConnections();
    } catch (requestError) {
      setError(
        requestError.message,
      );
    } finally {
      setBusyProvider(null);
    }
  }


  async function submitPassword(
    event,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      newPassword !==
      confirmPassword
    ) {
      setError(
        "Passwords do not match.",
      );

      return;
    }

    setSubmittingPassword(
      true,
    );

    const isChange =
      passwordMode === "change";

    try {
      const response =
        await apiRequest(
          isChange
            ? "/api/auth/password/change/"
            : "/api/auth/password/set/",
          {
            method: "POST",
            body: isChange
              ? {
                  current_password:
                    currentPassword,
                  new_password:
                    newPassword,
                  new_password_confirm:
                    confirmPassword,
                }
              : {
                  password:
                    newPassword,
                  password_confirm:
                    confirmPassword,
                },
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            isChange
              ? "Unable to change password."
              : "Unable to set password.",
          ),
        );
      }

      resetPasswordForm();

      setSuccess(
        isChange
          ? "Password changed successfully."
          : "Password sign-in is now enabled.",
      );

      await loadConnections();
    } catch (requestError) {
      setError(
        requestError.message,
      );
    } finally {
      setSubmittingPassword(
        false,
      );
    }
  }


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
            Manage password login,
            Google and GitHub access
            for your CollabSpace account.
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

        <section className="settings-card settings-signin-card">
          {loading &&
            !connectionData && (
              <div className="account-connections-loading">
                Loading sign-in methods...
              </div>
            )}

          {connectionData && (
            <>
              <div className="account-login-summary">
                <div>
                  <span>
                    Password sign-in
                  </span>

                  <strong>
                    {connectionData
                      .password_login_available
                      ? "Available"
                      : "Not configured"}
                  </strong>
                </div>

                <div className="password-method-actions">
                  <span
                    className={[
                      "connection-status",
                      connectionData
                        .password_login_available
                        ? "connected"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {connectionData
                      .password_login_available
                      ? "Enabled"
                      : "Unavailable"}
                  </span>

                  <button
                    className="connection-action connect password-connect-action"
                    type="button"
                    onClick={() => {
                      const nextMode =
                        connectionData
                          .password_login_available
                          ? "change"
                          : "set";

                      if (
                        passwordMode ===
                        nextMode
                      ) {
                        resetPasswordForm();
                        return;
                      }

                      resetPasswordForm();

                      setPasswordMode(
                        nextMode,
                      );

                      setError("");
                      setSuccess("");
                    }}
                  >
                    {passwordMode
                      ? "Cancel"
                      : connectionData
                          .password_login_available
                        ? "Change password"
                        : "Set password"}
                  </button>
                </div>
              </div>

              {passwordMode && (
                <form
                  className="password-setup-form settings-password-form"
                  onSubmit={
                    submitPassword
                  }
                >
                  <div className="password-setup-heading">
                    <strong>
                      {passwordMode ===
                      "change"
                        ? "Change password"
                        : "Add password sign-in"}
                    </strong>

                    <span>
                      {passwordMode ===
                      "change"
                        ? "Confirm your current password and choose a new one."
                        : "Add a password so you can sign in without Google or GitHub."}
                    </span>
                  </div>

                  {passwordMode ===
                    "change" && (
                    <label>
                      <span>
                        Current password
                      </span>

                      <div className="password-input-shell">
                        <input
                          type={
                            showCurrentPassword
                              ? "text"
                              : "password"
                          }
                          value={
                            currentPassword
                          }
                          onChange={(event) =>
                            setCurrentPassword(
                              event.target.value,
                            )
                          }
                          autoComplete="current-password"
                          placeholder="Enter current password"
                          required
                        />

                        <button
                          className="password-visibility-button"
                          type="button"
                          aria-label={
                            showCurrentPassword
                              ? "Hide current password"
                              : "Show current password"
                          }
                          onClick={() =>
                            setShowCurrentPassword(
                              (current) =>
                                !current,
                            )
                          }
                        >
                          <PasswordEye
                            visible={
                              showCurrentPassword
                            }
                          />
                        </button>
                      </div>
                    </label>
                  )}

                  <label>
                    <span>
                      New password
                    </span>

                    <div className="password-input-shell">
                      <input
                        type={
                          showNewPassword
                            ? "text"
                            : "password"
                        }
                        value={
                          newPassword
                        }
                        onChange={(event) =>
                          setNewPassword(
                            event.target.value,
                          )
                        }
                        autoComplete="new-password"
                        placeholder="Create a strong password"
                        required
                      />

                      <button
                        className="password-visibility-button"
                        type="button"
                        aria-label={
                          showNewPassword
                            ? "Hide new password"
                            : "Show new password"
                        }
                        onClick={() =>
                          setShowNewPassword(
                            (current) =>
                              !current,
                          )
                        }
                      >
                        <PasswordEye
                          visible={
                            showNewPassword
                          }
                        />
                      </button>
                    </div>
                  </label>

                  <label>
                    <span>
                      Confirm password
                    </span>

                    <div className="password-input-shell">
                      <input
                        type={
                          showConfirmPassword
                            ? "text"
                            : "password"
                        }
                        value={
                          confirmPassword
                        }
                        onChange={(event) =>
                          setConfirmPassword(
                            event.target.value,
                          )
                        }
                        autoComplete="new-password"
                        placeholder="Repeat your password"
                        required
                      />

                      <button
                        className="password-visibility-button"
                        type="button"
                        aria-label={
                          showConfirmPassword
                            ? "Hide password confirmation"
                            : "Show password confirmation"
                        }
                        onClick={() =>
                          setShowConfirmPassword(
                            (current) =>
                              !current,
                          )
                        }
                      >
                        <PasswordEye
                          visible={
                            showConfirmPassword
                          }
                        />
                      </button>
                    </div>
                  </label>

                  <div className="password-setup-actions">
                    <button
                      className="secondary"
                      type="button"
                      disabled={
                        submittingPassword
                      }
                      onClick={
                        resetPasswordForm
                      }
                    >
                      Cancel
                    </button>

                    <button
                      className="primary"
                      type="submit"
                      disabled={
                        submittingPassword
                      }
                    >
                      {submittingPassword
                        ? "Saving..."
                        : passwordMode ===
                            "change"
                          ? "Change password"
                          : "Set password"}
                    </button>
                  </div>
                </form>
              )}

              <div className="account-provider-list">
                {connectionData.providers.map(
                  (provider) => {
                    const busy =
                      busyProvider ===
                      provider.provider;

                    const confirming =
                      confirmingProvider ===
                      provider.provider;

                    return (
                      <article
                        className="account-provider-row"
                        key={
                          provider.provider
                        }
                      >
                        <div className="account-provider-icon">
                          <SocialProviderIcon
                            provider={
                              provider.provider
                            }
                          />
                        </div>

                        <div className="account-provider-copy">
                          <strong>
                            {provider.name}
                          </strong>

                          <span>
                            {provider.connected
                              ? "This account can be used to sign in."
                              : "Not connected to your CollabSpace account."}
                          </span>
                        </div>

                        <span
                          className={[
                            "connection-status",
                            provider.connected
                              ? "connected"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {provider.connected
                            ? "Connected"
                            : "Not connected"}
                        </span>

                        {!provider.connected && (
                          <button
                            className="connection-action connect"
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              connectProvider(
                                provider.provider,
                              )
                            }
                          >
                            {busy
                              ? "Connecting..."
                              : "Connect"}
                          </button>
                        )}

                        {provider.connected &&
                          !confirming && (
                            <button
                              className="connection-action disconnect"
                              type="button"
                              disabled={
                                busy
                              }
                              onClick={() =>
                                setConfirmingProvider(
                                  provider.provider,
                                )
                              }
                            >
                              Disconnect
                            </button>
                          )}

                        {provider.connected &&
                          confirming && (
                            <div className="connection-confirm">
                              <button
                                className="cancel"
                                type="button"
                                disabled={
                                  busy
                                }
                                onClick={() =>
                                  setConfirmingProvider(
                                    null,
                                  )
                                }
                              >
                                Cancel
                              </button>

                              <button
                                className="confirm"
                                type="button"
                                disabled={
                                  busy
                                }
                                onClick={() =>
                                  disconnectProvider(
                                    provider.provider,
                                  )
                                }
                              >
                                {busy
                                  ? "Removing..."
                                  : "Confirm"}
                              </button>
                            </div>
                          )}
                      </article>
                    );
                  },
                )}
              </div>

              <div className="account-connections-note">
                CollabSpace will never let
                you disconnect your final
                available sign-in method.
                Connect another provider
                or configure a password
                first.
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}


export default SignInMethodsSettings;