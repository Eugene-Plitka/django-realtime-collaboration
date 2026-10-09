import {
  Navigate,
  useLocation,
} from "react-router-dom";

import { useAuth } from "./AuthContext";


function ProtectedRoute({
  children,
}) {
  const {
    user,
    loading,
  } = useAuth();

  const location = useLocation();

  if (loading) {
    return (
      <div className="screen-loader">
        <div className="loader-logo">
          C
        </div>

        <span>
          Loading workspace...
        </span>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location,
        }}
      />
    );
  }

  return children;
}


export default ProtectedRoute;