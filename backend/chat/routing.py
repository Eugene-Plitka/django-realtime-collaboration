from django.urls import re_path

from .consumers import (
    ChannelConsumer,
    DirectConversationConsumer,
)


websocket_urlpatterns = [
    re_path(
        r"ws/channels/(?P<channel_id>\d+)/$",
        ChannelConsumer.as_asgi(),
    ),
    re_path(
        (
            r"ws/direct-conversations/"
            r"(?P<conversation_id>\d+)/$"
        ),
        DirectConversationConsumer.as_asgi(),
    ),
]
