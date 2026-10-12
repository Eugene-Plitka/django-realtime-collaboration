def get_user_avatar(
    user,
):
    if user.avatar:
        return user.avatar

    if user.social_avatar:
        return user.social_avatar

    return None


def get_user_avatar_url(
    user,
    request=None,
) -> str | None:
    avatar = get_user_avatar(
        user,
    )

    if avatar is None:
        return None

    avatar_url = avatar.url

    if request is not None:
        return request.build_absolute_uri(
            avatar_url,
        )

    return avatar_url
