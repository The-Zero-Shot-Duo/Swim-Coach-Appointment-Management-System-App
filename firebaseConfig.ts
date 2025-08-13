// firebaseConfig.ts

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 从 Firebase 控制台复制过来的您的项目专属配置
const firebaseConfig = {
  apiKey: "AIzaSyCoETskBtCr1cGp92NdhjMyQSeWhA6HIEs",
  authDomain: "vivi-swim-school-coach.firebaseapp.com",
  projectId: "vivi-swim-school-coach",
  storageBucket: "vivi-swim-school-coach.firebasestorage.app",
  messagingSenderId: "573986969254",
  appId: "1:573986969254:web:4ae2512693149a38e20667",
  measurementId: "G-PXN5C16TNV",
};

let app;
if (getApps().length === 0) {
  // 如果没有已初始化的应用，则进行初始化
  app = initializeApp(firebaseConfig);
} else {
  // 否则，直接获取已初始化的应用实例
  app = getApp();
}

// 导出 app 和 db 实例
export { app };
export const db = getFirestore(app);
