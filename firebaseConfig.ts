// firebaseConfig.ts

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 从 Firebase 控制台复制过来的您的项目专属配置
const firebaseConfig = {
  apiKey: "AIzaSyCOETskBtCrlGg92NdhjMyQSeWHA6HIEs",
  authDomain: "vivi-swim-school-coach.firebaseapp.com",
  projectId: "vivi-swim-school-coach",
  storageBucket: "vivi-swim-school-coach.appspot.com",
  messagingSenderId: "573986969254",
  appId: "1:573986969254:web:4ae2512693149a38e20667",
  measurementId: "G-PXN5C16TNV",
};

// 初始化 Firebase 应用
export const app = initializeApp(firebaseConfig); // ✅ 在这里添加 export

// 获取 Firestore 数据库实例并导出
export const db = getFirestore(app);
