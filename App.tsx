// App.tsx
import { PaperProvider } from "react-native-paper";
import { NavigationContainer } from "@react-navigation/native";
// ... 你的导航器 (Navigator) 和其他 imports

export default function App() {
  return (
    <PaperProvider>
      {/* 你的导航逻辑会放在这里 */}
      <NavigationContainer>{/* ... */}</NavigationContainer>
    </PaperProvider>
  );
}
