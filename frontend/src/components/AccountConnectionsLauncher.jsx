function AccountConnectionsLauncher({
  user,
  logout,
}) {
  return (
    <>
      <div className="dashboard-user">
        <div className="dashboard-avatar">
          {user.avatar_url ? (
            <img
              src={
                user.avatar_url
              }
              alt=""
            />
          ) : (
            user.username
              .slice(0, 1)
              .toUpperCase()
          )}
        </div>

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