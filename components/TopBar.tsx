// components/TopBar.tsx

import React from "react";
import { Appbar } from "react-native-paper";
import { useAuth } from "../lib/AuthContext"; // 导入 useAuth

export default function TopBar() {
  const { logout } = useAuth(); // 从 Context 获取 logout 函数

  return (
    <Appbar.Header>
      <Appbar.Content title="Swim Coach Schedule" />
      <Appbar.Action icon="logout" onPress={logout} />
    </Appbar.Header>
  );
}
