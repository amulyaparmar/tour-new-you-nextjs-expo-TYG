"use strict";

const { NativeModules, TurboModuleRegistry } = require("react-native");

const DUMMY_EVENT_MODULE = {
  addListener() {},
  removeListeners() {},
};

function lookupTurbo(name) {
  try {
    const turbo = TurboModuleRegistry?.get?.(name);
    if (turbo != null) return turbo;
  } catch {}
  try {
    if (typeof global.__turboModuleProxy === "function") {
      const turbo = global.__turboModuleProxy(name);
      if (turbo != null) return turbo;
    }
  } catch {}
  return null;
}

function getNativeModule(name) {
  const existing = NativeModules?.[name];
  if (existing != null) return existing;
  return lookupTurbo(name);
}

function getNativeModuleOrDummy(name) {
  return getNativeModule(name) ?? DUMMY_EVENT_MODULE;
}

module.exports = {
  DUMMY_EVENT_MODULE,
  getNativeModule,
  getNativeModuleOrDummy,
  lookupTurbo,
};
