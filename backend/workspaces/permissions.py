from .models import WorkspaceMembership


def get_workspace_membership(*, workspace, user):
    try:
        return WorkspaceMembership.objects.get(
            workspace=workspace,
            user=user,
        )
    except WorkspaceMembership.DoesNotExist:
        return None


def can_manage_members(*, membership):
    return membership.role in {
        WorkspaceMembership.Role.OWNER,
        WorkspaceMembership.Role.ADMIN,
    }


def can_change_role(*, actor_membership, target_membership, new_role):
    if new_role == WorkspaceMembership.Role.OWNER:
        return False

    if target_membership.role == WorkspaceMembership.Role.OWNER:
        return False

    if actor_membership.role == WorkspaceMembership.Role.OWNER:
        return new_role in {
            WorkspaceMembership.Role.ADMIN,
            WorkspaceMembership.Role.MEMBER,
            WorkspaceMembership.Role.GUEST,
        }

    if actor_membership.role == WorkspaceMembership.Role.ADMIN:
        if target_membership.role not in {
            WorkspaceMembership.Role.MEMBER,
            WorkspaceMembership.Role.GUEST,
        }:
            return False

        return new_role in {
            WorkspaceMembership.Role.MEMBER,
            WorkspaceMembership.Role.GUEST,
        }

    return False


def can_remove_member(*, actor_membership, target_membership):
    if target_membership.role == WorkspaceMembership.Role.OWNER:
        return False

    if actor_membership.role == WorkspaceMembership.Role.OWNER:
        return True

    if actor_membership.role == WorkspaceMembership.Role.ADMIN:
        return target_membership.role in {
            WorkspaceMembership.Role.MEMBER,
            WorkspaceMembership.Role.GUEST,
        }

    return False


def can_add_member_with_role(*, actor_membership, role):
    if role == WorkspaceMembership.Role.OWNER:
        return False

    if actor_membership.role == WorkspaceMembership.Role.OWNER:
        return role in {
            WorkspaceMembership.Role.ADMIN,
            WorkspaceMembership.Role.MEMBER,
            WorkspaceMembership.Role.GUEST,
        }

    if actor_membership.role == WorkspaceMembership.Role.ADMIN:
        return role in {
            WorkspaceMembership.Role.MEMBER,
            WorkspaceMembership.Role.GUEST,
        }

    return False
