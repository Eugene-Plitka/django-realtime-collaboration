import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  apiRequest,
  getCookie,
  readApiError,
  setTokens,
} from "../api/client";

import { useAuth } from "../auth/AuthContext";


function SocialCallbackPage() {
  const {
    user,
    loadUser,
  } = useAuth();

  const navigate = useNavigate();

  const exchangeStarted =
    useRef(false);

  const [error, setError] =
    useState("");


  useEffect(() => {
    if (exchangeStarted.current) {
      return;
    }

    exchangeStarted.current = true;


    async function completeSocialFlow() {
      try {
        const csrfResponse =
          await apiRequest(
            "/api/auth/csrf/",
            {
              skipAuth: true,
              credentials: "include",
            },
          );

        if (!csrfResponse.ok) {
          if (user) {
            navigate(
              "/app",
              {
                replace: true,
              },
            );

            return;
          }

          throw new Error(
            "Unable to initialize social authentication.",
          );
        }

        const csrfToken =
          getCookie("csrftoken");

        if (!csrfToken) {
          if (user) {
            navigate(
              "/app",
              {
                replace: true,
              },
            );

            return;
          }

          throw new Error(
            "CSRF token was not created.",
          );
        }

        const response =
          await apiRequest(
            "/api/auth/social/exchange/",
            {
              method: "POST",
              skipAuth: true,
              credentials: "include",
              headers: {
                "X-CSRFToken":
                  csrfToken,
              },
            },
          );

        if (!response.ok) {
          if (user) {
            navigate(
              "/app",
              {
                replace: true,
              },
            );

            return;
          }

          throw new Error(
            await readApiError(
              response,
              "Unable to complete social authentication.",
            ),
          );
        }

        const tokens =
          await response.json();

        setTokens(tokens);

        await loadUser();

        navigate(
          "/app",
          {
            replace: true,
          },
        );
      } catch (requestError) {
        setError(
          requestError.message,
        );
      }
    }


    completeSocialFlow();
  }, [
    loadUser,
    navigate,
    user,
  ]);


  return (
    <div className="screen-loader">
      <div className="loader-logo">
        C
      </div>

      <div>
        {error
          ? error
          : "Completing social sign in..."}
      </div>
    </div>
  );
}


export default SocialCallbackPage;