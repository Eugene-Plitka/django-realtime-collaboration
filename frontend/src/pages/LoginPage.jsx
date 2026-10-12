import {
  useState,
} from "react";

import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  getApiBaseUrl,
} from "../api/client";
import { useAuth } from "../auth/AuthContext";
import AuthShell from "../components/AuthShell";


function GoogleIcon() {
  return (
    <svg
      className="social-provider-logo"
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3
        c-1.6 4.5-5.9 8-11.3 8
        c-6.6 0-12-5.4-12-12
        s5.4-12 12-12
        c3.1 0 5.9 1.2 8 3.1
        l5.7-5.7
        C34.1 6.1 29.3 4 24 4
        C12.9 4 4 12.9 4 24
        s8.9 20 20 20
        c11 0 20-8 20-20
        c0-1.3-.1-2.3-.4-3.5z"
      />

      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8
        C14.7 15.1 19 12 24 12
        c3.1 0 5.9 1.2 8 3.1
        l5.7-5.7
        C34.1 6.1 29.3 4 24 4
        c-7.7 0-14.4 4.3-17.7 10.7z"
      />

      <path
        fill="#4CAF50"
        d="M24 44
        c5.1 0 9.8-2 13.3-5.3
        l-6.1-5.2
        C29.2 35.1 26.7 36 24 36
        c-5.3 0-9.8-3.4-11.4-8.1
        l-6.5 5
        C9.4 39.5 16.2 44 24 44z"
      />

      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8
        h11.3
        c-.8 2.3-2.3 4.2-4.1 5.5
        l6.1 5.2
        C36.9 39.1 44 34 44 24
        c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}


function GitHubIcon() {
  return (
    <svg
      className="social-provider-logo github"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M12 .7
        C5.7.7.7 5.8.7 12.2
        c0 5 3.3 9.2 7.8 10.7
        .6.1.8-.3.8-.6
        v-2.2
        c-3.2.7-3.9-1.4-3.9-1.4
        -.5-1.3-1.3-1.6-1.3-1.6
        -1-.7.1-.7.1-.7
        1.1.1 1.7 1.1 1.7 1.1
        1 1.7 2.6 1.2 3.3.9
        .1-.8.4-1.2.7-1.5
        -2.6-.3-5.3-1.3-5.3-5.8
        0-1.3.5-2.4 1.2-3.2
        -.1-.3-.5-1.6.1-3.3
        0 0 1-.3 3.4 1.2
        1-.3 2-.4 3.1-.4
        1.1 0 2.1.1 3.1.4
        2.4-1.6 3.4-1.2 3.4-1.2
        .6 1.7.2 3 .1 3.3
        .8.9 1.2 2 1.2 3.2
        0 4.5-2.7 5.5-5.3 5.8
        .4.4.7 1.1.7 2.1
        v3.1
        c0 .4.2.8.8.6
        4.5-1.5 7.8-5.7 7.8-10.7
        C23.3 5.8 18.3.7 12 .7z"
      />
    </svg>
  );
}


function LoginPage() {
  const {
    user,
    login,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);


  if (user) {
    return (
      <Navigate
        to="/app"
        replace
      />
    );
  }

  function handleGitHubLogin() {
    window.location.href =
      `${getApiBaseUrl()}/accounts/github/login/`;
  }


  function handleGoogleLogin() {
    window.location.href =
      `${getApiBaseUrl()}/accounts/google/login/`;
  }


  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSubmitting(true);

    try {
      await login({
        email,
        password,
      });

      const destination =
        location.state?.from
          ?.pathname ?? "/app";

      navigate(
        destination,
        {
          replace: true,
        },
      );
    } catch (requestError) {
      setError(
        requestError.message,
      );
    } finally {
      setSubmitting(false);
    }
  }


  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to your workspace"
      subtitle="Continue your team's conversations and collaboration."
    >
      <form
        className="auth-form"
        onSubmit={handleSubmit}
      >
        <label className="form-field">
          <span>
            Email address
          </span>

          <input
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(
                event.target.value,
              )
            }
            placeholder="email@example.com"
            autoComplete="email"
            required
          />
        </label>

        <label className="form-field">
          <span>
            Password
          </span>

          <input
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(
                event.target.value,
              )
            }
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />
        </label>

        {error && (
          <div
            className="form-error"
            role="alert"
          >
            {error}
          </div>
        )}

        <button
          className="primary-button"
          type="submit"
          disabled={submitting}
        >
          {submitting
            ? "Signing in..."
            : "Sign in"}
        </button>
      </form>

      <div className="auth-divider">
        <span>
          or continue with
        </span>
      </div>

      <div className="social-grid">
        <button
          className="social-button"
          type="button"
          onClick={handleGoogleLogin}
        >
          <GoogleIcon />

          <span>
            Google
          </span>
        </button>

        <button
          className="social-button"
          type="button"
          onClick={handleGitHubLogin}
        >
          <GitHubIcon />

          <span>
            GitHub
          </span>
        </button>
      </div>

      <p className="auth-switch">
        New to CollabSpace?

        {" "}

        <Link to="/register">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}


export default LoginPage;