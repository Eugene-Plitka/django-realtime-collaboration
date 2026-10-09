from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


@database_sync_to_async
def get_user_from_token(token):
    authentication = JWTAuthentication()

    try:
        validated_token = authentication.get_validated_token(token)
        return authentication.get_user(validated_token)
    except InvalidToken, TokenError:
        return AnonymousUser()


class JWTAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        scope = dict(scope)
        scope["user"] = AnonymousUser()
        scope["jwt_subprotocol"] = None

        for subprotocol in scope.get("subprotocols", []):
            if subprotocol.startswith("jwt."):
                token = subprotocol.removeprefix("jwt.")

                scope["user"] = await get_user_from_token(token)
                scope["jwt_subprotocol"] = subprotocol

                break

        return await self.inner(
            scope,
            receive,
            send,
        )
