// navigation/AppNavigator.tsx
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../lib/AuthContext";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import CalendarScreen from "../screens/CalendarScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user, initializing } = useAuth();
  console.log(
    "AppNavigator is rendering. User authenticated:",
    !!user,
    "initializing:",
    initializing
  );

  // 初始化中的 loading 如需显示，可加一个专门的 Screen；这里先省略

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="Calendar" component={CalendarScreen} />
      ) : (
        <React.Fragment>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </React.Fragment>
      )}
    </Stack.Navigator>
  );
}
