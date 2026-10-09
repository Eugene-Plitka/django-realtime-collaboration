import {
  useState,
} from "react";

import {
  Link,
  Navigate,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import AuthShell from "../components/AuthShell";


function RegisterPage() {
  const {
    user,
    register,
  } = useAuth();

  const navigate = useNavigate();

  const [email, setEmail] =
    useState("");

  const [username, setUsername] =
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
      await register({
        email,
        username,
        password,
      });

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
    } finally {
      setSubmitting(false);
    }
  }


  return (
    <AuthShell
      eyebrow="Create account"
      title="Join your team"
      subtitle="Create an account and start collaborating in real time."
    >
      <form
        className="auth-form"
        onSubmit={handleSubmit}
      >
        <label className="form-field">
          <span>
            Username
          </span>

          <input
            type="text"
            value={username}
            onChange={(event) =>
              setUsername(
                event.target.value,
              )
            }
            placeholder="alex"
            autoComplete="username"
            required
          />
        </label>

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
            placeholder="Create a strong password"
            autoComplete="new-password"
            required
          />
        </label>

        <p className="password-hint">
          Use a strong password that
          satisfies Django password
          validation.
        </p>

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
            ? "Creating account..."
            : "Create account"}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account?

        {" "}

        <Link to="/login">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}


export default RegisterPage;