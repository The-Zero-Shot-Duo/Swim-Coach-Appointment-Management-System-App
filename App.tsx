// App.tsx
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { PaperProvider } from "react-native-paper";
import { AuthProvider } from "./lib/AuthContext";
import AppNavigator from "./navigation/AppNavigator";

export default function App() {
  console.log("App.tsx is rendering.");
  return (
    <PaperProvider>
      <AuthProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </PaperProvider>
  );
}
