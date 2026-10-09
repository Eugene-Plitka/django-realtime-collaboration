from django.urls import path

from .views import (
    NotificationListView,
    NotificationReadView,
    NotificationUnreadView,
)

urlpatterns = [
    path(
        "notifications/",
        NotificationListView.as_view(),
        name="notification-list",
    ),
    path(
        "notifications/<int:pk>/read/",
        NotificationReadView.as_view(),
        name="notification-read",
    ),
    path(
        "notifications/<int:pk>/unread/",
        NotificationUnreadView.as_view(),
        name="notification-unread",
    ),
]
