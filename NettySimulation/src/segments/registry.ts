import type { SegmentBlueprint } from './types';

export const SEGMENT_BLUEPRINTS: SegmentBlueprint[] = [
  {
    id: 'rgp',
    name: 'RGP Simulation',
    assets: [
      {
        assetId: 'sphere',
        instanceId: 'sphere-primary',
        config: {
          speedPerTick: 1,
          direction: 1,
          plane: 'YG',
          shellSize: 32,
          baseColor: 'azure',
          visible: true,
          shadingIntensity: 0.4,
          opacity: 1,
        },
      },
      {
        assetId: 'sphere',
        instanceId: 'sphere-secondary',
        config: {
          speedPerTick: 0.75,
          direction: -1,
          plane: 'GB',
          shellSize: 24,
          baseColor: 'crimson',
          visible: true,
          shadingIntensity: 0.55,
          opacity: 0.85,
          initialRotationY: Math.PI / 4,
        },
      },
    ],
  },
  {
    id: 'rgp-formation',
    name: 'RGP Formation',
    assets: [
      {
        assetId: 'rgpXY',
        instanceId: 'rgp-xy',
        config: {
          size: 24,
          visible: true,
        },
      },
      {
        assetId: 'twirling-axis',
        instanceId: 'formation-axis',
        config: {
          speedPerTick: 10,
          direction: 1,
          visible: false,
          size: 1,
          initialRotationY: 0,
          initialRotationZ: 0,
          opacity: 1,
        },
      },
      {
        assetId: 'dexel',
        instanceId: 'dexel-template',
        config: {
          axis: 'x',
          sign: 1,
          size: 24,
          speedPerTick: 1,
          direction: 1,
          visible: false,
          anchorId: 'rgp-xy',
        },
      },
    ],
  },
  {
    id: 'RGP_Pray',
    name: 'RGP_Pray',
    assets: [
      {
        assetId: 'k1p2',
        instanceId: 'K1',
        config: {
          axis: 'y',
          radius: 24,
          color: 'white',
          opacity: 0.85,
          width: 0.3,
          lobeRotationDeg: 20,
          visible: true,
        },
      },
      {
        assetId: 'k1p2',
        instanceId: 'P2',
        config: {
          axis: 'z',
          radius: 24,
          color: 'azure',
          opacity: 0.7,
          width: 0.3,
          lobeRotationDeg: 20,
          visible: true,
        },
      },
    ],
  },
];
