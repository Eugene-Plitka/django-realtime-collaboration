from django.urls import re_path

from .consumers import ChannelConsumer

websocket_urlpatterns = [
    re_path(
        r"ws/channels/(?P<channel_id>\d+)/$",
        ChannelConsumer.as_asgi(),
    ),
]
