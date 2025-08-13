// lib/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebaseConfig";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";

type AuthCtx = {
  user: User | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  initializing: true,
  login: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      console.log("[AuthContext] onAuthStateChanged:", u?.uid ?? "null");
      setUser(u);
      setInitializing(false);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    // 这里抛出的错误会在 LoginForm 里被 catch 并 Alert
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <Ctx.Provider value={{ user, initializing, login, logout }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
