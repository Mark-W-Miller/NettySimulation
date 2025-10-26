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

export const Assets = {
  createAxisSet,
  disposeAxisSet,
  createSphereMesh,
  disposeSphereMesh,
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
