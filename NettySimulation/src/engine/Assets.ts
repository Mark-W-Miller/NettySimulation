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
};

export type {
  AxisMesh,
  AxisSet,
  AxisProgram,
  AxisSharedUniforms,
  AxisDrawParams,
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
