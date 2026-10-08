from django.urls import path

from .views import (
    WorkspaceDetailView,
    WorkspaceLeaveView,
    WorkspaceListCreateView,
    WorkspaceMemberAddView,
    WorkspaceMemberListView,
    WorkspaceMemberRemoveView,
    WorkspaceMemberRoleUpdateView,
    WorkspaceTransferOwnershipView,
)

urlpatterns = [
    path("", WorkspaceListCreateView.as_view(), name="workspace-list-create"),
    path("<int:pk>/", WorkspaceDetailView.as_view(), name="workspace-detail"),
    path(
        "<int:workspace_id>/members/",
        WorkspaceMemberListView.as_view(),
        name="workspace-member-list",
    ),
    path(
        "<int:workspace_id>/members/<int:membership_id>/role/",
        WorkspaceMemberRoleUpdateView.as_view(),
        name="workspace-member-role-update",
    ),
    path(
        "<int:workspace_id>/members/<int:membership_id>/",
        WorkspaceMemberRemoveView.as_view(),
        name="workspace-member-remove",
    ),
    path(
        "<int:workspace_id>/transfer-ownership/",
        WorkspaceTransferOwnershipView.as_view(),
        name="workspace-transfer-ownership",
    ),
    path(
        "<int:workspace_id>/leave/",
        WorkspaceLeaveView.as_view(),
        name="workspace-leave",
    ),
    path(
        "<int:workspace_id>/members/add/",
        WorkspaceMemberAddView.as_view(),
        name="workspace-member-add",
    ),
]
