import {
  useState,
} from "react";

import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import AuthShell from "../components/AuthShell";


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
            placeholder="you@example.com"
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
          disabled
          title="Google OAuth will be enabled after provider credentials are configured."
        >
          <span className="social-icon">
            G
          </span>

          Google

          <small>
            Soon
          </small>
        </button>

        <button
          className="social-button"
          type="button"
          disabled
          title="GitHub OAuth will be enabled after provider credentials are configured."
        >
          <span className="social-icon github">
            GH
          </span>

          GitHub

          <small>
            Soon
          </small>
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