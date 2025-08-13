// App.tsx

import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { PaperProvider } from "react-native-paper";

// App.tsx
import LoginScreen from "./screens/LoginScreen";
import CalendarScreen from "./screens/CalendarScreen";
import { AuthProvider, useAuth } from "./lib/AuthContext";

const Stack = createNativeStackNavigator();

// 将导航逻辑提取到一个单独的组件中
function AppNavigator() {
  const { isAuthenticated } = useAuth(); // 从 Context 获取认证状态

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        // 如果已认证，只显示主应用页面
        <Stack.Screen name="Calendar" component={CalendarScreen} />
      ) : (
        // 如果未认证，只显示登录页面
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <PaperProvider>
      {/* AuthProvider 包裹所有东西 */}
      <AuthProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </PaperProvider>
  );
}
