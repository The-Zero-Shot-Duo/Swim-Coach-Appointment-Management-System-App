// firebaseConfig.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, setLogLevel } from "firebase/firestore";
import {
  getAuth,
  initializeAuth,
  inMemoryPersistence, // ✅ 使用内存持久化
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCoETskBtCr1cGp92NdhjMyQSeWhA6HIEs",
  authDomain: "vivi-swim-school-coach.firebaseapp.com",
  projectId: "vivi-swim-school-coach",
  storageBucket: "vivi-swim-school-coach.firebasestorage.app",
  messagingSenderId: "573986969254",
  appId: "1:573986969254:web:4ae2512693149a38e20667",
  measurementId: "G-PXN5C16TNV",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// 开发期：打开 Firestore 详细日志
if (__DEV__) setLogLevel("debug");

// ✅ 显式用“内存持久化”，既不写入存储，也不会有警告
let _auth;
try {
  _auth = initializeAuth(app, { persistence: inMemoryPersistence });
} catch {
  // 热重载时 initializeAuth 可能已执行过，回退到 getAuth
  _auth = getAuth(app);
}

export const auth = _auth;
export const db = getFirestore(app);
