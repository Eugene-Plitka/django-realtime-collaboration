import {
  useState,
} from "react";

import AccountConnectionsModal from "./AccountConnectionsModal";


function AccountConnectionsLauncher({
  user,
  logout,
}) {
  const [open, setOpen] =
    useState(false);


  return (
    <>
      <div className="dashboard-user">
        <div className="dashboard-avatar">
          {user.username
            .slice(0, 1)
            .toUpperCase()}
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
        className="account-connections-button"
        type="button"
        onClick={() =>
          setOpen(true)
        }
      >
        Sign-in methods
      </button>

      <button
        className="logout-button"
        type="button"
        onClick={logout}
      >
        Sign out
      </button>

      <AccountConnectionsModal
        open={open}
        onClose={() =>
          setOpen(false)
        }
      />
    </>
  );
}


export default AccountConnectionsLauncher;