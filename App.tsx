// App.tsx

import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { PaperProvider } from "react-native-paper";

// 导入你的页面 (Screens)
import LoginScreen from "./screens/LoginScreen";
import CalendarScreen from "./screens/CalendarScreen";

// 导入我们创建的 AuthProvider 和 useAuth Hook
import { AuthProvider, useAuth } from "./lib/AuthContext";

// 创建 Stack Navigator 实例
const Stack = createNativeStackNavigator();

/**
 * 这是一个内部组件，它的作用是根据认证状态来决定显示哪个页面。
 * 它必须被包裹在 AuthProvider 内部才能使用 useAuth()。
 */
function AppNavigator() {
  // 从我们的 AuthContext 中获取 user 对象
  const { user } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        // 如果 user 对象存在 (说明已登录)，则显示日历页面
        <Stack.Screen name="Calendar" component={CalendarScreen} />
      ) : (
        // 如果 user 对象为 null (说明未登录)，则显示登录页面
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

/**
 * 这是应用的根组件
 */
export default function App() {
  return (
    // 1. PaperProvider 是 UI 库的根，必须在最外层
    <PaperProvider>
      {/* 2. AuthProvider 负责管理全局的登录状态 */}
      <AuthProvider>
        {/* 3. NavigationContainer 是所有导航组件的容器 */}
        <NavigationContainer>
          {/* 4. AppNavigator 包含了我们所有的页面和导航逻辑 */}
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </PaperProvider>
  );
}
