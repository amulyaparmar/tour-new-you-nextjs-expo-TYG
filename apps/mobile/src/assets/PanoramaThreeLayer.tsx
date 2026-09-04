import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import React, { useCallback, useEffect, useRef } from "react";
import {
  Image,
  PanResponder,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as THREE from "three";

type PanoramaLayerShot = {
  uri: string;
  fileName: string;
  index: number;
  targetHeadingDegrees: number;
};

type PanoramaThreeLayerProps = {
  shots: PanoramaLayerShot[];
  degreesPerShot?: number;
  headingDegrees: number;
  referenceHeadingDegrees: number | null;
  interactive?: boolean;
  navigationCommand?: {
    id: number;
    yawDeltaDegrees?: number;
    pitchDeltaDegrees?: number;
  } | null;
  style?: StyleProp<ViewStyle>;
  onReady?: () => void;
};

type ShotMesh = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  texture: THREE.Texture;
};

type ThreeLayerState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  gl: ExpoWebGLRenderingContext;
  meshes: Map<string, ShotMesh>;
  frameId: number | null;
  disposed: boolean;
};

const PANEL_RADIUS = 3;
const PANEL_WIDTH = 3.8;
const PREVIEW_STRIPS_PER_SHOT = 14;
const PREVIEW_HORIZONTAL_FOV_DEGREES = 60;

function signedAngle(value: number) {
  return ((value + 540) % 360) - 180;
}

function imageSize(uri: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

async function textureFromLocalUri(uri: string) {
  const { width, height } = await imageSize(uri);
  const texture = new THREE.Texture();
  const localImage = { localUri: uri, uri, width, height };

  // Expo GL accepts a local-file descriptor through the regular six-argument
  // texImage2D image path. A DataTexture would instead send this descriptor
  // through Three's raw-pixel overload, resulting in an empty black texture.
  texture.image = localImage;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return { texture, aspect: height / width };
}

function createCanvasBridge(gl: ExpoWebGLRenderingContext) {
  return {
    width: gl.drawingBufferWidth,
    height: gl.drawingBufferHeight,
    clientWidth: gl.drawingBufferWidth,
    clientHeight: gl.drawingBufferHeight,
    style: {},
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    setAttribute: () => undefined,
  };
}

function normalizeSignedDegrees(value: number) {
  return ((value + 540) % 360) - 180;
}

function InteractivePanoramaLayer({
  shots,
  degreesPerShot = 60,
  navigationCommand,
  style,
  onReady,
}: PanoramaThreeLayerProps) {
  // Do not mount local JPEGs against a 1x1 placeholder. React Native may cache
  // that tiny decode and upscale it after layout, making every frame blurry.
  const [viewport, setViewport] = React.useState({ width: 0, height: 0 });
  const [sourceAspect, setSourceAspect] = React.useState(16 / 9);
  const [renderedView, setRenderedView] = React.useState({ yawDegrees: 0, pitchDegrees: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const readyShotKeyRef = useRef("");
  const viewRef = useRef({
    yawDegrees: 0,
    pitchDegrees: 0,
    startYawDegrees: 0,
    startPitchDegrees: 0,
  });
  const orderedShots = React.useMemo(
    () => [...shots].sort((left, right) => left.index - right.index),
    [shots],
  );
  const shotKey = orderedShots.map((shot) => shot.fileName).join("|");

  useEffect(() => {
    if (viewport.width <= 1 || viewport.height <= 1 || orderedShots.length === 0) return;
    if (readyShotKeyRef.current === shotKey) return;
    readyShotKeyRef.current = shotKey;
    onReady?.();
  }, [onReady, orderedShots.length, shotKey, viewport.height, viewport.width]);

  useEffect(() => {
    const firstShot = orderedShots[0];
    if (!firstShot) return;
    let active = true;
    Image.getSize(firstShot.uri, (width, height) => {
      if (active && width > 0 && height > 0) setSourceAspect(height / width);
    });
    return () => {
      active = false;
    };
  }, [orderedShots]);

  const updateView = useCallback((yawDegrees: number, pitchDegrees: number) => {
    viewRef.current.yawDegrees = yawDegrees;
    viewRef.current.pitchDegrees = pitchDegrees;
    setRenderedView({ yawDegrees, pitchDegrees });
  }, []);

  useEffect(() => {
    if (!navigationCommand) return;
    const view = viewRef.current;
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    const startYaw = view.yawDegrees;
    const startPitch = view.pitchDegrees;
    const targetYaw = startYaw + (navigationCommand.yawDeltaDegrees ?? 0);
    const targetPitch = Math.max(
      -50,
      Math.min(50, startPitch + (navigationCommand.pitchDeltaDegrees ?? 0)),
    );
    const startedAt = Date.now();
    const animate = () => {
      const progress = Math.min((Date.now() - startedAt) / 380, 1);
      const eased = progress * progress * (3 - 2 * progress);
      updateView(
        startYaw + (targetYaw - startYaw) * eased,
        startPitch + (targetPitch - startPitch) * eased,
      );
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
        updateView(normalizeSignedDegrees(targetYaw), targetPitch);
      }
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    };
  }, [navigationCommand, updateView]);

  useEffect(() => () => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
  }, []);

  const startMomentum = useCallback((velocityX: number, velocityY: number) => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    // PanResponder reports velocity in screen points per millisecond; convert
    // it to panorama degrees per second before applying momentum.
    let yawVelocity = -((velocityX * 1000) / Math.max(viewport.width, 1)) * degreesPerShot;
    let pitchVelocity = ((velocityY * 1000) / Math.max(viewport.height, 1)) * 50;
    yawVelocity = Math.max(-420, Math.min(420, yawVelocity));
    pitchVelocity = Math.max(-180, Math.min(180, pitchVelocity));
    let previousTime = Date.now();

    const coast = () => {
      const now = Date.now();
      const elapsedSeconds = Math.min((now - previousTime) / 1000, 0.034);
      previousTime = now;
      const view = viewRef.current;
      const nextYaw = view.yawDegrees + yawVelocity * elapsedSeconds;
      const unboundedPitch = view.pitchDegrees + pitchVelocity * elapsedSeconds;
      const nextPitch = Math.max(-50, Math.min(50, unboundedPitch));
      if (nextPitch !== unboundedPitch) pitchVelocity = 0;
      updateView(nextYaw, nextPitch);

      // Exponential friction feels consistent across 60 Hz and 120 Hz phones.
      const friction = 0.055 ** elapsedSeconds;
      yawVelocity *= friction;
      pitchVelocity *= friction;
      if (Math.abs(yawVelocity) > 0.35 || Math.abs(pitchVelocity) > 0.35) {
        animationFrameRef.current = requestAnimationFrame(coast);
      } else {
        animationFrameRef.current = null;
        updateView(normalizeSignedDegrees(nextYaw), nextPitch);
      }
    };

    animationFrameRef.current = requestAnimationFrame(coast);
  }, [degreesPerShot, updateView, viewport.height, viewport.width]);

  const panResponder = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      const view = viewRef.current;
      view.startYawDegrees = view.yawDegrees;
      view.startPitchDegrees = view.pitchDegrees;
    },
    onPanResponderMove: (_event, gesture) => {
      const view = viewRef.current;
      const yawDegrees = view.startYawDegrees
        - (gesture.dx / Math.max(viewport.width, 1)) * degreesPerShot;
      const pitchDegrees = Math.max(
        -50,
        Math.min(50, view.startPitchDegrees + (gesture.dy / Math.max(viewport.height, 1)) * 50),
      );
      updateView(yawDegrees, pitchDegrees);
    },
    onPanResponderRelease: (_event, gesture) => {
      const speed = Math.sqrt(gesture.vx * gesture.vx + gesture.vy * gesture.vy);
      if (speed > 0.04) {
        startMomentum(gesture.vx, gesture.vy);
      } else {
        const view = viewRef.current;
        updateView(normalizeSignedDegrees(view.yawDegrees), view.pitchDegrees);
      }
    },
    onPanResponderTerminate: () => {
      const view = viewRef.current;
      updateView(normalizeSignedDegrees(view.yawDegrees), view.pitchDegrees);
    },
  }), [degreesPerShot, startMomentum, updateView, viewport.height, viewport.width]);

  // Preserve every source pixel horizontally. On a screen taller than the
  // camera frame this intentionally letterboxes instead of cropping the sides.
  const imageHeight = viewport.width * sourceAspect;
  const verticalTravel = Math.max((imageHeight - viewport.height) / 2, 0);
  const imageTop = (renderedView.pitchDegrees / 50) * verticalTravel
    - (imageHeight - viewport.height) / 2;
  const imageCenterY = imageTop + imageHeight / 2;
  const focalLength = viewport.width > 0
    ? (viewport.width / 2) / Math.tan(THREE.MathUtils.degToRad(PREVIEW_HORIZONTAL_FOV_DEGREES / 2))
    : 0;

  return (
    <View
      {...panResponder.panHandlers}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) setViewport({ width, height });
      }}
      style={[styles.nativeLayer, style]}
    >
        {viewport.width > 1 && viewport.height > 1 ? orderedShots.flatMap((shot) => (
          Array.from({ length: PREVIEW_STRIPS_PER_SHOT }).map((_, stripIndex) => {
            const sectorStart = -degreesPerShot / 2;
            const stripDegrees = degreesPerShot / PREVIEW_STRIPS_PER_SHOT;
            const localLeftDegrees = sectorStart + stripIndex * stripDegrees;
            const localRightDegrees = localLeftDegrees + stripDegrees;
            const localCenterDegrees = (localLeftDegrees + localRightDegrees) / 2;
            const relativeCenterDegrees = normalizeSignedDegrees(
              shot.index * degreesPerShot + localCenterDegrees - renderedView.yawDegrees,
            );
            if (Math.abs(relativeCenterDegrees) > 78) return null;
            const relativeLeftDegrees = relativeCenterDegrees - stripDegrees / 2;
            const relativeRightDegrees = relativeCenterDegrees + stripDegrees / 2;
            const projectedLeft = viewport.width / 2
              + Math.tan(THREE.MathUtils.degToRad(relativeLeftDegrees)) * focalLength;
            const projectedRight = viewport.width / 2
              + Math.tan(THREE.MathUtils.degToRad(relativeRightDegrees)) * focalLength;
            const projectedWidth = Math.max(1, projectedRight - projectedLeft);
            // Perspective photos stretch their ceiling/floor near the side
            // edges. Shrinking each strip by cos(theta) is the cylindrical
            // reprojection term that keeps those horizontal boundaries from
            // forming a six-sided zig-zag in the quick preview.
            const verticalProjectionScale = Math.cos(THREE.MathUtils.degToRad(localCenterDegrees));
            const projectedImageHeight = imageHeight * verticalProjectionScale;
            const projectedImageTop = imageCenterY - projectedImageHeight / 2;

            return (
              <View
                key={`${shot.fileName}-curve-${stripIndex}`}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: projectedLeft - 0.5,
                  top: projectedImageTop,
                  width: projectedWidth + 1,
                  height: projectedImageHeight,
                  overflow: "hidden",
                }}
              >
                <Image
                  source={{ uri: shot.uri }}
                  fadeDuration={0}
                  resizeMethod="scale"
                  resizeMode="stretch"
                  style={{
                    position: "absolute",
                    left: -stripIndex * projectedWidth,
                    top: 0,
                    width: projectedWidth * PREVIEW_STRIPS_PER_SHOT,
                    height: projectedImageHeight,
                  }}
                />
              </View>
            );
          })
        )) : null}
    </View>
  );
}

function PanoramaGlLayer({
  shots,
  degreesPerShot = 60,
  headingDegrees,
  referenceHeadingDegrees,
  interactive = false,
  navigationCommand = null,
  style,
  onReady,
}: PanoramaThreeLayerProps) {
  const layerRef = useRef<ThreeLayerState | null>(null);
  const shotsRef = useRef(shots);
  const headingRef = useRef({ headingDegrees, referenceHeadingDegrees });
  const interactionRef = useRef({
    yawDegrees: 0,
    pitchDegrees: 0,
    targetYawDegrees: 0,
    targetPitchDegrees: 0,
    startX: 0,
    startY: 0,
    startYawDegrees: 0,
    startPitchDegrees: 0,
  });
  const onReadyRef = useRef(onReady);

  shotsRef.current = shots;
  headingRef.current = { headingDegrees, referenceHeadingDegrees };
  onReadyRef.current = onReady;

  const beginInteraction = useCallback((event: GestureResponderEvent) => {
    const interaction = interactionRef.current;
    interaction.startX = event.nativeEvent.pageX;
    interaction.startY = event.nativeEvent.pageY;
    interaction.startYawDegrees = interaction.targetYawDegrees;
    interaction.startPitchDegrees = interaction.targetPitchDegrees;
  }, []);

  const moveInteraction = useCallback((event: GestureResponderEvent) => {
    const interaction = interactionRef.current;
    const deltaX = event.nativeEvent.pageX - interaction.startX;
    const deltaY = event.nativeEvent.pageY - interaction.startY;
    interaction.targetYawDegrees = interaction.startYawDegrees - deltaX * 0.22;
    interaction.targetPitchDegrees = Math.max(
      -50,
      Math.min(50, interaction.startPitchDegrees - deltaY * 0.16),
    );
    interaction.yawDegrees = interaction.targetYawDegrees;
    interaction.pitchDegrees = interaction.targetPitchDegrees;
  }, []);

  useEffect(() => {
    if (!interactive || !navigationCommand) return;
    const interaction = interactionRef.current;
    interaction.targetYawDegrees += navigationCommand.yawDeltaDegrees ?? 0;
    interaction.targetPitchDegrees = Math.max(
      -50,
      Math.min(
        50,
        interaction.targetPitchDegrees + (navigationCommand.pitchDeltaDegrees ?? 0),
      ),
    );
  }, [interactive, navigationCommand]);

  const syncShotMeshes = useCallback(async (layer: ThreeLayerState) => {
    const activeKeys = new Set(shotsRef.current.map((shot) => shot.fileName));
    for (const [key, entry] of layer.meshes) {
      if (activeKeys.has(key)) continue;
      layer.scene.remove(entry.mesh);
      entry.mesh.geometry.dispose();
      entry.mesh.material.dispose();
      entry.texture.dispose();
      layer.meshes.delete(key);
    }

    await Promise.all(shotsRef.current.map(async (shot) => {
      if (layer.disposed || layer.meshes.has(shot.fileName)) return;
      const { texture, aspect } = await textureFromLocalUri(shot.uri);
      if (layer.disposed || !shotsRef.current.some((candidate) => candidate.fileName === shot.fileName)) {
        texture.dispose();
        return;
      }

      const panelHeight = PANEL_WIDTH * aspect;
      const geometry = new THREE.PlaneGeometry(PANEL_WIDTH, panelHeight);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      const angle = THREE.MathUtils.degToRad(shot.index * degreesPerShot);
      mesh.position.set(
        Math.sin(angle) * PANEL_RADIUS,
        0,
        -Math.cos(angle) * PANEL_RADIUS,
      );
      mesh.rotation.y = -angle;
      mesh.renderOrder = shot.index;
      layer.meshes.set(shot.fileName, { mesh, texture });
      layer.scene.add(mesh);
    }));
  }, [degreesPerShot]);

  useEffect(() => {
    const layer = layerRef.current;
    if (layer) void syncShotMeshes(layer);
  }, [shots, syncShotMeshes]);

  useEffect(() => () => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.disposed = true;
    if (layer.frameId !== null) cancelAnimationFrame(layer.frameId);
    for (const entry of layer.meshes.values()) {
      entry.mesh.geometry.dispose();
      entry.mesh.material.dispose();
      entry.texture.dispose();
    }
    layer.meshes.clear();
    layer.renderer.dispose();
    layerRef.current = null;
  }, []);

  const createContext = useCallback((gl: ExpoWebGLRenderingContext) => {
    try {
      const renderer = new THREE.WebGLRenderer({
        canvas: createCanvasBridge(gl) as never,
        context: gl as never,
        antialias: true,
        alpha: false,
      });
      renderer.setPixelRatio(1);
      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight, false);
      renderer.setClearColor(0x000000, 1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000);
      const camera = new THREE.PerspectiveCamera(
        115,
        gl.drawingBufferWidth / gl.drawingBufferHeight,
        0.1,
        100,
      );
      camera.position.set(0, 0, 0);

      const layer: ThreeLayerState = {
        renderer,
        scene,
        camera,
        gl,
        meshes: new Map(),
        frameId: null,
        disposed: false,
      };
      layerRef.current = layer;
      void syncShotMeshes(layer).then(() => {
        if (!layer.disposed) onReadyRef.current?.();
      });

      const render = () => {
        if (layer.disposed) return;
        if (interactive) {
          const interaction = interactionRef.current;
          interaction.yawDegrees += (interaction.targetYawDegrees - interaction.yawDegrees) * 0.12;
          interaction.pitchDegrees += (interaction.targetPitchDegrees - interaction.pitchDegrees) * 0.12;
          layer.camera.rotation.set(
            THREE.MathUtils.degToRad(interaction.pitchDegrees),
            THREE.MathUtils.degToRad(-interaction.yawDegrees),
            0,
          );
        } else {
          const heading = headingRef.current;
          const relativeHeading = heading.referenceHeadingDegrees === null
            ? 0
            : signedAngle(heading.headingDegrees - heading.referenceHeadingDegrees);
          layer.camera.rotation.set(0, THREE.MathUtils.degToRad(-relativeHeading), 0);
        }
        layer.renderer.render(layer.scene, layer.camera);
        layer.gl.endFrameEXP();
        layer.frameId = requestAnimationFrame(render);
      };
      render();
    } catch (caught) {
      console.warn("Could not start the panorama Three.js layer", caught);
    }
  }, [interactive, syncShotMeshes]);

  return (
    <GLView
      pointerEvents={interactive ? "auto" : "none"}
      onStartShouldSetResponder={() => interactive}
      onMoveShouldSetResponder={() => interactive}
      onResponderGrant={beginInteraction}
      onResponderMove={moveInteraction}
      msaaSamples={2}
      onContextCreate={createContext}
      style={[styles.layer, style]}
    />
  );
}

export function PanoramaThreeLayer(props: PanoramaThreeLayerProps) {
  if (props.interactive) {
    return <InteractivePanoramaLayer {...props} />;
  }
  return <PanoramaGlLayer {...props} />;
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  nativeLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    backgroundColor: "#000",
  },
});
