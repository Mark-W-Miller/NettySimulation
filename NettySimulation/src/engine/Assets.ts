// Assets.ts — centralizes asset factory accessors for the engine
import { createAxisMesh, disposeAxisMesh } from './assets/axisAsset';
import { createSphereMesh, disposeSphereMesh } from './assets/sphereAsset';

export const Assets = {
  createAxisMesh,
  disposeAxisMesh,
  createSphereMesh,
  disposeSphereMesh,
};

export type { AxisMesh } from './assets/axisAsset';
export type { SphereMesh } from './assets/sphereAsset';
