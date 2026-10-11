# WebSocket Protocol

This document describes the WebSocket protocol used by the Realtime Collaboration Platform.

The application currently exposes two WebSocket endpoints:

- channel WebSocket for realtime chat activity;
- notification WebSocket for per-user realtime notifications.

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

Expired or invalid access tokens are treated as unauthenticated connections.

### Authentication close codes

| Code | Meaning |
| --- | --- |
| `4401` | Authentication is missing, invalid, or expired |
| `4403` | User is authenticated but does not have access to the requested channel |

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

In production, when HTTPS is enabled, clients must use `wss://`.

A user can connect only when they have an explicit `ChannelMembership` for the requested channel and still belong to its workspace.

---

## Event envelope

Client and server events use the following JSON structure:

```json
{
  "type": "event.name",
  "data": {}
}
```

`type` identifies the event.

`data` contains the event payload.

---

# Client → Server Events

## message.create

Creates a new message in the connected channel.

### Request

```json
{
  "type": "message.create",
  "data": {
    "text": "Hello everyone"
  }
}
```

### Reply to another message

To create a reply, include `reply_to_id`:

```json
{
  "type": "message.create",
  "data": {
    "text": "I agree",
    "reply_to_id": 42
  }
}
```

`reply_to_id` must reference a message from the same channel.

### Validation

- `text` must be a string;
- whitespace is trimmed;
- empty messages are rejected;
- `reply_to_id`, when provided, must be an integer;
- the referenced reply message must exist in the same channel;
- the user must still have channel access.

### Success

The server broadcasts a `message.created` event to all connected users in the channel.

---

## message.update

Edits an existing message.

### Request

```json
{
  "type": "message.update",
  "data": {
    "message_id": 42,
    "text": "Updated message text"
  }
}
```

### Validation

- `message_id` must be an integer;
- `text` must be a non-empty string;
- edit permissions are checked by the backend;
- the user must still have channel access.

### Success

The server broadcasts:

```text
message.updated
```

to all connected users in the channel.

---

## message.delete

Soft-deletes an existing message.

### Request

```json
{
  "type": "message.delete",
  "data": {
    "message_id": 42
  }
}
```

### Validation

- `message_id` must be an integer;
- delete permissions are checked by the backend;
- the user must still have channel access.

### Success

The server broadcasts:

```text
message.deleted
```

The deleted message remains represented in the system, but its text is returned as `null`.

---

## typing.start

Indicates that the current user started typing.

### Request

```json
{
  "type": "typing.start",
  "data": {}
}
```

The server broadcasts `typing.started` to the other connected users in the channel.

The sender does not receive their own typing event.

---

## typing.stop

Indicates that the current user stopped typing.

### Request

```json
{
  "type": "typing.stop",
  "data": {}
}
```

The server broadcasts `typing.stopped` to the other connected users in the channel.

The sender does not receive their own typing event.

---

# Server → Client Events

## Message payload

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
    "reply_to": null,
    "reply_to_message": null,
    "text": "Hello everyone",
    "created_at": "2026-10-11T10:30:00+00:00",
    "updated_at": "2026-10-11T10:30:00+00:00",
    "edited_at": null,
    "is_deleted": false
  }
}
```

---

## Reply snapshot

When a message is a reply, `reply_to` contains the source message ID and `reply_to_message` contains a snapshot of that message.

Example:

```json
{
  "reply_to": 41,
  "reply_to_message": {
    "id": 41,
    "author_id": 5,
    "author_username": "bob",
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
    "text": null,
    "is_deleted": true
  }
}
```

---

## message.created

Broadcast after a message is successfully created.

```json
{
  "type": "message.created",
  "data": {
    "id": 42,
    "channel_id": 12,
    "author_id": 7,
    "author_username": "alice",
    "reply_to": null,
    "reply_to_message": null,
    "text": "Hello everyone",
    "created_at": "2026-10-11T10:30:00+00:00",
    "updated_at": "2026-10-11T10:30:00+00:00",
    "edited_at": null,
    "is_deleted": false
  }
}
```

---

## message.updated

Broadcast after a message is successfully edited.

```json
{
  "type": "message.updated",
  "data": {
    "id": 42,
    "channel_id": 12,
    "author_id": 7,
    "author_username": "alice",
    "reply_to": null,
    "reply_to_message": null,
    "text": "Updated message text",
    "created_at": "2026-10-11T10:30:00+00:00",
    "updated_at": "2026-10-11T10:35:00+00:00",
    "edited_at": "2026-10-11T10:35:00+00:00",
    "is_deleted": false
  }
}
```

---

## message.deleted

Broadcast after a message is successfully soft-deleted.

```json
{
  "type": "message.deleted",
  "data": {
    "id": 42,
    "channel_id": 12,
    "author_id": 7,
    "author_username": "alice",
    "reply_to": null,
    "reply_to_message": null,
    "text": null,
    "created_at": "2026-10-11T10:30:00+00:00",
    "updated_at": "2026-10-11T10:40:00+00:00",
    "edited_at": null,
    "is_deleted": true
  }
}
```

---

## typing.started

Broadcast when another user starts typing.

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

## typing.stopped

Broadcast when another user stops typing.

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

# Error Events

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

Possible error codes include:

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

Example:

```json
{
  "type": "error",
  "data": {
    "code": "invalid_message_text",
    "message": "Message text cannot be empty."
  }
}
```

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

Authentication uses the same JWT WebSocket subprotocol:

```text
jwt.<access_token>
```

Unlike the channel socket, this connection belongs directly to the authenticated user.

The backend subscribes the connection to the user's private notification group.

---

## notification.created

The notification socket currently receives server-originated events only.

Clients do not send application events through this socket.

Example:

```json
{
  "type": "notification.created",
  "data": {
    "id": 18,
    "type": "mention",
    "payload": {},
    "is_read": false,
    "created_at": "2026-10-11T10:30:00+00:00"
  }
}
```

The exact contents of `payload` depend on the notification type.

Current notification types are:

```text
mention
channel_added
workspace_invitation
```

Persistent notification history and read/unread operations are handled through the REST API.

---

# Connection Lifecycle

The frontend should:

1. obtain a valid JWT access token;
2. refresh the token through the REST API when necessary;
3. open the WebSocket using `jwt.<access_token>`;
4. reconnect when appropriate after an unexpected disconnect;
5. close obsolete channel sockets when switching channels.

The current frontend performs JWT refresh before creating authenticated WebSocket connections.

---

# Transport Responsibilities

REST API is responsible for:

- authentication;
- workspace management;
- channel management;
- membership management;
- invitation management;
- message history;
- notification history;
- notification read/unread state.

WebSocket transport is responsible for:

- message creation;
- message editing;
- message deletion;
- typing indicators;
- realtime message broadcasts;
- realtime notification delivery.

Redis is used by Django Channels as the channel layer for communication between WebSocket connections and application processes.
