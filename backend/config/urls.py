"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
)

from .health import healthcheck


urlpatterns = [
    path(
        "health/",
        healthcheck,
        name="healthcheck",
    ),
    path(
        "admin/",
        admin.site.urls,
    ),
    path(
        "api/schema/",
        SpectacularAPIView.as_view(),
        name="api-schema",
    ),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(
            url_name="api-schema",
        ),
        name="api-docs",
    ),
    path(
        "accounts/",
        include("allauth.urls"),
    ),
    path(
        "api/auth/",
        include("accounts.urls"),
    ),
    path(
        "api/workspaces/",
        include("workspaces.urls"),
    ),
    path(
        "api/",
        include("chat.urls"),
    ),
    path(
        "api/",
        include("notifications.urls"),
    ),
]

if settings.DEBUG:
    urlpatterns += staticfiles_urlpatterns()
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )
