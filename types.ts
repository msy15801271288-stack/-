
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export type ParticleType = 'FLOWER' | 'GIFT' | 'SPARKLE';

export interface Particle extends Point3D {
  id: number;
  type: ParticleType;
  baseX: number;
  baseY: number;
  baseZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  color: string;
  size: number;
  // Animation props for sparkles
  twinklePhase: number; 
  twinkleSpeed: number;
  // Visual variations
  variant: number; 
}

export interface PhotoObject extends Point3D {
  id: string;
  img: HTMLImageElement;
  width: number;
  height: number;
  aspectRatio: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  baseX: number; // Hidden position (inside tree)
  baseY: number;
  baseZ: number;
  opacity: number;
}

export enum GestureType {
  NONE = 'NONE',
  OPEN_PALM = 'OPEN_PALM', // Explode
  CLOSED_FIST = 'CLOSED_FIST', // Reset
  PINCH = 'PINCH', // Click/Select
  POINTING = 'POINTING' // Move cursor
}

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface GestureResult {
  gesture: GestureType;
  cursor: { x: number; y: number } | null; // Normalized 0-1
}
