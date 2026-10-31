import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = logged out
  const [allowRegister, setAllowRegister] = useState(false);

  useEffect(() => {
    api("/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
    api("/auth/config")
      .then((d) => setAllowRegister(d.allowRegister))
      .catch(() => {});
  }, []);

  const login = useCallback(async (username, password) => {
    const d = await api("/auth/login", { method: "POST", body: { username, password } });
    setUser(d.user);
  }, []);

  const register = useCallback(async (username, password) => {
    const d = await api("/auth/register", { method: "POST", body: { username, password } });
    setUser(d.user);
  }, []);

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, allowRegister, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
