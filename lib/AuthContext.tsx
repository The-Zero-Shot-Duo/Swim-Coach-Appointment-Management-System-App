// lib/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebaseConfig";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  User,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";

type AuthCtx = {
  user: User | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName: string,
    aliasesInput?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  ensureCoachProfile: (extraAliases?: string[]) => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  initializing: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  ensureCoachProfile: async () => {},
});

// ✅ 支持 string 或 string[] 的别名输入
function buildAliases(
  displayName: string,
  email: string | null,
  aliasesInput?: string | string[]
): string[] {
  const list: string[] = [];
  const seen = new Set<string>();
  const add = (s?: string) => {
    const v = s?.trim();
    if (!v) return;
    const key = v.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    list.push(v);
  };

  add(displayName);
  add(email || undefined);

  let extras: string[] = [];
  if (typeof aliasesInput === "string") {
    extras = aliasesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (Array.isArray(aliasesInput)) {
    extras = aliasesInput.map((s) => s.trim()).filter(Boolean);
  }
  extras.forEach(add);

  return list;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      console.log(
        "AppNavigator is rendering. User authenticated:",
        !!u,
        "initializing:",
        initializing
      );
      console.log("[AuthContext] onAuthStateChanged:", u?.uid ?? "null");
      setUser(u);
      setInitializing(false);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  // ✅ 登录后调用：确保 coaches/{uid} 存在；缺少 displayName 回填到 Auth；最后 setUser 触发 UI 刷新
  const ensureCoachProfile = async (extraAliases: string[] = []) => {
    const u = auth.currentUser;
    if (!u) return;

    const ref = doc(db, "coaches", u.uid);
    const snap = await getDoc(ref);

    const fallbackName = u.email ? u.email.split("@")[0] : "Coach";
    const targetName =
      (u.displayName && u.displayName.trim()) ||
      (snap.exists() ? (snap.data() as any)?.displayName : "") ||
      fallbackName;

    const email = u.email ?? null;
    const aliases = buildAliases(targetName, email, extraAliases); // <-- 现在支持数组

    await setDoc(
      ref,
      {
        uid: u.uid,
        email,
        displayName: targetName,
        aliases,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // 回填 Auth.displayName 并刷新本地 user
    if (!u.displayName || u.displayName !== targetName) {
      await updateProfile(u, { displayName: targetName });
      await u.reload();
      if (auth.currentUser) setUser(auth.currentUser);
    }
  };

  // ✅ 注册：safeName 兜底、写 coaches、reload 并 setUser
  const register = async (
    email: string,
    password: string,
    displayName: string,
    aliasesInput?: string
  ) => {
    const cred = await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

    const safeName =
      displayName.trim() ||
      (cred.user.email ? cred.user.email.split("@")[0] : "") ||
      "Coach";

    await updateProfile(cred.user, { displayName: safeName });

    const uid = cred.user.uid;
    const aliases = buildAliases(safeName, cred.user.email, aliasesInput);

    await setDoc(
      doc(db, "coaches", uid),
      {
        uid,
        email: cred.user.email,
        displayName: safeName, // 用 safeName 落库
        aliases,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await cred.user.reload();
    if (auth.currentUser) setUser(auth.currentUser);

    console.log(
      "[AuthContext][register] saved coach profile with aliases:",
      aliases
    );
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <Ctx.Provider
      value={{
        user,
        initializing,
        login,
        register,
        logout,
        ensureCoachProfile,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
