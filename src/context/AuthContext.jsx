import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { auth as authApi } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // On mount, check if there's a valid token
  useEffect(() => {
    const token = localStorage.getItem("pinway_token");
    if (!token) {
      setLoading(false);
      return;
    }
    authApi.me()
      .then((me) => setUser(me))
      .catch(() => localStorage.removeItem("pinway_token"))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    setError(null);
    const { token, user: me } = await authApi.login(email, password);
    localStorage.setItem("pinway_token", token);
    setUser(me);
    return me;
  }, []);

  const register = useCallback(async (name, email, password) => {
    setError(null);
    const { token, user: me } = await authApi.register(name, email, password);
    localStorage.setItem("pinway_token", token);
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("pinway_token");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
