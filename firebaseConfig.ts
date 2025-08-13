// firebaseConfig.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, setLogLevel } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCoETskBtCr1cGp92NdhjMyQSeWhA6HIEs",
  authDomain: "vivi-swim-school-coach.firebaseapp.com",
  projectId: "vivi-swim-school-coach",
  storageBucket: "vivi-swim-school-coach.firebasestorage.app",
  messagingSenderId: "573986969254",
  appId: "1:573986969254:web:4ae2512693149a38e20667",
  measurementId: "G-PXN5C16TNV",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// 开发阶段：打开 Firestore 调试日志（看到具体网络和规则命中）
setLogLevel("debug");

export { app };
export const db = getFirestore(app);
export const auth = getAuth(app);
