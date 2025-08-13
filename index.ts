// index.ts

import { registerRootComponent } from "expo";

import App from "./App";

// registerRootComponent 会自动调用 AppRegistry.registerComponent('main', () => App);
// 它还确保了无论您是在 Expo Go 中加载应用还是在原生构建中，
// 环境都能被正确地设置。
registerRootComponent(App);
