// screens/LoginScreen.tsx
import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Card, Text } from "react-native-paper";
import LoginForm from "../components/LoginForm";

type Props = { navigation: any };

export default function LoginScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineMedium" style={styles.title}>
            Sign in to Coach Portal
          </Text>

          <LoginForm />

          <TouchableOpacity
            onPress={() => navigation.navigate("Register")}
            style={styles.footerLink}
          >
            <Text style={{ color: "#1e90ff", textAlign: "center" }}>
              没有账号？去注册
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
  footerLink: { marginTop: 12 },
});
