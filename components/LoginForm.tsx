// components/LoginForm.tsx
import React, { useState, useMemo } from "react";
import { View, Keyboard } from "react-native";
import { TextInput, Button, HelperText } from "react-native-paper";
import { useAuth } from "../lib/AuthContext";

function mapFirebaseError(msg?: string) {
  if (!msg) return "Login failed. Please try again.";
  const m = msg.toLowerCase();
  if (m.includes("invalid-email")) return "邮箱格式不正确";
  if (m.includes("user-disabled")) return "该账号已被禁用，请联系管理员";
  if (m.includes("user-not-found")) return "账号不存在";
  if (m.includes("wrong-password")) return "密码错误";
  if (m.includes("too-many-requests")) return "尝试过于频繁，请稍后再试";
  return msg;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginForm() {
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<{
    email?: boolean;
    password?: boolean;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const emailError = useMemo(() => {
    if (!touched.email) return "";
    if (!email.trim()) return "请输入邮箱";
    if (!emailRegex.test(email.trim())) return "邮箱格式不正确";
    return "";
  }, [email, touched.email]);

  const passwordError = useMemo(() => {
    if (!touched.password) return "";
    if (!password) return "请输入密码";
    if (password.length < 6) return "密码至少 6 位";
    return "";
  }, [password, touched.password]);

  const canSubmit =
    !submitting &&
    email.trim().length > 0 &&
    password.length >= 6 &&
    emailError === "" &&
    passwordError === "";

  const handleSubmit = async () => {
    setTouched({ email: true, password: true });
    setFormError(null);
    if (!canSubmit) return;

    try {
      setSubmitting(true);
      Keyboard.dismiss();
      await login(email.trim(), password);
      // 登录成功后由 AppNavigator 根据 user 自动跳转
    } catch (e: any) {
      setFormError(mapFirebaseError(e?.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View>
      <TextInput
        label="Email"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (!touched.email) setTouched((t) => ({ ...t, email: true }));
        }}
        mode="outlined"
        style={{ marginBottom: 6 }}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="coach.rain@test.com"
        disabled={submitting}
        error={!!emailError}
        returnKeyType="next"
        onSubmitEditing={() => {
          // 聚焦到密码输入
        }}
      />
      <HelperText
        type="error"
        visible={!!emailError}
        style={{ marginBottom: 6 }}
      >
        {emailError || " "}
      </HelperText>

      <TextInput
        label="Password"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          if (!touched.password) setTouched((t) => ({ ...t, password: true }));
        }}
        mode="outlined"
        secureTextEntry
        style={{ marginBottom: 6 }}
        placeholder="••••••••"
        disabled={submitting}
        error={!!passwordError}
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
      />
      <HelperText
        type="error"
        visible={!!passwordError}
        style={{ marginBottom: 8 }}
      >
        {passwordError || " "}
      </HelperText>

      {formError ? (
        <HelperText type="error" visible style={{ marginBottom: 8 }}>
          {formError}
        </HelperText>
      ) : null}

      <Button
        mode="contained"
        onPress={handleSubmit}
        loading={submitting}
        disabled={!canSubmit}
      >
        Sign in
      </Button>
    </View>
  );
}
