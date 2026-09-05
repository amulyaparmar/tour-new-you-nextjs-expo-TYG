"use strict";

const {
  DeviceEventEmitter,
  NativeAppEventEmitter,
  NativeEventEmitter,
  Platform,
} = require("react-native");
const { getNativeModule, getNativeModuleOrDummy } = require("./getNativeModule");

const RNBackgroundTimer = getNativeModule("RNBackgroundTimer") ?? getNativeModuleOrDummy("RNBackgroundTimer");
const Emitter = new NativeEventEmitter(getNativeModuleOrDummy("RNBackgroundTimer"));

class BackgroundTimer {
  constructor() {
    this.uniqueId = 0;
    this.callbacks = {};

    Emitter.addListener("backgroundTimer.timeout", (id) => {
      if (this.callbacks[id]) {
        const callbackById = this.callbacks[id];
        const { callback } = callbackById;
        if (!this.callbacks[id].interval) {
          delete this.callbacks[id];
        } else if (RNBackgroundTimer.setTimeout) {
          RNBackgroundTimer.setTimeout(id, this.callbacks[id].timeout);
        }
        callback();
      }
    });
  }

  start(delay = 0) {
    return RNBackgroundTimer.start?.(delay);
  }

  stop() {
    return RNBackgroundTimer.stop?.();
  }

  runBackgroundTimer(callback, delay) {
    const EventEmitter = Platform.select({
      ios: () => NativeAppEventEmitter,
      android: () => DeviceEventEmitter,
    })();
    this.start(0);
    this.backgroundListener = EventEmitter.addListener("backgroundTimer", () => {
      this.backgroundListener.remove();
      this.backgroundClockMethod(callback, delay);
    });
  }

  backgroundClockMethod(callback, delay) {
    this.backgroundTimer = this.setTimeout(() => {
      callback();
      this.backgroundClockMethod(callback, delay);
    }, delay);
  }

  stopBackgroundTimer() {
    this.stop();
    this.clearTimeout(this.backgroundTimer);
  }

  setTimeout(callback, timeout) {
    this.uniqueId += 1;
    const timeoutId = this.uniqueId;
    this.callbacks[timeoutId] = {
      callback,
      interval: false,
      timeout,
    };
    RNBackgroundTimer.setTimeout?.(timeoutId, timeout);
    return timeoutId;
  }

  clearTimeout(timeoutId) {
    if (this.callbacks[timeoutId]) {
      delete this.callbacks[timeoutId];
    }
  }

  setInterval(callback, timeout) {
    this.uniqueId += 1;
    const intervalId = this.uniqueId;
    this.callbacks[intervalId] = {
      callback,
      interval: true,
      timeout,
    };
    RNBackgroundTimer.setTimeout?.(intervalId, timeout);
    return intervalId;
  }

  clearInterval(intervalId) {
    if (this.callbacks[intervalId]) {
      delete this.callbacks[intervalId];
    }
  }
}

const instance = new BackgroundTimer();
module.exports = instance;
module.exports.default = instance;
