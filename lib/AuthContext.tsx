// src/lib/AuthContext.tsx

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from "react";
import * as Auth from "./auth"; // 导入我们之前创建的 auth.ts
import { ActivityIndicator, View } from "react-native";

// 定义 Context 中共享的数据类型
interface AuthContextType {
  isAuthenticated: boolean;
  login: (username: string) => Promise<void>;
  logout: () => Promise<void>;
}

// 创建 Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 创建一个 Provider 组件
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 检查初始登录状态
  useEffect(() => {
    const checkStatus = async () => {
      const loggedIn = await Auth.isLoggedIn();
      setIsAuthenticated(loggedIn);
      setIsLoading(false);
    };
    checkStatus();
  }, []);

  const login = async (username: string) => {
    await Auth.login(username);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    await Auth.logout();
    setIsAuthenticated(false);
  };

  // 在加载时显示指示器
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// 创建一个自定义 Hook，方便其他组件使用 Context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
