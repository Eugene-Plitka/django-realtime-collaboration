import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  apiRequest,
  readApiError,
} from "../api/client";
import ChannelChat from "./ChannelChat";


function ChannelAccessGate({
  channel,
  workspace,
  user,
  workspaceRole,
  activityControls,
  onLeftChannel,
}) {
  const [
    checkingMembership,
    setCheckingMembership,
  ] = useState(true);

  const [
    isChannelMember,
    setIsChannelMember,
  ] = useState(false);

  const [
    joining,
    setJoining,
  ] = useState(false);

  const [
    accessError,
    setAccessError,
  ] = useState("");


  const checkMembership =
    useCallback(
      async () => {
        setCheckingMembership(true);
        setAccessError("");

        try {
          const response =
            await apiRequest(
              `/api/channels/${channel.id}/members/`,
            );

          if (!response.ok) {
            throw new Error(
              await readApiError(
                response,
                "Unable to check channel membership.",
              ),
            );
          }

          const members =
            await response.json();

          const membershipExists =
            members.some(
              (membership) =>
                membership.user_id ===
                user.id,
            );

          setIsChannelMember(
            membershipExists,
          );
        } catch (requestError) {
          setAccessError(
            requestError.message,
          );

          setIsChannelMember(
            false,
          );
        } finally {
          setCheckingMembership(
            false,
          );
        }
      },
      [
        channel.id,
        user.id,
      ],
    );


  useEffect(() => {
    checkMembership();
  }, [
    checkMembership,
  ]);


  async function joinChannel() {
    if (
      joining ||
      channel.type !== "PUBLIC"
    ) {
      return;
    }

    setJoining(true);
    setAccessError("");

    try {
      const response =
        await apiRequest(
          `/api/channels/${channel.id}/join/`,
          {
            method: "POST",
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Unable to join channel.",
          ),
        );
      }

      setIsChannelMember(true);
    } catch (requestError) {
      setAccessError(
        requestError.message,
      );
    } finally {
      setJoining(false);
    }
  }


  if (
    checkingMembership
  ) {
    return (
      <>
        <header className="channel-content-header">
          <div className="channel-heading-main">
            <div className="channel-heading-title">
              <span>
                {channel.type ===
                "PRIVATE"
                  ? "🔒"
                  : "#"}
              </span>

              <h1>
                {channel.name}
              </h1>
            </div>

            <p>
              {channel.description ||
                "No channel description yet."}
            </p>
          </div>

          <div className="channel-header-actions">
            {activityControls}

            <span className="channel-visibility-pill">
              {channel.type ===
              "PRIVATE"
                ? "Private"
                : "Public"}
            </span>
          </div>
        </header>

        <div className="channel-access-state">
          <div className="state-spinner" />

          <span>
            Checking channel access...
          </span>
        </div>
      </>
    );
  }


  if (
    isChannelMember
  ) {
    return (
      <ChannelChat
        channel={channel}
        workspace={workspace}
        user={user}
        activityControls={
          activityControls
        }
        onLeftChannel={
          onLeftChannel
        }
      />
    );
  }


  return (
    <>
      <header className="channel-content-header">
        <div className="channel-heading-main">
          <div className="channel-heading-title">
            <span>
              {channel.type ===
              "PRIVATE"
                ? "🔒"
                : "#"}
            </span>

            <h1>
              {channel.name}
            </h1>
          </div>

          <p>
            {channel.description ||
              "No channel description yet."}
          </p>
        </div>

        <div className="channel-header-actions">
          {activityControls}

          <span className="channel-visibility-pill">
            {channel.type ===
            "PRIVATE"
              ? "Private"
              : "Public"}
          </span>
        </div>
      </header>

      <div className="channel-join-view">
        <div className="channel-join-card">
          <div className="channel-join-icon">
            {channel.type ===
            "PRIVATE"
              ? "🔒"
              : "#"}
          </div>

          <span className="channel-join-eyebrow">
            {channel.type ===
            "PRIVATE"
              ? "Private channel"
              : "Public channel"}
          </span>

          <h2>
            #{channel.name}
          </h2>

          <p>
            {channel.description ||
              `Join #${channel.name} to read the conversation and send messages.`}
          </p>

          {accessError && (
            <div className="channel-join-error">
              {accessError}
            </div>
          )}

          {channel.type ===
            "PUBLIC" &&
          workspaceRole !==
            "GUEST" ? (
            <button
              className="channel-join-button"
              type="button"
              disabled={joining}
              onClick={
                joinChannel
              }
            >
              {joining
                ? "Joining..."
                : "Join channel"}
            </button>
          ) : (
            <div className="channel-join-restricted">
              {channel.type ===
              "PRIVATE"
                ? "You need to be added by a workspace owner or admin to access this private channel."
                : "Guests cannot join public channels directly."}
            </div>
          )}

          {channel.type ===
            "PUBLIC" &&
            workspaceRole !==
              "GUEST" && (
            <span className="channel-join-note">
              Joining gives you access
              to message history,
              realtime messages and
              mentions in this channel.
            </span>
          )}
        </div>
      </div>
    </>
  );
}


export default ChannelAccessGate;