import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  clearAdminToken,
  getAdminSession,
  getStoredAdminToken,
  loginAdmin,
  storeAdminToken,
} from "../services/adminApi";

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredAdminToken());
  const [admin, setAdmin] = useState(null);
  const [isChecking, setIsChecking] = useState(Boolean(token));

  useEffect(() => {
    let isCancelled = false;

    if (!token) {
      setAdmin(null);
      setIsChecking(false);
      return undefined;
    }

    setIsChecking(true);

    getAdminSession(token)
      .then((data) => {
        if (!isCancelled) {
          setAdmin(data.admin);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          clearAdminToken();
          setToken("");
          setAdmin(null);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsChecking(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [token]);

  const login = useCallback(async (email, password) => {
    const data = await loginAdmin(email, password);
    storeAdminToken(data.token);
    setToken(data.token);
    setAdmin(data.admin);
    return data.admin;
  }, []);

  const logout = useCallback(() => {
    clearAdminToken();
    setToken("");
    setAdmin(null);
  }, []);

  const value = useMemo(
    () => ({ token, admin, isChecking, login, logout }),
    [token, admin, isChecking, login, logout]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);

  if (!context) {
    throw new Error("useAdminAuth must be used inside AdminAuthProvider.");
  }

  return context;
}
