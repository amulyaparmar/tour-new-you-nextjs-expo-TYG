import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";

/** Native device detection. Constants.isDevice is undefined in some custom dev clients. */
export function isPhysicalDevice(): boolean {
  return Device.isDevice;
}

export function isSimulator(): boolean {
  return !isPhysicalDevice();
}

/** True when running inside the Expo Go app (not a dev client or store build). */
export function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

/** Background recording + foreground service require a custom native build. */
export function supportsBackgroundRecording(): boolean {
  return !isExpoGo();
}

/** iOS Live Activities require the expo-live-activity native target (dev client / store build). */
export function supportsLiveActivities(): boolean {
  return Platform.OS === "ios" && !isExpoGo();
}
