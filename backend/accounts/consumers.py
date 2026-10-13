from channels.db import (
    database_sync_to_async,
)
from channels.generic.websocket import (
    AsyncJsonWebsocketConsumer,
)

from .presence import (
    presence_group_name,
)


@database_sync_to_async
def get_user_workspace_ids(
    user,
):
    return list(
        user.workspace_memberships.values_list(
            "workspace_id",
            flat=True,
        )
    )


class PresenceConsumer(
    AsyncJsonWebsocketConsumer,
):
    async def connect(self):
        user = self.scope["user"]

        if not user.is_authenticated:
            await self.close(
                code=4401,
            )
            return

        workspace_ids = await get_user_workspace_ids(
            user,
        )

        self.group_names = [
            presence_group_name(
                workspace_id,
            )
            for workspace_id in workspace_ids
        ]

        for group_name in self.group_names:
            await self.channel_layer.group_add(
                group_name,
                self.channel_name,
            )

        await self.accept(
            subprotocol=self.scope.get(
                "jwt_subprotocol",
            ),
        )

    async def disconnect(
        self,
        close_code,
    ):
        for group_name in getattr(
            self,
            "group_names",
            [],
        ):
            await self.channel_layer.group_discard(
                group_name,
                self.channel_name,
            )

    async def presence_status_changed(
        self,
        event,
    ):
        await self.send_json(
            {
                "type": "presence.status_changed",
                "data": event["data"],
            }
        )
