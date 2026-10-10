import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  apiRequest,
  readApiError,
} from "../api/client";
import InviteMemberModal from "./InviteMemberModal";


function memberInitial(username) {
  return (
    username
      ?.slice(0, 1)
      .toUpperCase() || "?"
  );
}


function formatDate(value) {
  return new Intl.DateTimeFormat(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
  ).format(
    new Date(value),
  );
}


function WorkspaceMembersPanel({
  workspace,
  workspaceRole,
  user,
}) {
  const [members, setMembers] =
    useState([]);

  const [
    invitations,
    setInvitations,
  ] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    inviteModalOpen,
    setInviteModalOpen,
  ] = useState(false);


  const canManageInvitations =
    workspaceRole === "OWNER" ||
    workspaceRole === "ADMIN";


  const loadMembers =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const membersResponse =
            await apiRequest(
              `/api/workspaces/${workspace.id}/members/`,
            );

          if (
            !membersResponse.ok
          ) {
            throw new Error(
              await readApiError(
                membersResponse,
                "Unable to load workspace members.",
              ),
            );
          }

          const memberData =
            await membersResponse.json();

          setMembers(
            memberData,
          );

          if (
            canManageInvitations
          ) {
            const invitationResponse =
              await apiRequest(
                `/api/workspaces/${workspace.id}/invitations/`,
              );

            if (
              !invitationResponse.ok
            ) {
              throw new Error(
                await readApiError(
                  invitationResponse,
                  "Unable to load invitations.",
                ),
              );
            }

            const invitationData =
              await invitationResponse.json();

            setInvitations(
              invitationData,
            );
          } else {
            setInvitations([]);
          }
        } catch (requestError) {
          setError(
            requestError.message,
          );
        } finally {
          setLoading(false);
        }
      },
      [
        workspace.id,
        canManageInvitations,
      ],
    );


  useEffect(() => {
    loadMembers();
  }, [loadMembers]);


  function handleInvited(
    invitation,
  ) {
    setInvitations(
      (currentInvitations) => [
        invitation,
        ...currentInvitations,
      ],
    );
  }


  async function cancelInvitation(
    invitation,
  ) {
    setError("");

    try {
      const response =
        await apiRequest(
          `/api/workspaces/${workspace.id}/invitations/${invitation.id}/cancel/`,
          {
            method: "POST",
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to cancel invitation.",
          ),
        );
      }

      setInvitations(
        (currentInvitations) =>
          currentInvitations.map(
            (currentInvitation) =>
              currentInvitation.id ===
              invitation.id
                ? {
                    ...currentInvitation,
                    status:
                      "CANCELLED",
                  }
                : currentInvitation,
          ),
      );
    } catch (requestError) {
      setError(
        requestError.message,
      );
    }
  }


  return (
    <>
      <div className="members-page">
        <header className="members-page-header">
          <div>
            <span className="members-eyebrow">
              Workspace members
            </span>

            <h1>
              {workspace.name}
            </h1>

            <p>
              Manage people and access
              inside this workspace.
            </p>
          </div>

          {canManageInvitations && (
            <button
              className="primary-button invite-member-button"
              type="button"
              onClick={() =>
                setInviteModalOpen(
                  true,
                )
              }
            >
              + Invite member
            </button>
          )}
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
              Loading members...
            </span>
          </div>
        ) : (
          <>
            <section className="members-card">
              <div className="members-card-heading">
                <div>
                  <h2>
                    Members
                  </h2>

                  <span>
                    {members.length} total
                  </span>
                </div>
              </div>

              <div className="member-list">
                {members.map(
                  (member) => (
                    <article
                      className="member-row"
                      key={member.id}
                    >
                      <div className="member-avatar">
                        {memberInitial(
                          member.username,
                        )}
                      </div>

                      <div className="member-identity">
                        <strong>
                          {member.username}

                          {member.user_id ===
                            user.id && (
                            <small>
                              you
                            </small>
                          )}
                        </strong>

                        <span>
                          {member.email}
                        </span>
                      </div>

                      <span
                        className={[
                          "member-role",
                          member.role.toLowerCase(),
                        ].join(" ")}
                      >
                        {member.role}
                      </span>

                      <time>
                        Joined{" "}
                        {formatDate(
                          member.joined_at,
                        )}
                      </time>
                    </article>
                  ),
                )}
              </div>
            </section>

            {canManageInvitations && (
              <section className="members-card">
                <div className="members-card-heading">
                  <div>
                    <h2>
                      Invitations
                    </h2>

                    <span>
                      Pending and previous
                      workspace invitations
                    </span>
                  </div>
                </div>

                {invitations.length ===
                0 ? (
                  <div className="members-empty">
                    No invitations yet.
                  </div>
                ) : (
                  <div className="invitation-admin-list">
                    {invitations.map(
                      (invitation) => (
                        <article
                          className="invitation-admin-row"
                          key={
                            invitation.id
                          }
                        >
                          <div className="invitation-email-icon">
                            @
                          </div>

                          <div className="invitation-admin-copy">
                            <strong>
                              {invitation.email}
                            </strong>

                            <span>
                              Invited by{" "}
                              {
                                invitation.invited_by_username
                              }
                            </span>
                          </div>

                          <span className="member-role">
                            {invitation.role}
                          </span>

                          <span
                            className={[
                              "invitation-status",
                              invitation.status.toLowerCase(),
                            ].join(" ")}
                          >
                            {invitation.status}
                          </span>

                          {invitation.status ===
                            "PENDING" && (
                            <button
                              className="cancel-invitation-button"
                              type="button"
                              onClick={() =>
                                cancelInvitation(
                                  invitation,
                                )
                              }
                            >
                              Cancel
                            </button>
                          )}
                        </article>
                      ),
                    )}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      <InviteMemberModal
        open={inviteModalOpen}
        workspace={workspace}
        workspaceRole={
          workspaceRole
        }
        onClose={() =>
          setInviteModalOpen(false)
        }
        onInvited={
          handleInvited
        }
      />
    </>
  );
}


export default WorkspaceMembersPanel;