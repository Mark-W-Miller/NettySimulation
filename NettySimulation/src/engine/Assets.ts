// Assets.ts — centralizes asset factory accessors for the engine
import {
  createAxisSet,
  disposeAxisSet,
  createAxisProgram,
  disposeAxisProgram,
  useAxisProgram,
  setAxisSharedUniforms,
  drawAxis,
} from './assets/axisAsset';
export { DEFAULT_AXIS_RADIUS, DEFAULT_AXIS_NEGATIVE_ALPHA_SCALE } from './assets/axisAsset';
import {
  createSphereMesh,
  disposeSphereMesh,
  createSphereProgram,
  disposeSphereProgram,
  useSphereProgram,
  setSphereSharedUniforms,
  drawSphere,
} from './assets/sphereAsset';
import {
  createTwirlMesh,
  disposeTwirlMesh,
  createTwirlProgram,
  disposeTwirlProgram,
  useTwirlProgram,
  setTwirlSharedUniforms,
  drawTwirl,
} from './assets/twirlAsset';
import {
  createTwirlingAxisMesh,
  disposeTwirlingAxisMesh,
  drawTwirlingAxis,
} from './assets/twirlingAxisAsset';

export const Assets = {
  createAxisSet,
  disposeAxisSet,
  createAxisProgram,
  disposeAxisProgram,
  useAxisProgram,
  setAxisSharedUniforms,
  drawAxis,
  createSphereMesh,
  disposeSphereMesh,
  createTwirlMesh,
  disposeTwirlMesh,
  createSphereProgram,
  disposeSphereProgram,
  useSphereProgram,
  setSphereSharedUniforms,
  drawSphere,
  createTwirlProgram,
  disposeTwirlProgram,
  useTwirlProgram,
  setTwirlSharedUniforms,
  drawTwirl,
  createTwirlingAxisMesh,
  disposeTwirlingAxisMesh,
  drawTwirlingAxis,
};

export type {
  AxisMesh,
  AxisSet,
  AxisProgram,
  AxisSharedUniforms,
  AxisDrawParams,
  AxisGeometryOptions,
} from './assets/axisAsset';
export type {
  SphereMesh,
  SphereProgram,
  SphereSharedUniforms,
  SphereDrawParams,
} from './assets/sphereAsset';
export type {
  TwirlMesh,
  TwirlProgram,
  TwirlSharedUniforms,
  TwirlDrawParams,
} from './assets/twirlAsset';
export type { TwirlingAxisMesh } from './assets/twirlingAxisAsset';
