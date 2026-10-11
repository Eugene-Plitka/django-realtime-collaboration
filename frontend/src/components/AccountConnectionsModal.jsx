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
    busyProvider,
    setBusyProvider,
  ] = useState(null);

  const [
    confirmingProvider,
    setConfirmingProvider,
  ] = useState(null);


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

      await loadConnections();
    } catch (requestError) {
      setError(
        requestError.message,
      );
    } finally {
      setBusyProvider(null);
    }
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
              Connect Google or GitHub
              to use them when signing
              in to CollabSpace.
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
            </div>

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
              CollabSpace will never let you
              disconnect your final available
              sign-in method. Connect another
              provider or configure a password
              first.
            </div>
          </>
        )}
      </section>
    </div>
  );
}


export default AccountConnectionsModal;