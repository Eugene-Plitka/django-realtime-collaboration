import { Link } from "react-router-dom";


function RegisterPage() {
  return (
    <main>
      <h1>Create account</h1>

      <p>
        Registration form will be connected
        to the Django API on the next step.
      </p>

      <Link to="/login">
        Back to sign in
      </Link>
    </main>
  );
}


export default RegisterPage;