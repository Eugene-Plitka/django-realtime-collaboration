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
import AccountConnectionsLauncher from "../components/AccountConnectionsLauncher";
import ChannelAccessGate from "../components/ChannelAccessGate";
import ChannelActionsMenu from "../components/ChannelActionsMenu";
import CreateChannelModal from "../components/CreateChannelModal";
import CreateDirectConversationModal from "../components/CreateDirectConversationModal";
import CreateWorkspaceModal from "../components/CreateWorkspaceModal";
import DirectConversationChat from "../components/DirectConversationChat";
import HeaderActivityControls from "../components/HeaderActivityControls";
import PresenceStatusDot from "../components/PresenceStatusDot";
import SettingsContent from "../components/SettingsContent";
import UserAvatar from "../components/UserAvatar";
import WorkspaceActionsMenu from "../components/WorkspaceActionsMenu";
import WorkspaceMembersPanel from "../components/WorkspaceMembersPanel";
import { useDirectMessageUpdates } from "../directMessages/useDirectMessageUpdates";
import { useNotifications } from "../notifications/useNotifications";


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


function directConversationTitle(
  conversation,
  currentUserId,
) {
  if (
    conversation.type ===
    "GROUP"
  ) {
    if (
      conversation.name?.trim()
    ) {
      return conversation.name;
    }

    return conversation.participants
      .filter(
        (participant) =>
          participant.user_id !==
          currentUserId,
      )
      .map(
        (participant) =>
          participant.username,
      )
      .join(", ");
  }

  const otherParticipant =
    conversation.participants.find(
      (participant) =>
        participant.user_id !==
        currentUserId,
    );

  return (
    otherParticipant?.username ??
    "Direct message"
  );
}


function DashboardPage() {
  const {
    user,
    logout,
    loadUser,
  } = useAuth();
  const {
    notifications,
    unreadCount,
    loading:
      notificationsLoading,
    error:
      notificationsError,
    markRead,
    markUnread,
  } = useNotifications();

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
    directConversations,
    setDirectConversations,
  ] = useState([]);
  const [
    activeDirectConversation,
    setActiveDirectConversation,
  ] = useState(null);
  const [
    directConversationsLoading,
    setDirectConversationsLoading,
  ] = useState(false);
  const [
    directConversationsError,
    setDirectConversationsError,
  ] = useState("");
  const [
    createDirectConversationModalOpen,
    setCreateDirectConversationModalOpen,
  ] = useState(false);
  const [
    workspaceRole,
    setWorkspaceRole,
  ] = useState(null);
  const [mainView, setMainView] =
    useState("chat");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [
    settingsSection,
    setSettingsSection,
  ] = useState("profile");
  const [
    notificationTargetChannelId,
    setNotificationTargetChannelId,
  ] = useState(null);
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

  const unreadDirectConversationsCount =
    useMemo(
      () =>
        directConversations.filter(
          (conversation) =>
            (conversation.unread_count ?? 0) > 0,
        ).length,
      [directConversations],
    );

  const mergeDirectConversation =
    useCallback(
      (incomingConversation) => {
        if (!incomingConversation) {
          return;
        }

        setDirectConversations(
          (currentConversations) =>
            [
              incomingConversation,
              ...currentConversations.filter(
                (conversation) =>
                  conversation.id !==
                  incomingConversation.id,
              ),
            ].sort(
              (first, second) =>
                new Date(
                  second.updated_at,
                ) -
                new Date(
                  first.updated_at,
                ),
            ),
        );

        setActiveDirectConversation(
          (currentConversation) =>
            currentConversation?.id ===
            incomingConversation.id
              ? incomingConversation
              : currentConversation,
        );
      },
      [],
    );

  useDirectMessageUpdates({
    onConversationUpdate:
      mergeDirectConversation,
  });

  const markDirectConversationRead =
    useCallback(
      async (conversationId) => {
        const response =
          await apiRequest(
            `/api/direct-conversations/${conversationId}/read/`,
            {
              method: "POST",
            },
          );

        if (!response.ok) {
          throw new Error(
            await readApiError(
              response,
              "Unable to mark direct messages as read.",
            ),
          );
        }

        const updatedConversation =
          await response.json();

        mergeDirectConversation(
          updatedConversation,
        );

        return updatedConversation;
      },
      [mergeDirectConversation],
    );

  const loadDirectConversations =
    useCallback(
      async () => {
        setDirectConversationsLoading(
          true,
        );
        setDirectConversationsError(
          "",
        );

        try {
          const response =
            await apiRequest(
              "/api/direct-conversations/",
            );

          if (!response.ok) {
            throw new Error(
              await readApiError(
                response,
                "Unable to load direct messages.",
              ),
            );
          }

          const data =
            await response.json();

          setDirectConversations(
            data,
          );

          setActiveDirectConversation(
            (
              currentConversation,
            ) => {
              if (
                currentConversation &&
                data.some(
                  (conversation) =>
                    conversation.id ===
                    currentConversation.id,
                )
              ) {
                return data.find(
                  (conversation) =>
                    conversation.id ===
                    currentConversation.id,
                );
              }

              return null;
            },
          );
        } catch (requestError) {
          setDirectConversationsError(
            requestError.message,
          );
          setDirectConversations([]);
          setActiveDirectConversation(
            null,
          );
        } finally {
          setDirectConversationsLoading(
            false,
          );
        }
      },
      [],
    );

  const loadWorkspaces = useCallback(
    async () => {
      setWorkspacesLoading(true);
      setWorkspaceError("");
      try {
        const response =
          await apiRequest(
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

  const loadWorkspaceData =
    useCallback(
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
            sortChannels(
              channelData,
            );
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
    loadDirectConversations();
  }, [
    loadWorkspaces,
    loadDirectConversations,
  ]);

  useEffect(() => {
    if (
      mainView !== "direct" ||
      !activeDirectConversation ||
      (activeDirectConversation.unread_count ?? 0) === 0
    ) {
      return;
    }

    markDirectConversationRead(
      activeDirectConversation.id,
    ).catch((requestError) => {
      setDirectConversationsError(
        requestError.message,
      );
    });
  }, [
    mainView,
    activeDirectConversation,
    markDirectConversationRead,
  ]);

  useEffect(() => {
    setActiveChannel(null);

    loadWorkspaceData(
      activeWorkspace,
    );
  }, [
    activeWorkspace,
    loadWorkspaceData,
  ]);

  useEffect(() => {
    if (
      !notificationTargetChannelId ||
      channelsLoading
    ) {
      return;
    }
    const targetChannel =
      channels.find(
        (channel) =>
          channel.id ===
          notificationTargetChannelId,
      );
    if (targetChannel) {
      setActiveChannel(
        targetChannel,
      );
      setMainView("chat");
      setNotificationTargetChannelId(
        null,
      );
    }
  }, [
    channels,
    channelsLoading,
    notificationTargetChannelId,
  ]);

  function selectWorkspace(
    workspace,
  ) {
    setNotificationTargetChannelId(
      null,
    );
    setActiveWorkspace(
      workspace,
    );
    setMainView("chat");
    setMobileDetailOpen(false);
  }

  function openDirectMessages() {
    setNotificationTargetChannelId(
      null,
    );

    setActiveChannel(null);

    setActiveDirectConversation(
      (currentConversation) => {
        if (
          currentConversation &&
          directConversations.some(
            (conversation) =>
              conversation.id ===
              currentConversation.id,
          )
        ) {
          return currentConversation;
        }

        return (
          directConversations[0] ??
          null
        );
      },
    );

    setMainView("direct");
    setMobileDetailOpen(false);
  }

  function openSettings() {
    setNotificationTargetChannelId(
      null,
    );
    setSettingsSection(
      "profile",
    );
    setMainView(
      "settings",
    );
    setMobileDetailOpen(false);
  }

  function openProfileSettings() {
    setNotificationTargetChannelId(
      null,
    );
    setSettingsSection(
      "profile",
    );
    setMainView(
      "settings",
    );
    setMobileDetailOpen(true);
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
    setMobileDetailOpen(false);
  }

  function handleWorkspaceUpdated(
    updatedWorkspace,
  ) {
    setWorkspaces(
      (currentWorkspaces) =>
        currentWorkspaces.map(
          (workspace) =>
            workspace.id ===
            updatedWorkspace.id
              ? updatedWorkspace
              : workspace,
        ),
    );
    setActiveWorkspace(
      (currentWorkspace) =>
        currentWorkspace?.id ===
        updatedWorkspace.id
          ? updatedWorkspace
          : currentWorkspace,
    );
  }

  function handleWorkspaceRemoved(
    removedWorkspace,
  ) {
    const remainingWorkspaces =
      workspaces.filter(
        (workspace) =>
          workspace.id !==
          removedWorkspace.id,
      );
    setWorkspaces(
      remainingWorkspaces,
    );
    const nextWorkspace =
      remainingWorkspaces[0] ??
      null;
    setActiveWorkspace(
      nextWorkspace,
    );
    setChannels([]);
    setActiveChannel(null);
    setDirectConversations([]);
    setActiveDirectConversation(
      null,
    );
    setWorkspaceRole(null);
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
    setActiveDirectConversation(
      null,
    );

    setActiveChannel(channel);
    setMainView("chat");
  }

  function handleDirectConversationCreated(
    conversation,
  ) {
    setDirectConversations(
      (currentConversations) => {
        const exists =
          currentConversations.some(
            (currentConversation) =>
              currentConversation.id ===
              conversation.id,
          );

        if (exists) {
          return [
            conversation,
            ...currentConversations.filter(
              (currentConversation) =>
                currentConversation.id !==
                conversation.id,
            ),
          ];
        }

        return [
          conversation,
          ...currentConversations,
        ];
      },
    );

    setActiveDirectConversation(
      conversation,
    );

    setActiveChannel(null);
    setMainView("direct");
  }


  function handleChannelUpdated(
    updatedChannel,
  ) {
    setChannels(
      (currentChannels) =>
        sortChannels(
          currentChannels.map(
            (channel) =>
              channel.id ===
              updatedChannel.id
                ? updatedChannel
                : channel,
          ),
        ),
    );
    setActiveChannel(
      (currentChannel) =>
        currentChannel?.id ===
        updatedChannel.id
          ? updatedChannel
          : currentChannel,
    );
  }

  function handleChannelDeleted(
    deletedChannel,
  ) {
    const remainingChannels =
      channels.filter(
        (channel) =>
          channel.id !==
          deletedChannel.id,
      );
    setChannels(
      remainingChannels,
    );
    if (
      activeChannel?.id !==
      deletedChannel.id
    ) {
      return;
    }
    const nextChannel =
      remainingChannels.find(
        (channel) =>
          channel.is_general,
      ) ??
      remainingChannels[0] ??
      null;
    setActiveChannel(
      nextChannel,
    );
    setMainView("chat");
  }

  async function handleLeftChannel(
    channel,
  ) {
    if (!activeWorkspace) {
      return;
    }
    const response =
      await apiRequest(
        `/api/workspaces/${activeWorkspace.id}/channels/`,
      );
    if (!response.ok) {
      setChannelError(
        await readApiError(
          response,
          "Unable to refresh channels.",
        ),
      );
      return;
    }
    const channelData =
      await response.json();
    const sortedChannels =
      sortChannels(channelData);
    setChannels(
      sortedChannels,
    );
    const nextChannel =
      sortedChannels.find(
        (currentChannel) =>
          currentChannel.is_general,
      ) ??
      sortedChannels.find(
        (currentChannel) =>
          currentChannel.id !==
          channel.id,
      ) ??
      null;
    setActiveChannel(
      nextChannel,
    );
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

  function handleOpenNotification(
    notification,
  ) {
    const payload =
      notification.payload ?? {};
    const workspaceId =
      payload.workspace_id;
    const channelId =
      payload.channel_id;
    if (!workspaceId) {
      return;
    }
    const targetWorkspace =
      workspaces.find(
        (workspace) =>
          workspace.id ===
          workspaceId,
      );
    if (!targetWorkspace) {
      return;
    }
    if (channelId) {
      setNotificationTargetChannelId(
        channelId,
      );
    }
    setActiveWorkspace(
      targetWorkspace,
    );
    setMainView("chat");
    setMobileDetailOpen(true);
  }

  const activityControls = (
    <HeaderActivityControls
      notifications={
        notifications
      }
      unreadCount={
        unreadCount
      }
      notificationsLoading={
        notificationsLoading
      }
      notificationsError={
        notificationsError
      }
      markRead={markRead}
      markUnread={markUnread}
      onOpenNotification={
        handleOpenNotification
      }
      onInvitationAccepted={
        handleInvitationAccepted
      }
    />
  );

  return (
    <>
      <main className={`dashboard-page channel-layout ${mobileDetailOpen ? "mobile-detail-open" : "mobile-list-open"}`}>
        <aside className="workspace-rail">
          <button
            className="workspace-logo"
            type="button"
            title="Direct Messages"
            aria-label="Open Direct Messages"
            onClick={
              openDirectMessages
            }
            style={{
              position: "relative",
              padding: 0,
              border: 0,
              cursor: "pointer",
            }}
          >
            C

            {unreadDirectConversationsCount >
              0 && (
              <span
                aria-label={`${unreadDirectConversationsCount} unread direct conversations`}
                style={{
                  position: "absolute",
                  top: "-5px",
                  right: "-5px",
                  display: "grid",
                  minWidth: "18px",
                  height: "18px",
                  padding: "0 5px",
                  placeItems: "center",
                  border: "2px solid #080d16",
                  borderRadius: "999px",
                  background: "#ef4444",
                  color: "#ffffff",
                  fontSize: "10px",
                  fontWeight: 800,
                  lineHeight: 1,
                }}
              >
                {unreadDirectConversationsCount >
                99
                  ? "99+"
                  : unreadDirectConversationsCount}
              </span>
            )}
          </button>
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
                    mainView !== "settings" &&
                    activeWorkspace?.id ===
                      workspace.id
                      ? "active"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  type="button"
                  key={workspace.id}
                  title={
                    workspace.name
                  }
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
          <div className="mobile-rail-footer">
            <div className="mobile-rail-activity">
              <HeaderActivityControls
                notifications={notifications}
                unreadCount={unreadCount}
                notificationsLoading={notificationsLoading}
                notificationsError={notificationsError}
                markRead={markRead}
                markUnread={markUnread}
                onOpenNotification={handleOpenNotification}
                onInvitationAccepted={handleInvitationAccepted}
              />
            </div>
            <div className="mobile-rail-account">
              <AccountConnectionsLauncher
                user={user}
                logout={logout}
                onEditProfile={openProfileSettings}
                onUserChanged={loadUser}
              />
            </div>
          </div>
          <button
            className={[
              "workspace-settings-button",
              mainView === "settings" ? "active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            type="button"
            title="Settings"
            aria-label="Settings"
            onClick={openSettings}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx="12"
                cy="12"
                r="3.1"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          </button>
        </aside>
        <section className="channel-sidebar">
          {mainView === "settings" ? (
            <>
              <div className="channel-sidebar-header settings-sidebar-header">
                <div className="channel-workspace-heading">
                  <span>
                    CollabSpace
                  </span>
                  <strong>
                    Settings
                  </strong>
                  <small>
                    PERSONAL
                  </small>
                </div>
              </div>
              <div className="channel-sidebar-body settings-sidebar-body">
                <div className="settings-navigation">
                  <span className="settings-navigation-label">
                    Account
                  </span>
                  <button
                    className={
                      settingsSection ===
                      "profile"
                        ? "active"
                        : ""
                    }
                    type="button"
                    onClick={() => {
                      setMobileDetailOpen(true);
                      setSettingsSection("profile");
                    }}
                  >
                    <span>
                      P
                    </span>
                    <div>
                      <strong>
                        Profile
                      </strong>
                      <small>
                        Personal information
                      </small>
                    </div>
                  </button>
                  <button
                    className={
                      settingsSection ===
                      "appearance"
                        ? "active"
                        : ""
                    }
                    type="button"
                    onClick={() => {
                      setSettingsSection("appearance");
                      setMobileDetailOpen(true);
                    }}
                  >
                    <span>
                      Aa
                    </span>
                    <div>
                      <strong>
                        Appearance
                      </strong>
                      <small>
                        Interface preferences
                      </small>
                    </div>
                  </button>
                  <span className="settings-navigation-label settings-navigation-section">
                    Security
                  </span>
                  <button
                    className={
                      settingsSection ===
                      "sign-in"
                        ? "active"
                        : ""
                    }
                    type="button"
                    onClick={() => {
                      setSettingsSection("sign-in");
                      setMobileDetailOpen(true);
                    }}
                  >
                    <span>
                      S
                    </span>
                    <div>
                      <strong>
                        Sign-in Methods
                      </strong>
                      <small>
                        Password and providers
                      </small>
                    </div>
                  </button>
                </div>
                <div className="settings-sidebar-note">
                  Select a Workspace icon to return
                  to your channels.
                </div>
              </div>
            </>
          ) : mainView === "direct" ? (
            <>
              <div className="channel-sidebar-header">
                <div className="channel-workspace-heading">
                  <span>
                    Messages
                  </span>

                  <strong>
                    Direct Messages
                  </strong>

                </div>

                <button
                  className="channel-create-icon"
                  type="button"
                  title="New conversation"
                  aria-label="New conversation"
                  onClick={() =>
                    setCreateDirectConversationModalOpen(
                      true,
                    )
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 5v14M5 12h14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>

              <div className="channel-sidebar-body">
                {directConversationsLoading && (
                  <div className="channel-sidebar-status">
                    Loading conversations...
                  </div>
                )}

                {!directConversationsLoading &&
                  directConversationsError && (
                    <div className="channel-sidebar-error">
                      <span>
                        {directConversationsError}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          loadDirectConversations()
                        }
                      >
                        Retry
                      </button>
                    </div>
                  )}

                {!directConversationsLoading &&
                  !directConversationsError &&
                  directConversations.length ===
                    0 && (
                    <div className="direct-messages-state">
                      No direct messages yet.
                    </div>
                  )}

                {!directConversationsLoading &&
                  !directConversationsError && (
                    <div className="direct-message-list">
                      {directConversations.map(
                        (conversation) => {
                          const otherParticipant =
                            conversation.type ===
                            "DIRECT"
                              ? conversation.participants.find(
                                  (participant) =>
                                    participant.user_id !==
                                    user.id,
                                )
                              : null;

                          const conversationUnreadCount =
                            conversation.unread_count ??
                            0;

                          return (
                            <button
                              className={[
                                "direct-message-list-item",
                                activeDirectConversation
                                  ?.id ===
                                conversation.id
                                  ? "active"
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              type="button"
                              key={
                                conversation.id
                              }
                              onClick={() => {
                                setActiveDirectConversation(
                                  conversation,
                                );
                                setMobileDetailOpen(true);

                                setActiveChannel(
                                  null,
                                );

                                setMainView(
                                  "direct",
                                );
                              }}
                            >
                              {conversation.type ===
                              "DIRECT" ? (
                                <div className="presence-avatar-shell direct-message-avatar-shell">
                                  <UserAvatar
                                    className="direct-message-avatar"
                                    username={
                                      otherParticipant
                                        ?.username ??
                                      "DM"
                                    }
                                    avatarUrl={
                                      otherParticipant
                                        ?.avatar_url ??
                                      null
                                    }
                                  />

                                  {otherParticipant && (
                                    <PresenceStatusDot
                                      userId={
                                        otherParticipant
                                          .user_id
                                      }
                                      status={
                                        otherParticipant
                                          .status
                                      }
                                    />
                                  )}
                                </div>
                              ) : (
                                <div className="direct-message-group-avatar">
                                  G
                                </div>
                              )}

                              <span className="direct-message-list-copy">
                                <strong>
                                  {directConversationTitle(
                                    conversation,
                                    user.id,
                                  )}
                                </strong>

                                <small>
                                  {conversation.type ===
                                  "GROUP"
                                    ? `${conversation.participants.length} members`
                                    : "Direct message"}
                                </small>
                              </span>

                              {conversationUnreadCount >
                                0 && (
                                <span
                                  aria-label={`${conversationUnreadCount} unread messages`}
                                  style={{
                                    display:
                                      "grid",
                                    minWidth:
                                      "20px",
                                    height:
                                      "20px",
                                    padding:
                                      "0 6px",
                                    placeItems:
                                      "center",
                                    borderRadius:
                                      "999px",
                                    background:
                                      "#ef4444",
                                    color:
                                      "#ffffff",
                                    fontSize:
                                      "10px",
                                    fontWeight:
                                      800,
                                    lineHeight:
                                      1,
                                  }}
                                >
                                  {conversationUnreadCount >
                                  99
                                    ? "99+"
                                    : conversationUnreadCount}
                                </span>
                              )}
                            </button>
                          );
                        },
                      )}
                    </div>
                  )}
              </div>
            </>
          ) : (
            <>
              <div className="channel-sidebar-header">
                <div
                  className="channel-workspace-heading mobile-workspace-heading"
                  onClick={(event) => {
                    if (window.matchMedia("(max-width: 650px)").matches && activeWorkspace) {
                      event.currentTarget.parentElement?.querySelector(".workspace-more-button")?.click();
                    }
                  }}
                >
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
                {activeWorkspace && (
                  <WorkspaceActionsMenu
                    key={activeWorkspace.id}
                    workspace={
                      activeWorkspace
                    }
                    workspaceRole={
                      workspaceRole
                    }
                    onWorkspaceUpdated={
                      handleWorkspaceUpdated
                    }
                    onWorkspaceRemoved={
                      handleWorkspaceRemoved
                    }
                  />
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
                      onClick={() => {
                        setActiveDirectConversation(
                          null,
                        );

                        setMainView(
                          "chat",
                        );
                      }}
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
                      onClick={() => {
                        setMainView("members");
                        setMobileDetailOpen(true);
                      }}
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
                                    <div
                                      className="channel-list-row"
                                      key={channel.id}
                                    >
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
                                        onClick={() => {
                                          setActiveDirectConversation(
                                            null,
                                          );

                                          setActiveChannel(
                                            channel,
                                          );
                                          setMobileDetailOpen(true);

                                          setMainView(
                                            "chat",
                                          );
                                        }}
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
                                      <ChannelActionsMenu
                                        channel={channel}
                                        workspace={
                                          activeWorkspace
                                        }
                                        user={user}
                                        workspaceRole={
                                          workspaceRole
                                        }
                                        onLeftChannel={
                                          handleLeftChannel
                                        }
                                        onChannelUpdated={
                                          handleChannelUpdated
                                        }
                                        onChannelDeleted={
                                          handleChannelDeleted
                                        }
                                      />
                                    </div>
                                  ),
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
                                    <div
                                      className="channel-list-row"
                                      key={channel.id}
                                    >
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
                                        onClick={() => {
                                          setActiveDirectConversation(
                                            null,
                                          );

                                          setActiveChannel(
                                            channel,
                                          );
                                          setMobileDetailOpen(true);

                                          setMainView(
                                            "chat",
                                          );
                                        }}
                                      >
                                        <span className="channel-symbol private">
                                          🔒
                                        </span>
                                        <span className="channel-name">
                                          {channel.name}
                                        </span>
                                      </button>
                                      <ChannelActionsMenu
                                        channel={channel}
                                        workspace={
                                          activeWorkspace
                                        }
                                        user={user}
                                        workspaceRole={
                                          workspaceRole
                                        }
                                        onLeftChannel={
                                          handleLeftChannel
                                        }
                                        onChannelUpdated={
                                          handleChannelUpdated
                                        }
                                        onChannelDeleted={
                                          handleChannelDeleted
                                        }
                                      />
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>


                          </>
                        )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
          <div className="channel-sidebar-footer">
            <AccountConnectionsLauncher
              user={user}
              logout={logout}
              onEditProfile={
                openProfileSettings
              }
              onUserChanged={
                loadUser
              }
            />
          </div>
        </section>
        <section className="channel-content">
          <div className="mobile-detail-header">
            <button type="button" onClick={() => setMobileDetailOpen(false)} aria-label="Back to conversations">←</button>
            <strong>{mainView === "settings" ? "Settings" : mainView === "members" ? "Members" : mainView === "direct" ? (activeDirectConversation ? directConversationTitle(activeDirectConversation, user.id) : "Messages") : (activeChannel?.name ?? "Channels")}</strong>
          </div>
          {mainView === "settings" ? (
            <SettingsContent
              section={
                settingsSection
              }
              user={user}
              onUserChanged={
                loadUser
              }
            />
          ) : (
            <>
              {mainView !== "chat" &&
                mainView !== "direct" && (
                <div className="standalone-activity-controls">
                  {activityControls}
                </div>
              )}
              {mainView !== "direct" &&
                !activeWorkspace &&
                !workspacesLoading && (
                  <div className="standalone-activity-controls">
                    {activityControls}
                  </div>
                )}
              {mainView !== "direct" &&
                workspacesLoading && (
                <div className="workspace-state">
                  <div className="state-spinner" />
                  <h2>
                    Loading workspaces
                  </h2>
                </div>
              )}
              {mainView !== "direct" &&
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
                      onClick={
                        loadWorkspaces
                      }
                    >
                      Try again
                    </button>
                  </div>
                )}
              {mainView !== "direct" &&
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
                      Create a workspace or
                      accept an invitation
                      from the top-right
                      invitation icon.
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
              {mainView === "direct" &&
                activeDirectConversation && (
                  <DirectConversationChat
                    key={
                      activeDirectConversation.id
                    }
                    conversation={
                      activeDirectConversation
                    }
                    user={user}
                    activityControls={
                      activityControls
                    }
                  />
                )}

              {mainView === "chat" &&
                activeWorkspace &&
                !channelsLoading &&
                !channelError &&
                !activeChannel && (
                  <div className="workspace-state">
                    <div className="standalone-activity-controls">
                      {activityControls}
                    </div>
                    <div className="state-icon">
                      #
                    </div>
                    <h2>
                      No channels available
                    </h2>
                  </div>
                )}
              {mainView === "chat" &&
                activeWorkspace &&
                activeChannel && (
                  <ChannelAccessGate
                    key={activeChannel.id}
                    channel={
                      activeChannel
                    }
                    workspace={
                      activeWorkspace
                    }
                    user={user}
                    workspaceRole={
                      workspaceRole
                    }
                    activityControls={
                      activityControls
                    }
                    onLeftChannel={
                      handleLeftChannel
                    }
                  />
                )}
            </>
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

      <CreateDirectConversationModal
        open={
          createDirectConversationModalOpen
        }
        user={user}
        onClose={() =>
          setCreateDirectConversationModalOpen(
            false,
          )
        }
        onCreated={
          handleDirectConversationCreated
        }
      />
    </>
  );
}
export default DashboardPage;