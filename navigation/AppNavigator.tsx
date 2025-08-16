// navigation/AppNavigator.tsx
import React from "react";
import { View, ActivityIndicator } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../lib/AuthContext";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import CalendarScreen from "../screens/CalendarScreen";

const Stack = createNativeStackNavigator();

const LoadingScreen = () => (
  <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
    <ActivityIndicator size="large" />
  </View>
);

export default function AppNavigator() {
  const { user, initializing, profileReady } = useAuth();
  console.log(
    "AppNavigator is rendering. User authenticated:",
    !!user,
    "initializing:",
    initializing,
    "profileReady:",
    profileReady
  );

  if (initializing) {
    // 在 Firebase 完成首次认证状态检查前，显示加载界面
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        profileReady ? (
          // 用户已登录且个人资料已准备就绪
          <Stack.Screen name="Calendar" component={CalendarScreen} />
        ) : (
          // 用户已登录但个人资料未就绪（通常在注册后发生）
          <Stack.Screen name="Loading" component={LoadingScreen} />
        )
      ) : (
        // 用户未登录
        <React.Fragment>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </React.Fragment>
      )}
    </Stack.Navigator>
  );
}
