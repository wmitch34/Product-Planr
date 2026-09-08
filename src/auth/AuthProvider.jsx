import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import apiClient from "../lib/apiClient";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadUser = async () => {
    try {
      const result = await apiClient.get("/api/auth/me");
      setUser(result?.user || null);
      setError(null);
    } catch (requestError) {
      if (requestError.status !== 401) setError(requestError);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const login = async (email, password) => {
    const result = await apiClient.post("/api/auth/login", { email, password });
    setUser(result?.user || null);
    setError(null);
    return result?.user;
  };

  const register = async (email, password) => {
    const result = await apiClient.post("/api/auth/register", { email, password });
    setUser(result?.user || null);
    setError(null);
    return result?.user;
  };

  const logout = async () => {
    try {
      await apiClient.post("/api/auth/logout");
    } finally {
      setUser(null);
    }
  };

  const value = useMemo(
    () => ({ user, loading, error, login, register, logout, reload: loadUser }),
    [user, loading, error],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-slate-500">
        Loading Product Planr…
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};

export default AuthProvider;
