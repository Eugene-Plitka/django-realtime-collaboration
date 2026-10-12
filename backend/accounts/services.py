from io import BytesIO
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from allauth.socialaccount.models import SocialAccount
from django.core.files.base import ContentFile
from PIL import Image, UnidentifiedImageError


MAX_SOCIAL_AVATAR_BYTES = 5 * 1024 * 1024

SOCIAL_AVATAR_SIZE = (
    512,
    512,
)


def _is_allowed_social_avatar_url(
    url,
):
    try:
        parsed_url = urlparse(
            url,
        )
    except ValueError:
        return False

    if parsed_url.scheme != "https":
        return False

    hostname = (parsed_url.hostname or "").lower()

    if hostname == "avatars.githubusercontent.com":
        return True

    if hostname.endswith(".googleusercontent.com"):
        return True

    return False


def _download_social_avatar(
    url,
):
    if not _is_allowed_social_avatar_url(
        url,
    ):
        return None

    request = Request(
        url,
        headers={
            "User-Agent": ("CollabSpace/1.0"),
        },
    )

    try:
        with urlopen(
            request,
            timeout=5,
        ) as response:
            content_type = response.headers.get_content_type()

            if not content_type.startswith("image/"):
                return None

            image_bytes = response.read(MAX_SOCIAL_AVATAR_BYTES + 1)
    except (
        OSError,
        ValueError,
    ):
        return None

    if len(image_bytes) > MAX_SOCIAL_AVATAR_BYTES:
        return None

    try:
        image = Image.open(
            BytesIO(
                image_bytes,
            )
        )

        image.load()

        if image.mode not in (
            "RGB",
            "RGBA",
        ):
            image = image.convert(
                "RGBA",
            )

        if image.mode == "RGBA":
            background = Image.new(
                "RGB",
                image.size,
                "white",
            )

            background.paste(
                image,
                mask=image.getchannel(
                    "A",
                ),
            )

            image = background
        else:
            image = image.convert(
                "RGB",
            )

        image.thumbnail(
            SOCIAL_AVATAR_SIZE,
        )

        output = BytesIO()

        image.save(
            output,
            format="JPEG",
            quality=90,
            optimize=True,
        )
    except (
        OSError,
        UnidentifiedImageError,
    ):
        return None

    return output.getvalue()


def _social_avatar_url(
    social_account,
):
    extra_data = social_account.extra_data or {}

    if social_account.provider == "google":
        return extra_data.get(
            "picture",
        )

    if social_account.provider == "github":
        return extra_data.get(
            "avatar_url",
        )

    return None


def clear_social_avatar(
    user,
):
    if user.social_avatar:
        user.social_avatar.delete(
            save=False,
        )

    user.social_avatar = None
    user.social_avatar_provider = ""

    user.save(
        update_fields=[
            "social_avatar",
            "social_avatar_provider",
        ],
    )


def sync_social_avatar(
    user,
):
    social_accounts = {
        account.provider: account
        for account in SocialAccount.objects.filter(
            user=user,
            provider__in=(
                "google",
                "github",
            ),
        )
    }

    for provider in (
        "google",
        "github",
    ):
        social_account = social_accounts.get(
            provider,
        )

        if social_account is None:
            continue

        avatar_url = _social_avatar_url(
            social_account,
        )

        if not avatar_url:
            continue

        avatar_bytes = _download_social_avatar(
            avatar_url,
        )

        if avatar_bytes is None:
            continue

        if user.social_avatar:
            user.social_avatar.delete(
                save=False,
            )

        filename = f"user_{user.id}_{provider}.jpg"

        user.social_avatar.save(
            filename,
            ContentFile(
                avatar_bytes,
            ),
            save=False,
        )

        user.social_avatar_provider = provider

        user.save(
            update_fields=[
                "social_avatar",
                "social_avatar_provider",
            ],
        )

        return True

    if not social_accounts and user.social_avatar:
        clear_social_avatar(
            user,
        )

    return False
