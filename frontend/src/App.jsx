import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import ProtectedRoute from "./auth/ProtectedRoute";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import SocialCallbackPage from "./pages/SocialCallbackPage";


function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Navigate
            to="/app"
            replace
          />
        }
      />

      <Route
        path="/login"
        element={<LoginPage />}
      />

      <Route
        path="/register"
        element={<RegisterPage />}
      />

      <Route
        path="/auth/social/callback"
        element={<SocialCallbackPage />}
      />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/app"
            replace
          />
        }
      />
    </Routes>
  );
}


export default App;