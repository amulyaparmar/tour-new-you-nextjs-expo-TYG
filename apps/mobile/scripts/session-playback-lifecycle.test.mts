import assert from "node:assert/strict";
import test from "node:test";

import {
  createSessionPlaybackController,
  disposeSessionPlaybackPlayer,
  type SessionPlaybackPlayer,
} from "../src/session-playback-lifecycle.ts";

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fakePlayer() {
  const calls: string[] = [];
  const seeks: Array<ReturnType<typeof deferred>> = [];
  const player: SessionPlaybackPlayer & { playing: boolean; duration: number; rate: number } = {
    duration: 120,
    playing: false,
    rate: 1,
    play() { this.playing = true; calls.push("play"); },
    pause() { this.playing = false; calls.push("pause"); },
    // Deliberately does NOT stop playback: this matches installed Expo iOS remove().
    remove() { calls.push("remove"); },
    seekTo(seconds) {
      calls.push(`seek:${seconds}`);
      const pending = deferred();
      seeks.push(pending);
      return pending.promise;
    },
    setPlaybackRate(rate) { this.rate = rate; calls.push(`rate:${rate}`); },
  };
  return { player, calls, seeks };
}

test("screen cleanup explicitly pauses before unregistering the native player", () => {
  const { player, calls } = fakePlayer();
  const controller = createSessionPlaybackController(() => true);
  controller.attach(player);
  controller.toggle();
  controller.dispose();
  controller.dispose();
  assert.equal(player.playing, false);
  assert.deepEqual(calls, ["play", "pause", "remove"]);
  assert.equal(controller.toggle(), null);
});

test("a load that finishes after exit is paused and removed, never attached", () => {
  const { player, calls } = fakePlayer();
  const controller = createSessionPlaybackController(() => true);
  controller.dispose();
  assert.equal(controller.attach(player), false);
  assert.deepEqual(calls, ["pause", "remove"]);
});

test("inactive render blocks late attach and autoplay before effect cleanup", async () => {
  let active = true;
  const { player, calls, seeks } = fakePlayer();
  const controller = createSessionPlaybackController(() => active);
  controller.attach(player);
  const pending = controller.seek(25, true);
  active = false;
  seeks[0].resolve();
  assert.equal(await pending, null);
  assert.equal(controller.toggle(), null);
  assert.equal(calls.includes("play"), false);
  controller.dispose();
  const late = fakePlayer();
  assert.equal(controller.attach(late.player), false);
  assert.deepEqual(late.calls, ["pause", "remove"]);
});

for (const exit of ["unmount", "source replacement", "retry"] as const) {
  test(`${exit} invalidates an awaited seek that requested autoplay`, async () => {
    const { player, calls, seeks } = fakePlayer();
    const controller = createSessionPlaybackController(() => true);
    controller.attach(player);
    const pending = controller.seek(25, true);
    controller.dispose();
    seeks[0].resolve();
    assert.equal(await pending, null);
    assert.equal(calls.includes("play"), false);
    assert.equal(player.playing, false);
  });
}

test("pause cancels queued seek autoplay without disposing the current player", async () => {
  const { player, calls, seeks } = fakePlayer();
  const controller = createSessionPlaybackController(() => true);
  controller.attach(player);
  const pending = controller.seek(25, true);
  controller.pause();
  seeks[0].resolve();
  assert.equal(await pending, null);
  assert.equal(calls.includes("play"), false);
  assert.equal(calls.includes("remove"), false);
  assert.equal(controller.toggle(), true);
});

test("a newer seek wins even when the older seek finishes last", async () => {
  const { player, calls, seeks } = fakePlayer();
  const controller = createSessionPlaybackController(() => true);
  controller.attach(player);
  const oldSeek = controller.seek(25, true);
  const latestSeek = controller.seek(50, false);
  seeks[1].resolve();
  assert.equal(await latestSeek, 50);
  seeks[0].resolve();
  assert.equal(await oldSeek, null);
  assert.equal(calls.includes("play"), false);
});

test("normal seek, play, pause and speed changes remain available", async () => {
  const { player, seeks } = fakePlayer();
  const controller = createSessionPlaybackController(() => true);
  controller.attach(player);
  const pending = controller.seek(25, true);
  seeks[0].resolve();
  assert.equal(await pending, 25);
  assert.equal(player.playing, true);
  assert.equal(controller.toggle(), false);
  assert.equal(player.playing, false);
  assert.equal(controller.setPlaybackRate(1.5), true);
  assert.equal(player.rate, 1.5);
  assert.equal(controller.toggle(), true);
  assert.equal(player.rate, 1.5);
});

test("invalid seek values are ignored and finite times are clamped", async () => {
  const { player, calls, seeks } = fakePlayer();
  const controller = createSessionPlaybackController(() => true);
  controller.attach(player);
  for (const seconds of [NaN, Infinity, -Infinity]) {
    assert.equal(await controller.seek(seconds, true), null);
  }
  for (const [seconds, expected] of [[-10, 0], [500, 120]]) {
    const pending = controller.seek(seconds);
    seeks.at(-1)!.resolve();
    assert.equal(await pending, expected);
  }
  player.duration = NaN;
  const unknownDurationSeek = controller.seek(25);
  seeks.at(-1)!.resolve();
  assert.equal(await unknownDurationSeek, 25);
  assert.deepEqual(calls, ["seek:0", "seek:120", "seek:25"]);
});

test("stale seek errors are swallowed after navigation", async () => {
  const { player, seeks } = fakePlayer();
  const controller = createSessionPlaybackController(() => true);
  controller.attach(player);
  const pending = controller.seek(25, true);
  controller.dispose();
  seeks[0].reject(new Error("Native player was removed"));
  assert.equal(await pending, null);
});

test("current seek errors remain reportable", async () => {
  const { player, seeks } = fakePlayer();
  const controller = createSessionPlaybackController(() => true);
  controller.attach(player);
  const pending = controller.seek(25, true);
  seeks[0].reject(new Error("Seek failed"));
  await assert.rejects(pending, /Seek failed/);
});

test("native teardown still attempts removal if pause throws", () => {
  const { player, calls } = fakePlayer();
  player.pause = () => { throw new Error("already released"); };
  disposeSessionPlaybackPlayer(player);
  assert.deepEqual(calls, ["remove"]);
});

test("replacement player is not affected by an old generation's seek", async () => {
  const original = fakePlayer();
  const replacement = fakePlayer();
  const controller = createSessionPlaybackController(() => true);
  controller.attach(original.player);
  const pending = controller.seek(25, true);
  controller.attach(replacement.player);
  seeksResolve(original);
  assert.equal(await pending, null);
  assert.equal(original.player.playing, false);
  assert.deepEqual(replacement.calls, []);
  assert.equal(controller.toggle(), true);
});

function seeksResolve(fake: ReturnType<typeof fakePlayer>) { fake.seeks[0].resolve(); }
