from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def presence_group_name(
    workspace_id,
):
    return f"presence_workspace_{workspace_id}"


def broadcast_user_status(
    user,
):
    channel_layer = get_channel_layer()

    if channel_layer is None:
        return

    workspace_ids = list(
        user.workspace_memberships.values_list(
            "workspace_id",
            flat=True,
        )
    )

    data = {
        "user_id": user.id,
        "status": user.status,
    }

    for workspace_id in workspace_ids:
        async_to_sync(channel_layer.group_send)(
            presence_group_name(
                workspace_id,
            ),
            {
                "type": "presence.status_changed",
                "data": data,
            },
        )
