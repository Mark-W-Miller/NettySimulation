// Assets.ts — centralizes asset factory accessors for the engine
import { createAxisSet, disposeAxisSet } from './assets/axisAsset';
import {
  createSphereMesh,
  disposeSphereMesh,
  createSphereProgram,
  disposeSphereProgram,
  useSphereProgram,
  setSphereSharedUniforms,
  drawSphere,
} from './assets/sphereAsset';
import { createTwirlMesh, disposeTwirlMesh } from './assets/twirlAsset';

export const Assets = {
  createAxisSet,
  disposeAxisSet,
  createSphereMesh,
  disposeSphereMesh,
  createTwirlMesh,
  disposeTwirlMesh,
  createSphereProgram,
  disposeSphereProgram,
  useSphereProgram,
  setSphereSharedUniforms,
  drawSphere,
};

export type { AxisMesh, AxisSet } from './assets/axisAsset';
export type {
  SphereMesh,
  SphereProgram,
  SphereSharedUniforms,
  SphereDrawParams,
} from './assets/sphereAsset';
export type { TwirlMesh } from './assets/twirlAsset';
