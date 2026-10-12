import UserAvatar from "./UserAvatar";


function AccountConnectionsLauncher({
  user,
  logout,
}) {
  return (
    <>
      <div className="dashboard-user">
        <UserAvatar
          className="dashboard-avatar"
          username={
            user.username
          }
          avatarUrl={
            user.avatar_url
          }
        />

        <div>
          <strong>
            {user.username}
          </strong>

          <span>
            {user.email}
          </span>
        </div>
      </div>

      <button
        className="logout-button"
        type="button"
        onClick={logout}
      >
        Sign out
      </button>
    </>
  );
}


export default AccountConnectionsLauncher;