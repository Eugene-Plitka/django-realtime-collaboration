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


function AccountConnectionsModal({
  open,
  onClose,
}) {
  const [
    connectionData,
    setConnectionData,
  ] = useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
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
    passwordFormOpen,
    setPasswordFormOpen,
  ] = useState(false);

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    passwordConfirm,
    setPasswordConfirm,
  ] = useState("");

  const [
    passwordSubmitting,
    setPasswordSubmitting,
  ] = useState(false);

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    showPasswordConfirm,
    setShowPasswordConfirm,
  ] = useState(false);


  const loadConnections = useCallback(
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

        setConnectionData(data);

        if (
          data.password_login_available
        ) {
          setPasswordFormOpen(false);
        }
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
    if (!open) {
      return;
    }

    setConfirmingProvider(null);
    setSuccessMessage("");
    setError("");

    setPassword("");
    setPasswordConfirm("");

    setShowPassword(false);
    setShowPasswordConfirm(false);

    loadConnections();
  }, [
    loadConnections,
    open,
  ]);


  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    onClose,
    open,
  ]);


  if (!open) {
    return null;
  }


  async function connectProvider(
    provider,
  ) {
    setBusyProvider(provider);
    setError("");
    setSuccessMessage("");

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
    setBusyProvider(provider);
    setError("");
    setSuccessMessage("");

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

      setConfirmingProvider(null);

      setSuccessMessage(
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


  async function handleSetPassword(
    event,
  ) {
    event.preventDefault();

    setError("");
    setSuccessMessage("");

    if (
      password !==
      passwordConfirm
    ) {
      setError(
        "Passwords do not match.",
      );

      return;
    }

    setPasswordSubmitting(true);

    try {
      const response =
        await apiRequest(
          "/api/auth/password/set/",
          {
            method: "POST",
            body: {
              password,
              password_confirm:
                passwordConfirm,
            },
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to set password.",
          ),
        );
      }

      setPassword("");
      setPasswordConfirm("");

      setShowPassword(false);
      setShowPasswordConfirm(false);

      setPasswordFormOpen(false);

      setSuccessMessage(
        "Password sign-in is now enabled.",
      );

      await loadConnections();
    } catch (requestError) {
      setError(
        requestError.message,
      );
    } finally {
      setPasswordSubmitting(false);
    }
  }


  function handleCancelPasswordSetup() {
    setPasswordFormOpen(false);

    setPassword("");
    setPasswordConfirm("");

    setShowPassword(false);
    setShowPasswordConfirm(false);

    setError("");
  }


  return (
    <div
      className="account-connections-backdrop"
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
        className="account-connections-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connections-title"
      >
        <header className="account-connections-header">
          <div>
            <span>
              Account security
            </span>

            <h2 id="connections-title">
              Sign-in methods
            </h2>

            <p>
              Manage password login,
              Google and GitHub access
              for your CollabSpace
              account.
            </p>
          </div>

          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {error && (
          <div className="account-connections-error">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="account-connections-success">
            {successMessage}
          </div>
        )}

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

                {!connectionData
                  .password_login_available && (
                    <button
                      className="connection-action connect password-connect-action"
                      type="button"
                      onClick={() => {
                        if (
                          passwordFormOpen
                        ) {
                          handleCancelPasswordSetup();
                          return;
                        }

                        setPasswordFormOpen(
                          true,
                        );

                        setError("");
                        setSuccessMessage("");
                      }}
                    >
                      {passwordFormOpen
                        ? "Cancel"
                        : "Set password"}
                    </button>
                  )}
              </div>
            </div>

            {!connectionData
              .password_login_available &&
              passwordFormOpen && (
                <form
                  className="password-setup-form"
                  onSubmit={
                    handleSetPassword
                  }
                >
                  <div className="password-setup-heading">
                    <strong>
                      Add password sign-in
                    </strong>

                    <span>
                      After this you can
                      sign in using your
                      email and password,
                      even without Google
                      or GitHub.
                    </span>
                  </div>

                  <label>
                    <span>
                      New password
                    </span>

                    <div className="password-input-shell">
                      <input
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        value={password}
                        onChange={(event) =>
                          setPassword(
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
                          showPassword
                            ? "Hide password"
                            : "Show password"
                        }
                        title={
                          showPassword
                            ? "Hide password"
                            : "Show password"
                        }
                        onClick={() =>
                          setShowPassword(
                            (current) =>
                              !current,
                          )
                        }
                      >
                        {showPassword ? (
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              d="M3 3l18 18M10.6 10.6A2 2 0 0012 14a2 2 0 001.4-.6M9.9 4.2A10.8 10.8 0 0112 4c5.5 0 9 5 9 5a15.6 15.6 0 01-2.1 2.5M6.6 6.6C4.4 8.1 3 10 3 10s3.5 5 9 5a10.7 10.7 0 004.1-.8"
                            />
                          </svg>
                        ) : (
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
                        )}
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
                          showPasswordConfirm
                            ? "text"
                            : "password"
                        }
                        value={
                          passwordConfirm
                        }
                        onChange={(event) =>
                          setPasswordConfirm(
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
                          showPasswordConfirm
                            ? "Hide password confirmation"
                            : "Show password confirmation"
                        }
                        title={
                          showPasswordConfirm
                            ? "Hide password"
                            : "Show password"
                        }
                        onClick={() =>
                          setShowPasswordConfirm(
                            (current) =>
                              !current,
                          )
                        }
                      >
                        {showPasswordConfirm ? (
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              d="M3 3l18 18M10.6 10.6A2 2 0 0012 14a2 2 0 001.4-.6M9.9 4.2A10.8 10.8 0 0112 4c5.5 0 9 5 9 5a15.6 15.6 0 01-2.1 2.5M6.6 6.6C4.4 8.1 3 10 3 10s3.5 5 9 5a10.7 10.7 0 004.1-.8"
                            />
                          </svg>
                        ) : (
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
                        )}
                      </button>
                    </div>
                  </label>

                  <div className="password-setup-actions">
                    <button
                      className="secondary"
                      type="button"
                      disabled={
                        passwordSubmitting
                      }
                      onClick={
                        handleCancelPasswordSetup
                      }
                    >
                      Cancel
                    </button>

                    <button
                      className="primary"
                      type="submit"
                      disabled={
                        passwordSubmitting
                      }
                    >
                      {passwordSubmitting
                        ? "Saving..."
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
                      key={provider.provider}
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
                          disabled={busy}
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
                            disabled={busy}
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
                              disabled={busy}
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
                              disabled={busy}
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
  );
}


export default AccountConnectionsModal;