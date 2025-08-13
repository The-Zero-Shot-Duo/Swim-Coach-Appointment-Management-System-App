// components/LoginForm.tsx

import React, { useState } from "react";
import { View } from "react-native";
import { TextInput, Button } from "react-native-paper";
import { useAuth } from "../lib/AuthContext"; // 导入 useAuth

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth(); // 从 Context 获取 login 函数

  async function onSubmit() {
    if (!username || loading) return;
    setLoading(true);
    try {
      await login(username); // 调用 Context 的 login
      // 登录成功后不需要手动导航，App.tsx 会自动切换导航栈
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setLoading(false);
    }
  }

  // ... JSX 部分保持不变
  return (
    <View>
      <TextInput
        label="Username"
        value={username}
        onChangeText={setUsername}
        mode="outlined"
        style={{ marginBottom: 16 }}
        autoCapitalize="none"
        placeholder="coach_rain"
      />
      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        mode="outlined"
        secureTextEntry
        style={{ marginBottom: 24 }}
        placeholder="••••••••"
      />
      <Button
        mode="contained"
        onPress={onSubmit}
        loading={loading}
        disabled={loading}
      >
        Sign in
      </Button>
    </View>
  );
}
