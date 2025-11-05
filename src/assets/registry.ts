// registry.ts — shared catalog of geometry & behavior assets

import type {
  DexelObjectDefinition,
  RgpXYObjectDefinition,
  SphereObjectDefinition,
  Twirl8ObjectDefinition,
  TwirlingAxisObjectDefinition,
  SimObjectDefinition,
  BaseColor,
} from '../engine/assets/simTypes';

export interface AssetBehaviorContext {
  ticksPerBeat: number;
}

export type AssetBehavior = (context: AssetBehaviorContext) => void;

export interface AssetBuildParams<TConfig extends object> {
  instanceId: string;
  config: Partial<TConfig>;
}

export interface AssetBuildResult {
  simObjects: SimObjectDefinition[];
  behavior?: AssetBehavior;
}

export interface AssetDefinition<TConfig extends object = Record<string, unknown>> {
  id: string;
  label: string;
  description?: string;
  defaultConfig: TConfig;
  build(params: AssetBuildParams<TConfig>): AssetBuildResult;
}

function mergeConfig<TConfig extends object>(defaults: TConfig, overrides: Partial<TConfig>): TConfig {
  return { ...defaults, ...overrides } as TConfig;
}

interface SphereAssetConfig extends Record<string, unknown> {
  speedPerTick: number;
  direction: 1 | -1;
  plane: 'YG' | 'GB' | 'YB';
  shellSize: number;
  baseColor: BaseColor;
  visible: boolean;
  shadingIntensity: number;
  opacity: number;
  initialRotationY?: number;
}

const sphereDefaults: SphereAssetConfig = {
  speedPerTick: 1,
  direction: 1,
  plane: 'YG',
  shellSize: 32,
  baseColor: 'azure',
  visible: false,
  shadingIntensity: 0.4,
  opacity: 1,
};

const sphereAsset: AssetDefinition<SphereAssetConfig> = {
  id: 'sphere',
  label: 'Sphere',
  description: 'Basic sphere geometry aligned to a spin plane.',
  defaultConfig: sphereDefaults,
  build: ({ instanceId, config }) => {
    const merged = mergeConfig(sphereDefaults, config);
    const definition: SphereObjectDefinition = {
      type: 'sphere',
      id: instanceId,
      speedPerTick: merged.speedPerTick,
      direction: merged.direction,
      plane: merged.plane,
      shellSize: merged.shellSize,
      baseColor: merged.baseColor,
      visible: merged.visible,
      shadingIntensity: merged.shadingIntensity,
      opacity: merged.opacity,
      initialRotationY: merged.initialRotationY,
    };
    return { simObjects: [definition] };
  },
};

interface RgpXYAssetConfig extends Record<string, unknown> {
  size: number;
  visible: boolean;
  primaryVisible: boolean;
  secondaryVisible: boolean;
  sphereVisible: boolean;
}

const rgpDefaults: RgpXYAssetConfig = {
  size: 24,
  visible: true,
  primaryVisible: true,
  secondaryVisible: true,
  sphereVisible: true,
};

const rgpXYAsset: AssetDefinition<RgpXYAssetConfig> = {
  id: 'rgpXY',
  label: 'RGP XY Grid',
  description: 'Reference grid plane for RGP formations.',
  defaultConfig: rgpDefaults,
  build: ({ instanceId, config }) => {
    const merged = mergeConfig(rgpDefaults, config);
    const definition: RgpXYObjectDefinition = {
      type: 'rgpXY',
      id: instanceId,
      size: merged.size,
      visible: merged.visible,
      primaryVisible: merged.primaryVisible,
      secondaryVisible: merged.secondaryVisible,
      sphereVisible: merged.sphereVisible,
    };
    return { simObjects: [definition] };
  },
};

interface TwirlingAxisAssetConfig extends Record<string, unknown> {
  speedPerTick: number;
  direction: 1 | -1;
  visible: boolean;
  size: number;
  initialRotationX?: number;
  initialRotationY?: number;
  initialRotationZ?: number;
  opacity: number;
  rotationScript?: string;
}

const twirlingAxisDefaults: TwirlingAxisAssetConfig = {
  speedPerTick: 10,
  direction: 1,
  visible: false,
  size: 1,
  opacity: 1,
};

const twirlingAxisAsset: AssetDefinition<TwirlingAxisAssetConfig> = {
  id: 'twirling-axis',
  label: 'Twirling Axis',
  description: 'Reference axis used to visualize rotations.',
  defaultConfig: twirlingAxisDefaults,
  build: ({ instanceId, config }) => {
    const merged = mergeConfig(twirlingAxisDefaults, config);
    const definition: TwirlingAxisObjectDefinition = {
      type: 'twirling-axis',
      id: instanceId,
      speedPerTick: merged.speedPerTick,
      direction: merged.direction,
      visible: merged.visible,
      size: merged.size,
      initialRotationX: merged.initialRotationX,
      initialRotationY: merged.initialRotationY,
      initialRotationZ: merged.initialRotationZ,
      opacity: merged.opacity,
      rotationScript: merged.rotationScript,
    };
    return { simObjects: [definition] };
  },
};

interface DexelAssetConfig extends Record<string, unknown> {
  axis: 'x' | 'y' | 'z';
  sign: 1 | -1;
  size: number;
  speedPerTick: number;
  direction: 1 | -1;
  visible: boolean;
  anchorId?: string;
  primarySpeedRatio?: number;
  secondarySpeedRatio?: number;
}

const dexelDefaults: DexelAssetConfig = {
  axis: 'x',
  sign: 1,
  size: 24,
  speedPerTick: 1,
  direction: 1,
  visible: false,
};

const dexelAsset: AssetDefinition<DexelAssetConfig> = {
  id: 'dexel',
  label: 'Dexel',
  description: 'Dexel template used for RGP formations.',
  defaultConfig: dexelDefaults,
  build: ({ instanceId, config }) => {
    const merged = mergeConfig(dexelDefaults, config);
    const definition: DexelObjectDefinition = {
      type: 'dexel',
      id: instanceId,
      axis: merged.axis,
      sign: merged.sign,
      size: merged.size,
      speedPerTick: merged.speedPerTick,
      direction: merged.direction,
      visible: merged.visible,
      anchorId: merged.anchorId,
      primarySpeedRatio: merged.primarySpeedRatio,
      secondarySpeedRatio: merged.secondarySpeedRatio,
    };
    return { simObjects: [definition] };
  },
};

interface K1P2AssetConfig extends Record<string, unknown> {
  axis: 'x' | 'y' | 'z';
  radius: number;
  color: BaseColor;
  backColor?: BaseColor;
  opacity: number;
  visible: boolean;
  size: number;
  width: number;
  lobeRotationDeg: number;
  speedPerTick: number;
  direction: 1 | -1;
  initialRotationDeg?: number;
  invertPulse?: boolean;
}

const k1p2Defaults: K1P2AssetConfig = {
  axis: 'y',
  radius: 24,
  color: 'white',
  backColor: 'white',
  opacity: 0.85,
  visible: true,
  size: 0.3,
  width: 0.3,
  lobeRotationDeg: 20,
  speedPerTick: 1,
  direction: 1,
  invertPulse: false,
};

const k1p2Asset: AssetDefinition<K1P2AssetConfig> = {
  id: 'k1p2',
  label: 'K1P2 Figure-8',
  description: 'Line figure-8 that can drive geometry or controllers.',
  defaultConfig: k1p2Defaults,
  build: ({ instanceId, config }) => {
    const merged = mergeConfig(k1p2Defaults, config);
    const size = Math.max(0.1, typeof merged.size === 'number' ? merged.size : merged.width);
    const width = Math.max(0.01, typeof merged.width === 'number' ? merged.width : size);
    const definition: Twirl8ObjectDefinition = {
      type: 'twirl8',
      id: instanceId,
      axis: merged.axis,
      radius: merged.radius,
      color: merged.color,
      backColor: merged.backColor ?? merged.color,
      opacity: merged.opacity,
      visible: merged.visible,
      size,
      width,
      lobeRotationDeg: merged.lobeRotationDeg,
      speedPerTick: merged.speedPerTick,
      direction: merged.direction,
      initialRotationDeg: merged.initialRotationDeg,
      invertPulse: merged.invertPulse,
    };
    return { simObjects: [definition] };
  },
};

const assetList: AssetDefinition[] = [
  sphereAsset,
  rgpXYAsset,
  twirlingAxisAsset,
  dexelAsset,
  k1p2Asset,
];

const assetRegistry = new Map(assetList.map((asset) => [asset.id, asset] as const));

export function listAssetDefinitions(): AssetDefinition[] {
  return [...assetList];
}

export function getAssetDefinition(assetId: string): AssetDefinition {
  const definition = assetRegistry.get(assetId);
  if (!definition) {
    throw new Error(`Asset ${assetId} is not registered.`);
  }
  return definition;
}

export function instantiateAsset(
  instanceId: string,
  assetId: string,
  config: Record<string, unknown> = {},
): AssetBuildResult {
  const definition = getAssetDefinition(assetId);
  const resolvedConfig = config as Partial<typeof definition.defaultConfig>;
  return definition.build({ instanceId, config: resolvedConfig });
}
