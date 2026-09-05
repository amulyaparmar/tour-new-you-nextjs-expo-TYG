"use strict";

/**
 * Replacement for @daily-co/react-native-webrtc/src/EventEmitter.ts.
 * NativeModules.WebRTCModule is null under bridgeless RN until the turbo
 * interop is queried by name; constructing NativeEventEmitter with that
 * null value crashes iOS before a call can start.
 */
const { NativeEventEmitter } = require("react-native");
const EventEmitterModule = require("react-native/Libraries/vendor/emitter/EventEmitter");
const EventEmitter = EventEmitterModule.default ?? EventEmitterModule;
const { getNativeModuleOrDummy } = require("./getNativeModule");

const nativeEmitter = new NativeEventEmitter(getNativeModuleOrDummy("WebRTCModule"));

const NATIVE_EVENTS = [
  "peerConnectionSignalingStateChanged",
  "peerConnectionStateChanged",
  "peerConnectionOnRenegotiationNeeded",
  "peerConnectionIceConnectionChanged",
  "peerConnectionIceGatheringChanged",
  "peerConnectionGotICECandidate",
  "peerConnectionDidOpenDataChannel",
  "peerConnectionOnRemoveTrack",
  "peerConnectionOnTrack",
  "dataChannelStateChanged",
  "dataChannelReceiveMessage",
  "dataChannelDidChangeBufferedAmount",
  "mediaStreamTrackMuteChanged",
  "mediaStreamTrackEnded",
  "mediaDevicesOnDeviceChange",
];

const eventEmitter = new EventEmitter();

function setupNativeEvents() {
  for (const eventName of NATIVE_EVENTS) {
    nativeEmitter.addListener(eventName, (...args) => {
      eventEmitter.emit(eventName, ...args);
    });
  }
}

const _subscriptions = new Map();

function addListener(listener, eventName, eventHandler) {
  if (!NATIVE_EVENTS.includes(eventName)) {
    throw new Error(`Invalid event: ${eventName}`);
  }
  if (!_subscriptions.has(listener)) {
    _subscriptions.set(listener, []);
  }
  _subscriptions.get(listener).push(eventEmitter.addListener(eventName, eventHandler));
}

function removeListener(listener) {
  const subscriptions = _subscriptions.get(listener);
  if (subscriptions) {
    subscriptions.forEach((sub) => sub.remove());
    _subscriptions.delete(listener);
  }
}

module.exports = {
  setupNativeEvents,
  addListener,
  removeListener,
};
