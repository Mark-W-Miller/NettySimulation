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
import {
  createK1P2Mesh,
  disposeK1P2Mesh,
  createK1P2Program,
  disposeK1P2Program,
  useK1P2Program,
  setK1P2SharedUniforms,
  drawK1P2,
} from './assets/K1P2Asset';

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
  createTwirl8Mesh: createK1P2Mesh,
  disposeTwirl8Mesh: disposeK1P2Mesh,
  createTwirl8Program: createK1P2Program,
  disposeTwirl8Program: disposeK1P2Program,
  useTwirl8Program: useK1P2Program,
  setTwirl8SharedUniforms: setK1P2SharedUniforms,
  drawTwirl8: drawK1P2,
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
export type {
  K1P2Mesh as Twirl8Mesh,
  K1P2Program as Twirl8Program,
  K1P2SharedUniforms as Twirl8SharedUniforms,
} from './assets/K1P2Asset';
