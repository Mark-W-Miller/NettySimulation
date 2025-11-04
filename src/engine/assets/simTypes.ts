// simTypes.ts — shared simulation object configuration types

export type BaseColor =
  | 'crimson'
  | 'red'
  | 'amber'
  | 'gold'
  | 'lime'
  | 'teal'
  | 'azure'
  | 'violet'
  | 'magenta'
  | 'white';

export interface SphereObjectDefinition {
  type: 'sphere';
  id: string;
  speedPerTick: number;
  direction: 1 | -1;
  plane: 'YG' | 'GB' | 'YB';
  shellSize: number;
  baseColor: BaseColor;
  visible?: boolean;
  shadingIntensity?: number;
  opacity?: number;
  initialRotationY?: number;
}

export interface TwirlObjectDefinition {
  type: 'twirl';
  id: string;
  speedPerTick: number;
  direction: 1 | -1;
  plane: 'YG' | 'GB' | 'YB';
  shellSize: number;
  baseColor: BaseColor;
  visible?: boolean;
  shadingIntensity?: number;
  opacity?: number;
  beltHalfAngle: number;
  pulseSpeed: number;
  initialRotationY?: number;
  initialPulsePhase?: number;
  initialPulseScale?: number;
}

export interface TwirlingAxisObjectDefinition {
  type: 'twirling-axis';
  id: string;
  speedPerTick: number;
  direction: 1 | -1;
  visible?: boolean;
  size?: number;
  initialRotationX?: number;
  initialRotationY?: number;
  initialRotationZ?: number;
  opacity?: number;
  rotationScript?: string;
}

export interface RgpXYObjectDefinition {
  type: 'rgpXY';
  id: string;
  size: number;
  visible?: boolean;
}

export interface Twirl8ObjectDefinition {
  type: 'twirl8';
  id: string;
  axis: 'x' | 'y' | 'z';
  radius: number;
  color: BaseColor;
  opacity?: number;
  visible?: boolean;
  size?: number;
  width?: number;
  lobeRotationDeg?: number;
  speedPerTick?: number;
  direction?: 1 | -1;
  initialRotationDeg?: number;
}

export interface DexelObjectDefinition {
  type: 'dexel';
  id: string;
  axis: 'x' | 'y' | 'z';
  sign: 1 | -1;
  size: number;
  speedPerTick?: number;
  direction?: 1 | -1;
  visible?: boolean;
  anchorId?: string;
  primarySpeedRatio?: number;
  secondarySpeedRatio?: number;
}

export type SimObjectDefinition =
  | SphereObjectDefinition
  | TwirlObjectDefinition
  | TwirlingAxisObjectDefinition
  | RgpXYObjectDefinition
  | Twirl8ObjectDefinition
  | DexelObjectDefinition;
