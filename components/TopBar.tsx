// components/TopBar.tsx
import React from "react";
import { Appbar } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { logout } from "../lib/auth";

export default function TopBar() {
  const navigation = useNavigation();

  async function handleLogout() {
    await logout();
    navigation.navigate("Login"); // 跳转到登录页
  }

  return (
    <Appbar.Header>
      <Appbar.Content title="Swim Coach Schedule" />
      <Appbar.Action icon="logout" onPress={handleLogout} />
    </Appbar.Header>
  );
}
