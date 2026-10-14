# WebSocket Protocol

This document describes the WebSocket protocol used by the Realtime Collaboration Platform.

The application exposes four authenticated WebSocket endpoints:

- channel WebSocket for realtime workspace channel activity;
- direct-conversation WebSocket for realtime direct and group messages;
- notification WebSocket for per-user notifications and direct-message unread updates;
- presence WebSocket for realtime user-status updates.

All WebSocket connections are authenticated with a JWT access token.

---

## Authentication

WebSocket authentication uses the `Sec-WebSocket-Protocol` header.

The client must provide the JWT access token as a WebSocket subprotocol using this format:

```text
jwt.<access_token>
```

Example in JavaScript:

```javascript
const socket = new WebSocket(
  "ws://localhost:8000/ws/channels/1/",
  [`jwt.${accessToken}`],
)
```

The server accepts the same JWT subprotocol when authentication succeeds.

Expired, missing, or invalid access tokens are treated as unauthenticated connections.

### Authentication close codes

| Code | Meaning |
| --- | --- |
| `4401` | Authentication is missing, invalid, or expired |
| `4403` | User is authenticated but does not have access to the requested resource |

In production, clients must use `wss://` when HTTPS is enabled.

---

# Common Event Envelope

Application WebSocket events use this JSON structure:

```json
{
  "type": "event.name",
  "data": {}
}
```

`type` identifies the event.

`data` contains the event payload.

---

# Channel WebSocket

## Endpoint

```text
/ws/channels/{channel_id}/
```

Example:

```text
ws://localhost:8000/ws/channels/12/
```

A user can connect only when they have an explicit `ChannelMembership` for the requested channel and still belong to the channel's workspace.

---

## Client → Server Events

### message.create

Creates a new message in the connected channel.

```json
{
  "type": "message.create",
  "data": {
    "text": "Hello everyone"
  }
}
```

To create a reply:

```json
{
  "type": "message.create",
  "data": {
    "text": "I agree",
    "reply_to_id": 42
  }
}
```

Validation rules:

- `text` must be a string;
- whitespace is trimmed;
- empty messages are rejected;
- `reply_to_id`, when provided, must be an integer;
- the reply target must belong to the same channel;
- the user must still have access to the channel.

Successful creation broadcasts:

```text
message.created
```

---

### message.update

Edits an existing message.

```json
{
  "type": "message.update",
  "data": {
    "message_id": 42,
    "text": "Updated message text"
  }
}
```

Validation rules:

- `message_id` must be an integer;
- `text` must be a non-empty string;
- edit permissions are checked by the backend;
- the user must still have channel access.

Successful update broadcasts:

```text
message.updated
```

---

### message.delete

Soft-deletes an existing message.

```json
{
  "type": "message.delete",
  "data": {
    "message_id": 42
  }
}
```

Successful deletion broadcasts:

```text
message.deleted
```

The message remains represented in the system, but deleted message text is returned as `null`.

---

### reaction.toggle

Adds or removes the authenticated user's reaction on a message.

```json
{
  "type": "reaction.toggle",
  "data": {
    "message_id": 42,
    "emoji": "👍"
  }
}
```

Supported reactions are defined by the backend `MessageReaction.Emoji` choices.

Successful changes broadcast:

```text
reaction.updated
```

Example payload:

```json
{
  "type": "reaction.updated",
  "data": {
    "message_id": 42,
    "emoji": "👍",
    "count": 3,
    "user_id": 7,
    "reacted": true
  }
}
```

`reacted` indicates whether the triggering user now has that reaction applied.

---

### typing.start

Indicates that the current user started typing.

```json
{
  "type": "typing.start",
  "data": {}
}
```

The server broadcasts:

```text
typing.started
```

to the other connected channel members.

The sender does not receive their own typing event.

---

### typing.stop

Indicates that the current user stopped typing.

```json
{
  "type": "typing.stop",
  "data": {}
}
```

The server broadcasts:

```text
typing.stopped
```

to the other connected channel members.

The sender does not receive their own typing event.

---

## Server → Client Events

### Channel message payload

The following structure is used by:

- `message.created`;
- `message.updated`;
- `message.deleted`.

Example:

```json
{
  "type": "message.created",
  "data": {
    "id": 42,
    "channel_id": 12,
    "author_id": 7,
    "author_username": "alice",
    "author_avatar_url": null,
    "author_status": "ONLINE",
    "reply_to": null,
    "reply_to_message": null,
    "reactions": [],
    "text": "Hello everyone",
    "created_at": "2026-10-14T10:30:00+00:00",
    "updated_at": "2026-10-14T10:30:00+00:00",
    "edited_at": null,
    "is_deleted": false
  }
}
```

---

### Reply snapshot

When a message is a reply, `reply_to` contains the source message ID and `reply_to_message` contains a snapshot.

Example:

```json
{
  "reply_to": 41,
  "reply_to_message": {
    "id": 41,
    "author_id": 5,
    "author_username": "bob",
    "author_avatar_url": null,
    "author_status": "ONLINE",
    "text": "Original message",
    "is_deleted": false
  }
}
```

If the referenced message has been deleted:

```json
{
  "reply_to_message": {
    "id": 41,
    "author_id": 5,
    "author_username": "bob",
    "author_avatar_url": null,
    "author_status": "ONLINE",
    "text": null,
    "is_deleted": true
  }
}
```

---

### message.created

Broadcast after a channel message is successfully created.

---

### message.updated

Broadcast after a channel message is successfully edited.

---

### message.deleted

Broadcast after a channel message is successfully soft-deleted.

---

### reaction.updated

Broadcast after a reaction is added or removed.

---

### typing.started

```json
{
  "type": "typing.started",
  "data": {
    "user_id": 7,
    "username": "alice"
  }
}
```

---

### typing.stopped

```json
{
  "type": "typing.stopped",
  "data": {
    "user_id": 7,
    "username": "alice"
  }
}
```

---

## Channel Error Events

Protocol and validation failures are returned as WebSocket events instead of closing the connection.

Format:

```json
{
  "type": "error",
  "data": {
    "code": "error_code",
    "message": "Human-readable error message."
  }
}
```

Possible channel error codes include:

| Code | Meaning |
| --- | --- |
| `unsupported_event` | Event type is not supported |
| `channel_access_denied` | User lost access to the channel |
| `invalid_message_text` | Message text is missing, invalid, or empty |
| `invalid_message_id` | Message ID is not an integer |
| `invalid_reply_message_id` | Reply message ID is not an integer |
| `reply_message_not_found` | Reply target does not exist in the current channel |
| `message_create_failed` | Message could not be created |
| `message_not_found` | Message does not exist in the current channel |
| `message_edit_forbidden` | User cannot edit the requested message |
| `message_delete_forbidden` | User cannot delete the requested message |
| `message_deleted` | Reaction target is already deleted |
| `invalid_reaction` | Reaction emoji is not supported |

---

# Direct Conversation WebSocket

## Endpoint

```text
/ws/direct-conversations/{conversation_id}/
```

Example:

```text
ws://localhost:8000/ws/direct-conversations/8/
```

This endpoint is used for both:

- one-to-one direct conversations;
- group direct conversations.

Only users who are participants in the requested conversation can connect.

---

## Client → Server Events

### direct_message.create

Creates a message in the current direct conversation.

```json
{
  "type": "direct_message.create",
  "data": {
    "text": "Hello"
  }
}
```

To create a reply:

```json
{
  "type": "direct_message.create",
  "data": {
    "text": "Replying here",
    "reply_to_id": 17
  }
}
```

Validation rules:

- `text` must be a string;
- whitespace is trimmed;
- empty messages are rejected;
- `reply_to_id`, when provided, must be an integer;
- reply targets must belong to the same conversation;
- the user must still be a participant.

Successful creation broadcasts:

```text
direct_message.created
```

to the connected conversation clients.

The backend also sends a personalized unread-state update through the user's notification WebSocket.

---

### direct_message.update

Edits one of the authenticated user's direct messages.

```json
{
  "type": "direct_message.update",
  "data": {
    "message_id": 17,
    "text": "Updated direct message"
  }
}
```

Successful update broadcasts:

```text
direct_message.updated
```

---

### direct_message.delete

Soft-deletes one of the authenticated user's direct messages.

```json
{
  "type": "direct_message.delete",
  "data": {
    "message_id": 17
  }
}
```

Successful deletion broadcasts:

```text
direct_message.deleted
```

---

### typing.start

```json
{
  "type": "typing.start",
  "data": {}
}
```

The server broadcasts `typing.started` to the other connected conversation participants.

---

### typing.stop

```json
{
  "type": "typing.stop",
  "data": {}
}
```

The server broadcasts `typing.stopped` to the other connected conversation participants.

---

## Server → Client Events

### direct_message.created

Broadcast when a new direct message is created.

The payload contains the serialized direct message, including author data, reply information, timestamps, edit state, and deletion state.

---

### direct_message.updated

Broadcast when a direct message is edited.

---

### direct_message.deleted

Broadcast when a direct message is soft-deleted.

---

### typing.started

```json
{
  "type": "typing.started",
  "data": {
    "user_id": 7,
    "username": "alice"
  }
}
```

The sender does not receive their own typing event.

---

### typing.stopped

```json
{
  "type": "typing.stopped",
  "data": {
    "user_id": 7,
    "username": "alice"
  }
}
```

The sender does not receive their own typing event.

---

## Direct Conversation Error Events

Direct-conversation protocol failures use the same generic error envelope:

```json
{
  "type": "error",
  "data": {
    "code": "error_code",
    "message": "Human-readable error message."
  }
}
```

Possible direct-message error codes include:

| Code | Meaning |
| --- | --- |
| `unsupported_event` | Event type is not supported |
| `conversation_access_denied` | User lost access to the conversation |
| `invalid_message_text` | Direct-message text is missing, invalid, or empty |
| `invalid_message_id` | Direct-message ID is not an integer |
| `invalid_reply_message_id` | Reply-message ID is not an integer |
| `direct_message_not_found` | Direct message does not exist in the conversation |
| `direct_message_edit_forbidden` | User cannot edit the requested direct message |
| `direct_message_delete_forbidden` | User cannot delete the requested direct message |

A connection attempt by a non-participant is rejected with close code `4403`.

---

# Notification WebSocket

## Endpoint

```text
/ws/notifications/
```

Example:

```text
ws://localhost:8000/ws/notifications/
```

Unlike conversation sockets, this connection belongs directly to the authenticated user.

The backend subscribes it to a private user-specific channel-layer group.

Clients do not send application events through this socket.

---

## notification.created

Realtime application notification.

Example:

```json
{
  "type": "notification.created",
  "data": {
    "id": 18,
    "type": "mention",
    "payload": {},
    "is_read": false,
    "created_at": "2026-10-14T10:30:00+00:00"
  }
}
```

Current persistent notification types include:

```text
mention
channel_added
workspace_invitation
```

Notification history and notification read/unread operations are handled through the REST API.

---

## direct_message.unread_updated

This event synchronizes direct-conversation unread state for the authenticated user.

Example:

```json
{
  "type": "direct_message.unread_updated",
  "data": {
    "conversation": {
      "id": 8,
      "type": "DIRECT",
      "name": "",
      "created_by": 7,
      "participants": [],
      "unread_count": 2,
      "created_at": "2026-10-14T10:00:00+00:00",
      "updated_at": "2026-10-14T10:30:00+00:00"
    }
  }
}
```

The conversation payload is personalized for the receiving user.

The frontend uses this event to:

- update unread counters;
- reorder conversations when activity changes;
- insert or refresh conversation state;
- synchronize unread state across active clients.

Opening a direct conversation triggers the REST read operation, which resets that user's unread count.

---

# Presence WebSocket

## Endpoint

```text
/ws/presence/
```

Example:

```text
ws://localhost:8000/ws/presence/
```

The connection belongs to the authenticated user.

When the socket connects, the backend subscribes it to presence groups for the workspaces the user currently belongs to.

Clients do not send presence events through this socket.

---

## presence.status_changed

Broadcast when a user's status changes in a shared workspace.

Event format:

```json
{
  "type": "presence.status_changed",
  "data": {
    "user_id": 7,
    "status": "AWAY"
  }
}
```

The exact status value is defined by the backend user-status choices.

The frontend uses this event to update presence indicators without reloading workspace data.

---

# Connection Lifecycle

The frontend should:

1. obtain a valid JWT access token;
2. refresh the access token through the REST API when necessary;
3. open the WebSocket using `jwt.<access_token>`;
4. reconnect after appropriate unexpected disconnects;
5. close obsolete channel or direct-conversation sockets when switching views;
6. keep user-level notification and presence sockets available while the authenticated application is active.

The current frontend performs JWT refresh before creating authenticated WebSocket connections.

---

# Transport Responsibilities

REST API is responsible for:

- authentication;
- workspace management;
- workspace membership management;
- workspace invitations;
- channel management;
- channel membership management;
- channel message history;
- direct-conversation discovery and creation;
- direct-message history;
- direct-conversation read state;
- notification history;
- notification read/unread state;
- profile and account settings.

WebSocket transport is responsible for:

- realtime channel message creation;
- realtime channel message editing;
- realtime channel message deletion;
- channel reactions;
- channel typing indicators;
- realtime direct-message creation;
- realtime direct-message editing;
- realtime direct-message deletion;
- direct-conversation typing indicators;
- realtime notification delivery;
- direct-message unread-state synchronization;
- realtime presence-status delivery.

Redis is used by Django Channels as the channel layer for communication between WebSocket connections and application processes.
