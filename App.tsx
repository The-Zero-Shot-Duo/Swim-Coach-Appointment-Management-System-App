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
  // 现在我们检查 user 对象是否存在，而不是一个布尔值
  const { user } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? ( // 如果 user 对象存在，说明已登录
        <Stack.Screen name="Calendar" component={CalendarScreen} />
      ) : (
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
