// screens/LoginScreen.tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import { Card, Text } from "react-native-paper";
import LoginForm from "../components/LoginForm";

// 我们将使用 React Navigation 的 navigation prop 进行页面跳转
// 所以这里的类型定义可能需要根据你的导航器来调整
type Props = {
  navigation: any;
};

export default function LoginScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineMedium" style={styles.title}>
            Sign in to Coach Portal
          </Text>
          <LoginForm />
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center", // 垂直居中
    alignItems: "center", // 水平居中
    backgroundColor: "#f5f5f5",
  },
  card: {
    width: "90%",
    maxWidth: 400,
  },
  title: {
    textAlign: "center",
    marginBottom: 20,
  },
});
