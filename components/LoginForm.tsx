// components/LoginForm.tsx

// ... 其他 imports ...
import React, { useState } from "react";
import { View, Alert } from "react-native";
import { TextInput, Button } from "react-native-paper";
import { useAuth } from "../lib/AuthContext";

export default function LoginForm() {
  const [email, setEmail] = useState(""); // 从 username 改为 email
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  async function onSubmit() {
    if (!email || !password || loading) return;
    setLoading(true);
    try {
      await login(email, password); // 调用新的 login 函数
    } catch (error: any) {
      console.error("Login failed:", error);
      // 显示一个更友好的错误提示
      Alert.alert("Login Failed", error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View>
      <TextInput
        label="Email" // 标签从 Username 改为 Email
        value={email}
        onChangeText={setEmail}
        mode="outlined"
        style={{ marginBottom: 16 }}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="coach.rain@test.com"
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
