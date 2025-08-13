// App.tsx

import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { PaperProvider } from "react-native-paper";
import { ActivityIndicator, View, StyleSheet } from "react-native";

// 导入你的页面 (Screens)
import LoginScreen from "./screens/LoginScreen";
import CalendarScreen from "./screens/CalendarScreen";

// 导入你的认证函数
import { isLoggedIn } from "./lib/auth"; // 假设 auth.ts 已被修改为异步

// 创建 Stack Navigator 实例
const Stack = createNativeStackNavigator();

export default function App() {
  // 使用 state 来管理认证状态和加载状态
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 在应用启动时，检查用户是否已经登录
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const loggedIn = await isLoggedIn(); // 检查本地存储
        setIsAuthenticated(loggedIn);
      } catch (e) {
        console.error("Failed to check auth status:", e);
        setIsAuthenticated(false);
      } finally {
        // 无论结果如何，都在检查后结束加载状态
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // 如果正在检查登录状态，显示一个全屏的加载动画
  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // 渲染应用
  return (
    // 1. PaperProvider 包裹所有UI组件，提供主题支持
    <PaperProvider>
      {/* 2. NavigationContainer 是所有导航的根容器 */}
      <NavigationContainer>
        {/* 3. Stack.Navigator 管理你的页面栈 */}
        <Stack.Navigator
          // 4. 根据认证状态，设置初始显示的页面
          // 如果已认证，直接跳到 Calendar；否则，显示 Login
          initialRouteName={isAuthenticated ? "Calendar" : "Login"}
          // 我们可以全局隐藏所有页面的头部，然后在每个页面里自定义
          screenOptions={{
            headerShown: false,
          }}
        >
          {/* 5. 定义导航栈里的所有页面 */}
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Calendar" component={CalendarScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}

// 为加载动画提供样式
const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
