// components/LoginForm.tsx
import React, { useState } from "react";
import { View } from "react-native";
import { TextInput, Button } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { login } from "../lib/auth"; // 假设 auth.ts 已被改造成异步

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  async function onSubmit() {
    if (!username || loading) return;

    setLoading(true);
    try {
      // 登录逻辑现在是异步的
      await login(username);
      // 导航到日历页
      navigation.navigate("Calendar"); // 假设主页路由名叫 'Calendar'
    } catch (error) {
      console.error("Login failed:", error);
      // 这里可以添加错误提示，例如一个 Toast 或 Snackbar
    } finally {
      setLoading(false);
    }
  }

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
        secureTextEntry // 用于密码输入
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
