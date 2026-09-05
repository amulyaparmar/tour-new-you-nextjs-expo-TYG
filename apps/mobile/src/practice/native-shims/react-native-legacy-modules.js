"use strict";

const ReactNative = require("react-native");
const { wrapLegacyNativeModules } = require("./wrapLegacyNativeModules");
const { getNativeModuleOrDummy, lookupTurbo } = require("./getNativeModule");

const turboGet = (name) => lookupTurbo(name) ?? null;
const NativeModules = wrapLegacyNativeModules(ReactNative.NativeModules, turboGet);
const OriginalNativeEventEmitter = ReactNative.NativeEventEmitter;

function SafeNativeEventEmitter(nativeModule) {
  const resolved = nativeModule ?? getNativeModuleOrDummy("WebRTCModule");
  return new OriginalNativeEventEmitter(resolved);
}

module.exports = new Proxy(ReactNative, {
  get(target, prop, receiver) {
    if (prop === "NativeModules") return NativeModules;
    if (prop === "NativeEventEmitter") return SafeNativeEventEmitter;
    return Reflect.get(target, prop, receiver);
  },
});
