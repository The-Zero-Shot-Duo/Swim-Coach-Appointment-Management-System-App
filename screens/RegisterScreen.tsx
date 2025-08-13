// screens/RegisterScreen.tsx
import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Card, Text, TextInput, Button } from "react-native-paper";
import { useAuth } from "../lib/AuthContext";

export default function RegisterScreen({ navigation }: { navigation: any }) {
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // ✅ 新增：别名（逗号分隔）
  const [aliasesText, setAliasesText] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    name.trim().length > 0 && email.trim().length > 0 && password.length >= 6;

  const onSubmit = async () => {
    if (!name.trim()) {
      setError("请填写姓名");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await register(email, password, name, aliasesText); // ✅ 传入别名
      // 成功后会自动进入登录态
    } catch (e: any) {
      console.error("[Register] error:", e);
      setError(e?.message ?? "Register failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineMedium" style={styles.title}>
            教练注册
          </Text>

          <TextInput
            label="姓名（展示名）"
            value={name}
            onChangeText={setName}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="邮箱"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            label="密码"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            style={styles.input}
            secureTextEntry
          />

          {/* ✅ 新增别名输入：逗号分隔，比如：Ben,Benjamin,Coach Ben,ben@xxx.com */}
          <TextInput
            label="别名（逗号分隔）"
            value={aliasesText}
            onChangeText={setAliasesText}
            mode="outlined"
            style={styles.input}
            placeholder="Ben,Benjamin,Coach Ben,ben@yourorg.com"
          />

          {error ? (
            <Text style={{ color: "red", marginBottom: 8 }}>{error}</Text>
          ) : null}

          <Button
            mode="contained"
            onPress={onSubmit}
            loading={loading}
            disabled={!canSubmit}
          >
            注册
          </Button>

          <TouchableOpacity
            onPress={() => navigation.navigate("Login")}
            style={{ marginTop: 12 }}
          >
            <Text style={{ color: "#1e90ff", textAlign: "center" }}>
              已有账号？去登录
            </Text>
          </TouchableOpacity>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  card: { width: "90%", maxWidth: 400 },
  title: { textAlign: "center", marginBottom: 20 },
  input: { marginBottom: 12 },
});
