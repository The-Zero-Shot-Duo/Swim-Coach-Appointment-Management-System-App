// lib/AuthContext.tsx

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from "react";
// 导入 Firebase 官方的认证函数
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { ActivityIndicator, View } from "react-native";
// 导入我们配置好的 Firebase app 实例
import { app } from "../firebaseConfig";

// 定义 Context 中共享的数据类型
interface AuthContextType {
  user: User | null; // 分享的是完整的 User 对象或 null
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 获取 Firebase auth 实例
const auth = getAuth(app);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // onAuthStateChanged 是一个实时监听器，这是最关键的部分
  // 当用户登录或登出时，Firebase 会自动通知我们的应用
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // 如果用户登录，currentUser 就是 User 对象；如果登出，就是 null
      setUser(currentUser);
      setIsLoading(false);
    });

    // 在组件卸载时，取消监听，防止内存泄漏
    return () => unsubscribe();
  }, []); // 这个 Effect 只在组件首次加载时运行一次

  // 定义 login 函数，它调用 Firebase 的 API
  const login = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
    // 登录成功后，上面的 onAuthStateChanged 会自动更新 user 状态，我们无需手动设置
  };

  // 定义 logout 函数，它调用 Firebase 的 API
  const logout = async () => {
    await signOut(auth);
    // 登出成功后，onAuthStateChanged 会自动将 user 设为 null
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// 自定义 Hook，方便其他组件使用
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
