"use strict";

/**
 * Bridgeless RN keeps RCT_EXPORT_MODULE modules off NativeModules until
 * TurboModuleRegistry.get() initializes them. Daily/WebRTC still read
 * NativeModules at import time, so wrap the map and resolve the same names
 * through the turbo registry.
 *
 * The proxy target is a plain object so this works even when NativeModules is
 * a JSI HostObject that Hermes cannot use as a Proxy target.
 */
function wrapLegacyNativeModules(nativeModules, turboGet) {
  const resolving = new Set();

  const lookup = (name) => {
    if (resolving.has(name)) return undefined;
    resolving.add(name);
    try {
      const existing = nativeModules?.[name];
      if (existing != null) return existing;
      return turboGet(name) ?? existing;
    } finally {
      resolving.delete(name);
    }
  };

  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== "string") return undefined;
        return lookup(prop);
      },
      has(_target, prop) {
        return typeof prop === "string" && lookup(prop) != null;
      },
    },
  );
}

module.exports = { wrapLegacyNativeModules };
