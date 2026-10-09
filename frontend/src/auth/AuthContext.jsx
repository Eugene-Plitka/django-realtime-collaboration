import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  apiRequest,
  clearTokens,
  getRefreshToken,
  readApiError,
  setTokens,
} from "../api/client";


const AuthContext = createContext(null);


export function AuthProvider({
  children,
}) {
  const [user, setUser] = useState(
    null,
  );

  const [loading, setLoading] =
    useState(true);


  const loadUser = useCallback(
    async () => {
      const response = await apiRequest(
        "/api/auth/me/",
      );

      if (!response.ok) {
        clearTokens();
        setUser(null);
        return null;
      }

      const data =
        await response.json();

      setUser(data);

      return data;
    },
    [],
  );


  useEffect(() => {
    async function restoreSession() {
      if (!getRefreshToken()) {
        setLoading(false);
        return;
      }

      try {
        await loadUser();
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, [loadUser]);


  async function login({
    email,
    password,
  }) {
    const response = await apiRequest(
      "/api/auth/login/",
      {
        method: "POST",
        body: {
          email,
          password,
        },
        skipAuth: true,
      },
    );

    if (!response.ok) {
      throw new Error(
        await readApiError(
          response,
          "Unable to sign in.",
        ),
      );
    }

    const tokens =
      await response.json();

    setTokens(tokens);

    return loadUser();
  }


  async function register({
    email,
    username,
    password,
  }) {
    const response = await apiRequest(
      "/api/auth/register/",
      {
        method: "POST",
        body: {
          email,
          username,
          password,
        },
        skipAuth: true,
      },
    );

    if (!response.ok) {
      throw new Error(
        await readApiError(
          response,
          "Unable to create account.",
        ),
      );
    }

    return login({
      email,
      password,
    });
  }


  async function logout() {
    const refresh =
      getRefreshToken();

    try {
      if (refresh) {
        await apiRequest(
          "/api/auth/logout/",
          {
            method: "POST",
            body: {
              refresh,
            },
          },
        );
      }
    } finally {
      clearTokens();
      setUser(null);
    }
  }


  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      loadUser,
    }),
    [
      user,
      loading,
      loadUser,
    ],
  );


  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider.",
    );
  }

  return context;
}