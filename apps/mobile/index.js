import "react-native-gesture-handler";
import "react-native-reanimated";
import { registerRootComponent } from "expo";

import App from "./App";
import { initializeCrashReporting } from "./src/crash-reporting";

void initializeCrashReporting();

registerRootComponent(App);
