from django.urls import path

from .views import (
    ChannelDetailView,
    ChannelJoinView,
    ChannelLeaveView,
    ChannelListCreateView,
    ChannelMemberListCreateView,
    ChannelMemberRemoveView,
    MessageListView,
)

urlpatterns = [
    path(
        "workspaces/<int:workspace_id>/channels/",
        ChannelListCreateView.as_view(),
        name="channel-list-create",
    ),
    path(
        "channels/<int:pk>/",
        ChannelDetailView.as_view(),
        name="channel-detail",
    ),
    path(
        "channels/<int:channel_id>/join/",
        ChannelJoinView.as_view(),
        name="channel-join",
    ),
    path(
        "channels/<int:channel_id>/leave/",
        ChannelLeaveView.as_view(),
        name="channel-leave",
    ),
    path(
        "channels/<int:channel_id>/members/",
        ChannelMemberListCreateView.as_view(),
        name="channel-member-list-create",
    ),
    path(
        "channels/<int:channel_id>/members/<int:membership_id>/",
        ChannelMemberRemoveView.as_view(),
        name="channel-member-remove",
    ),
    path(
        "channels/<int:channel_id>/messages/",
        MessageListView.as_view(),
        name="message-list",
    ),
]
