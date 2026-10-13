"""
ASGI config for config project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.1/howto/deployment/asgi/
"""

import os

from django.core.asgi import (
    get_asgi_application,
)


os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "config.settings",
)

django_asgi_app = get_asgi_application()


from accounts.middleware import (
    JWTAuthMiddleware,
)
from accounts.routing import (
    websocket_urlpatterns as account_websocket_urlpatterns,
)
from channels.routing import (
    ProtocolTypeRouter,
    URLRouter,
)
from chat.routing import (
    websocket_urlpatterns as chat_websocket_urlpatterns,
)
from notifications.routing import (
    websocket_urlpatterns as notification_websocket_urlpatterns,
)


application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JWTAuthMiddleware(
            URLRouter(
                account_websocket_urlpatterns
                + chat_websocket_urlpatterns
                + notification_websocket_urlpatterns
            )
        ),
    }
)
