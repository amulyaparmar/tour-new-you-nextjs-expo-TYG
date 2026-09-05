"use strict";

const ReactNative = require("react-native");
const { wrapLegacyNativeModules } = require("./wrapLegacyNativeModules");

const turboGet = (name) => {
  try {
    return ReactNative.TurboModuleRegistry?.get?.(name) ?? null;
  } catch {
    return null;
  }
};

const NativeModules = wrapLegacyNativeModules(ReactNative.NativeModules, turboGet);

module.exports = new Proxy(ReactNative, {
  get(target, prop, receiver) {
    if (prop === "NativeModules") return NativeModules;
    return Reflect.get(target, prop, receiver);
  },
});
