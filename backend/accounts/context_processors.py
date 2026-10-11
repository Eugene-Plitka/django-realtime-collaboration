from django.conf import settings


def frontend_urls(request):
    return {
        "frontend_login_url": (f"{settings.FRONTEND_BASE_URL}/login"),
    }
