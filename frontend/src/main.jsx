import {
  StrictMode,
} from "react";
import {
  createRoot,
} from "react-dom/client";
import {
  BrowserRouter,
} from "react-router-dom";

import App from "./App";
import {
  AuthProvider,
} from "./auth/AuthContext";
import "./index.css";
import "./mobile.css";
import {
  PresenceProvider,
} from "./presence/PresenceContext";


createRoot(
  document.getElementById(
    "root",
  ),
).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PresenceProvider>
          <App />
        </PresenceProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);