import { Link } from "react-router-dom";


function LoginPage() {
  return (
    <main>
      <h1>Sign in</h1>

      <p>
        Email/password login will be connected
        to the Django API on the next step.
      </p>

      <Link to="/register">
        Create account
      </Link>
    </main>
  );
}


export default LoginPage;