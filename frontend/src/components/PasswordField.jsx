import {
  useState,
} from "react";


function PasswordEye({
  visible,
}) {
  if (visible) {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="M3 3l18 18M10.6 10.6A2 2 0 0012 14a2 2 0 001.4-.6M9.9 4.2A10.8 10.8 0 0112 4c5.5 0 9 5 9 5a15.6 15.6 0 01-2.1 2.5M6.6 6.6C4.4 8.1 3 10 3 10s3.5 5 9 5a10.7 10.7 0 004.1-.8"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z"
      />

      <circle
        cx="12"
        cy="12"
        r="2.5"
      />
    </svg>
  );
}


function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
  required = false,
  ariaLabel = "Password",
}) {
  const [
    visible,
    setVisible,
  ] = useState(false);


  return (
    <div className="password-input-shell">
      <input
        type={
          visible
            ? "text"
            : "password"
        }
        value={value}
        onChange={onChange}
        placeholder={
          placeholder
        }
        autoComplete={
          autoComplete
        }
        required={required}
      />

      <button
        className="password-visibility-button"
        type="button"
        aria-label={
          visible
            ? `Hide ${ariaLabel.toLowerCase()}`
            : `Show ${ariaLabel.toLowerCase()}`
        }
        onClick={() =>
          setVisible(
            (current) =>
              !current,
          )
        }
      >
        <PasswordEye
          visible={visible}
        />
      </button>
    </div>
  );
}


export default PasswordField;