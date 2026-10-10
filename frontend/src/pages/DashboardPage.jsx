import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  apiRequest,
  readApiError,
} from "../api/client";
import { useAuth } from "../auth/AuthContext";
import ChannelChat from "../components/ChannelChat";
import CreateChannelModal from "../components/CreateChannelModal";
import CreateWorkspaceModal from "../components/CreateWorkspaceModal";
import InvitationInbox from "../components/InvitationInbox";
import WorkspaceMembersPanel from "../components/WorkspaceMembersPanel";


function workspaceInitial(workspace) {
  return (
    workspace.name
      ?.trim()
      .slice(0, 1)
      .toUpperCase() || "W"
  );
}


function sortChannels(channels) {
  return [...channels].sort(
    (first, second) => {
      if (first.is_general) {
        return -1;
      }

      if (second.is_general) {
        return 1;
      }

      return first.name.localeCompare(
        second.name,
      );
    },
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

  const [channels, setChannels] =
    useState([]);

  const [
    activeChannel,
    setActiveChannel,
  ] = useState(null);

  const [
    workspaceRole,
    setWorkspaceRole,
  ] = useState(null);

  const [mainView, setMainView] =
    useState("chat");

  const [
    workspacesLoading,
    setWorkspacesLoading,
  ] = useState(true);

  const [
    channelsLoading,
    setChannelsLoading,
  ] = useState(false);

  const [
    workspaceError,
    setWorkspaceError,
  ] = useState("");

  const [
    channelError,
    setChannelError,
  ] = useState("");

  const [
    createWorkspaceModalOpen,
    setCreateWorkspaceModalOpen,
  ] = useState(false);

  const [
    createChannelModalOpen,
    setCreateChannelModalOpen,
  ] = useState(false);


  const publicChannels = useMemo(
    () =>
      channels.filter(
        (channel) =>
          channel.type === "PUBLIC",
      ),
    [channels],
  );

  const privateChannels = useMemo(
    () =>
      channels.filter(
        (channel) =>
          channel.type === "PRIVATE",
      ),
    [channels],
  );

  const canManageChannels =
    workspaceRole === "OWNER" ||
    workspaceRole === "ADMIN";


  const loadWorkspaces = useCallback(
    async () => {
      setWorkspacesLoading(true);
      setWorkspaceError("");

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

        return data;
      } catch (requestError) {
        setWorkspaceError(
          requestError.message,
        );

        return [];
      } finally {
        setWorkspacesLoading(false);
      }
    },
    [],
  );


  const loadWorkspaceData = useCallback(
    async (workspace) => {
      if (!workspace) {
        setChannels([]);
        setActiveChannel(null);
        setWorkspaceRole(null);
        return;
      }

      setChannelsLoading(true);
      setChannelError("");

      try {
        const [
          channelsResponse,
          membersResponse,
        ] = await Promise.all([
          apiRequest(
            `/api/workspaces/${workspace.id}/channels/`,
          ),
          apiRequest(
            `/api/workspaces/${workspace.id}/members/`,
          ),
        ]);

        if (!channelsResponse.ok) {
          throw new Error(
            await readApiError(
              channelsResponse,
              "Unable to load channels.",
            ),
          );
        }

        if (!membersResponse.ok) {
          throw new Error(
            await readApiError(
              membersResponse,
              "Unable to load workspace membership.",
            ),
          );
        }

        const [
          channelData,
          memberData,
        ] = await Promise.all([
          channelsResponse.json(),
          membersResponse.json(),
        ]);

        const sortedChannels =
          sortChannels(channelData);

        setChannels(
          sortedChannels,
        );

        const currentMembership =
          memberData.find(
            (membership) =>
              membership.user_id ===
              user.id,
          );

        setWorkspaceRole(
          currentMembership?.role ??
            null,
        );

        setActiveChannel(
          (currentChannel) => {
            if (
              currentChannel &&
              sortedChannels.some(
                (channel) =>
                  channel.id ===
                  currentChannel.id,
              )
            ) {
              return sortedChannels.find(
                (channel) =>
                  channel.id ===
                  currentChannel.id,
              );
            }

            return (
              sortedChannels.find(
                (channel) =>
                  channel.is_general,
              ) ??
              sortedChannels[0] ??
              null
            );
          },
        );
      } catch (requestError) {
        setChannelError(
          requestError.message,
        );

        setChannels([]);
        setActiveChannel(null);
        setWorkspaceRole(null);
      } finally {
        setChannelsLoading(false);
      }
    },
    [user.id],
  );


  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);


  useEffect(() => {
    setActiveChannel(null);

    loadWorkspaceData(
      activeWorkspace,
    );
  }, [
    activeWorkspace,
    loadWorkspaceData,
  ]);


  function selectWorkspace(
    workspace,
  ) {
    setActiveWorkspace(
      workspace,
    );

    setMainView("chat");
  }


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

    setMainView("chat");
  }


  function handleChannelCreated(
    channel,
  ) {
    setChannels(
      (currentChannels) =>
        sortChannels([
          ...currentChannels,
          channel,
        ]),
    );

    setActiveChannel(channel);
    setMainView("chat");
  }


  async function handleInvitationAccepted(
    workspaceId,
  ) {
    const updatedWorkspaces =
      await loadWorkspaces();

    const joinedWorkspace =
      updatedWorkspaces.find(
        (workspace) =>
          workspace.id ===
          workspaceId,
      );

    if (joinedWorkspace) {
      setActiveWorkspace(
        joinedWorkspace,
      );

      setMainView("chat");
    }
  }


  return (
    <>
      <main className="dashboard-page channel-layout">
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
                    `workspace-tone-${index % 5}`,
                    activeWorkspace?.id ===
                      workspace.id &&
                    mainView !==
                      "invitations"
                      ? "active"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  type="button"
                  key={workspace.id}
                  title={workspace.name}
                  onClick={() =>
                    selectWorkspace(
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
            className={[
              "workspace-inbox-button",
              mainView ===
              "invitations"
                ? "active"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            type="button"
            title="Workspace invitations"
            aria-label="Workspace invitations"
            onClick={() =>
              setMainView(
                "invitations",
              )
            }
          >
            @
          </button>

          <button
            className="workspace-add"
            type="button"
            title="Create workspace"
            aria-label="Create workspace"
            onClick={() =>
              setCreateWorkspaceModalOpen(
                true,
              )
            }
          >
            +
          </button>
        </aside>

        <section className="channel-sidebar">
          <div className="channel-sidebar-header">
            <div className="channel-workspace-heading">
              <span>
                Workspace
              </span>

              <strong>
                {activeWorkspace
                  ? activeWorkspace.name
                  : "No workspace"}
              </strong>

              {workspaceRole && (
                <small>
                  {workspaceRole}
                </small>
              )}
            </div>

            {canManageChannels &&
              mainView === "chat" && (
              <button
                className="channel-create-icon"
                type="button"
                title="Create channel"
                aria-label="Create channel"
                onClick={() =>
                  setCreateChannelModalOpen(
                    true,
                  )
                }
              >
                +
              </button>
            )}
          </div>

          {activeWorkspace && (
            <div className="channel-sidebar-body">
              <div className="workspace-view-navigation">
                <button
                  className={
                    mainView === "chat"
                      ? "active"
                      : ""
                  }
                  type="button"
                  onClick={() =>
                    setMainView(
                      "chat",
                    )
                  }
                >
                  <span>
                    #
                  </span>

                  Channels
                </button>

                <button
                  className={
                    mainView ===
                    "members"
                      ? "active"
                      : ""
                  }
                  type="button"
                  onClick={() =>
                    setMainView(
                      "members",
                    )
                  }
                >
                  <span>
                    M
                  </span>

                  Members
                </button>
              </div>

              {mainView === "chat" && (
                <>
                  {channelsLoading && (
                    <div className="channel-sidebar-status">
                      Loading channels...
                    </div>
                  )}

                  {!channelsLoading &&
                    channelError && (
                      <div className="channel-sidebar-error">
                        <span>
                          {channelError}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            loadWorkspaceData(
                              activeWorkspace,
                            )
                          }
                        >
                          Retry
                        </button>
                      </div>
                    )}

                  {!channelsLoading &&
                    !channelError && (
                      <>
                        <div className="channel-section">
                          <div className="channel-section-heading">
                            <span>
                              Public channels
                            </span>

                            {canManageChannels && (
                              <button
                                type="button"
                                onClick={() =>
                                  setCreateChannelModalOpen(
                                    true,
                                  )
                                }
                              >
                                +
                              </button>
                            )}
                          </div>

                          <div className="channel-list">
                            {publicChannels.map(
                              (channel) => (
                                <button
                                  className={[
                                    "channel-list-item",
                                    activeChannel?.id ===
                                    channel.id
                                      ? "active"
                                      : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                  type="button"
                                  key={channel.id}
                                  onClick={() =>
                                    setActiveChannel(
                                      channel,
                                    )
                                  }
                                >
                                  <span className="channel-symbol">
                                    #
                                  </span>

                                  <span className="channel-name">
                                    {channel.name}
                                  </span>

                                  {channel.is_general && (
                                    <span className="channel-general-badge">
                                      default
                                    </span>
                                  )}
                                </button>
                              ),
                            )}

                            {publicChannels.length ===
                              0 && (
                              <div className="channel-empty-copy">
                                No public channels.
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="channel-section">
                          <div className="channel-section-heading">
                            <span>
                              Private channels
                            </span>
                          </div>

                          <div className="channel-list">
                            {privateChannels.map(
                              (channel) => (
                                <button
                                  className={[
                                    "channel-list-item",
                                    activeChannel?.id ===
                                    channel.id
                                      ? "active"
                                      : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                  type="button"
                                  key={channel.id}
                                  onClick={() =>
                                    setActiveChannel(
                                      channel,
                                    )
                                  }
                                >
                                  <span className="channel-symbol private">
                                    🔒
                                  </span>

                                  <span className="channel-name">
                                    {channel.name}
                                  </span>
                                </button>
                              ),
                            )}

                            {privateChannels.length ===
                              0 && (
                              <div className="channel-empty-copy">
                                No private channels.
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                </>
              )}
            </div>
          )}

          <div className="channel-sidebar-footer">
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
          </div>
        </section>

        <section className="channel-content">
          {mainView ===
            "invitations" && (
            <InvitationInbox
              onAccepted={
                handleInvitationAccepted
              }
            />
          )}

          {mainView !==
              "invitations" &&
            workspacesLoading && (
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

          {mainView !==
              "invitations" &&
            !workspacesLoading &&
            workspaceError && (
              <div className="workspace-state">
                <div className="state-icon error">
                  !
                </div>

                <h2>
                  Could not load workspaces
                </h2>

                <p>
                  {workspaceError}
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

          {mainView !==
              "invitations" &&
            !workspacesLoading &&
            !workspaceError &&
            workspaces.length ===
              0 && (
              <div className="workspace-state">
                <div className="state-icon">
                  W
                </div>

                <h2>
                  No workspaces yet
                </h2>

                <p>
                  Create a workspace or open
                  your invitations using the
                  @ button on the left.
                </p>

                <button
                  className="primary-button state-action"
                  type="button"
                  onClick={() =>
                    setCreateWorkspaceModalOpen(
                      true,
                    )
                  }
                >
                  Create workspace
                </button>
              </div>
            )}

          {mainView ===
              "members" &&
            activeWorkspace &&
            workspaceRole && (
              <WorkspaceMembersPanel
                key={
                  activeWorkspace.id
                }
                workspace={
                  activeWorkspace
                }
                workspaceRole={
                  workspaceRole
                }
                user={user}
              />
            )}

          {mainView === "chat" &&
            !workspacesLoading &&
            !workspaceError &&
            activeWorkspace &&
            !channelsLoading &&
            !channelError &&
            !activeChannel && (
              <div className="workspace-state">
                <div className="state-icon">
                  #
                </div>

                <h2>
                  No channels available
                </h2>

                <p>
                  There are no channels you
                  can access in this workspace.
                </p>

                {canManageChannels && (
                  <button
                    className="primary-button state-action"
                    type="button"
                    onClick={() =>
                      setCreateChannelModalOpen(
                        true,
                      )
                    }
                  >
                    Create channel
                  </button>
                )}
              </div>
            )}

          {mainView === "chat" &&
            activeWorkspace &&
            activeChannel && (
              <ChannelChat
                key={activeChannel.id}
                channel={activeChannel}
                workspace={
                  activeWorkspace
                }
                user={user}
              />
            )}
        </section>
      </main>

      <CreateWorkspaceModal
        open={
          createWorkspaceModalOpen
        }
        onClose={() =>
          setCreateWorkspaceModalOpen(
            false,
          )
        }
        onCreated={
          handleWorkspaceCreated
        }
      />

      <CreateChannelModal
        open={
          createChannelModalOpen
        }
        workspace={
          activeWorkspace
        }
        onClose={() =>
          setCreateChannelModalOpen(
            false,
          )
        }
        onCreated={
          handleChannelCreated
        }
      />
    </>
  );
}


export default DashboardPage;