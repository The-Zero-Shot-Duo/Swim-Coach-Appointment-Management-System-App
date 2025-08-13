// src/lib/auth.ts

import AsyncStorage from "@react-native-async-storage/async-storage";

// 这是存储在本地的用户信息的键名 (Key)
const USER_STORAGE_KEY = "coach_user";

/**
 * 登录函数
 * @param username - 用户名
 * * 注意：在真实的 Firebase 认证阶段，这里会替换成 Firebase 的登录逻辑。
 * 目前我们只是模拟登录，将用户信息存到本地。
 */
export async function login(username: string): Promise<void> {
  try {
    const coach = { id: username.toLowerCase(), name: username };
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(coach));
  } catch (e) {
    console.error("Failed to save user to storage", e);
    // 登录失败时可以抛出错误，让调用它的地方去处理
    throw new Error("Login failed.");
  }
}

/**
 * 登出函数
 */
export async function logout(): Promise<void> {
  try {
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
  } catch (e) {
    console.error("Failed to remove user from storage", e);
    throw new Error("Logout failed.");
  }
}

/**
 * 获取当前用户信息
 * @returns 返回用户信息对象，如果不存在则返回 null
 */
export async function getUser(): Promise<{ id: string; name: string } | null> {
  try {
    const rawUserData = await AsyncStorage.getItem(USER_STORAGE_KEY);
    return rawUserData ? JSON.parse(rawUserData) : null;
  } catch (e) {
    console.error("Failed to get user from storage", e);
    return null;
  }
}

/**
 * 检查用户是否已登录
 * @returns 如果用户已登录，返回 true；否则返回 false
 */
export async function isLoggedIn(): Promise<boolean> {
  // 通过检查 getUser() 的结果是否为 null 来判断登录状态
  const user = await getUser();
  return user !== null;
}
