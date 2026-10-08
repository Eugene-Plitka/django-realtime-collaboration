from channels.generic.websocket import AsyncJsonWebsocketConsumer


class ChannelConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.channel_id = self.scope["url_route"]["kwargs"]["channel_id"]
        self.group_name = f"channel_{self.channel_id}"

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name,
        )

        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name,
        )
