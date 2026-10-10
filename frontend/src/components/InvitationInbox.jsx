import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  apiRequest,
  readApiError,
} from "../api/client";


function InvitationInbox({
  onAccepted,
}) {
  const [
    invitations,
    setInvitations,
  ] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    acceptingId,
    setAcceptingId,
  ] = useState(null);


  const loadInvitations =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const response =
            await apiRequest(
              "/api/workspaces/invitations/pending/",
            );

          if (!response.ok) {
            throw new Error(
              await readApiError(
                response,
                "Unable to load invitations.",
              ),
            );
          }

          const data =
            await response.json();

          setInvitations(
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
    loadInvitations();
  }, [loadInvitations]);


  async function acceptInvitation(
    invitation,
  ) {
    setAcceptingId(
      invitation.id,
    );

    setError("");

    try {
      const response =
        await apiRequest(
          `/api/workspaces/invitations/${invitation.token}/accept/`,
          {
            method: "POST",
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to accept invitation.",
          ),
        );
      }

      setInvitations(
        (currentInvitations) =>
          currentInvitations.filter(
            (currentInvitation) =>
              currentInvitation.id !==
              invitation.id,
          ),
      );

      await onAccepted(
        invitation.workspace,
      );
    } catch (requestError) {
      setError(
        requestError.message,
      );
    } finally {
      setAcceptingId(null);
    }
  }


  return (
    <div className="invitation-inbox-page">
      <header className="members-page-header">
        <div>
          <span className="members-eyebrow">
            Invitations
          </span>

          <h1>
            Workspace invitations
          </h1>

          <p>
            Join teams that have invited
            your account.
          </p>
        </div>
      </header>

      {error && (
        <div className="members-error form-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="members-loading">
          <div className="state-spinner" />

          <span>
            Loading invitations...
          </span>
        </div>
      ) : invitations.length === 0 ? (
        <div className="invitation-empty-state">
          <div className="state-icon">
            @
          </div>

          <h2>
            No pending invitations
          </h2>

          <p>
            New workspace invitations
            sent to your email will
            appear here.
          </p>
        </div>
      ) : (
        <div className="inbox-invitation-list">
          {invitations.map(
            (invitation) => (
              <article
                className="inbox-invitation-card"
                key={invitation.id}
              >
                <div className="inbox-workspace-icon">
                  {invitation.workspace_name
                    .slice(0, 1)
                    .toUpperCase()}
                </div>

                <div className="inbox-invitation-copy">
                  <span>
                    Workspace invitation
                  </span>

                  <h2>
                    {
                      invitation.workspace_name
                    }
                  </h2>

                  <p>
                    {
                      invitation.invited_by_username
                    }{" "}
                    invited you as{" "}
                    <strong>
                      {invitation.role}
                    </strong>
                    .
                  </p>
                </div>

                <button
                  className="primary-button invitation-accept-button"
                  type="button"
                  disabled={
                    acceptingId ===
                    invitation.id
                  }
                  onClick={() =>
                    acceptInvitation(
                      invitation,
                    )
                  }
                >
                  {acceptingId ===
                  invitation.id
                    ? "Joining..."
                    : "Accept"}
                </button>
              </article>
            ),
          )}
        </div>
      )}
    </div>
  );
}


export default InvitationInbox;