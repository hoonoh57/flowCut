// src/providers/types.ts
// FlowCut Provider Interface — Open Architecture (렌더러 독립)

export interface ImageGenerationParams {
  prompt: string;
  negative?: string;
  width: number;
  height: number;
  seed?: number;
  characterRefs?: string[];
  styleRef?: string;
  workflow?: string;
}

export interface VideoGenerationParams {
  startImage?: string;
  endImage?: string;
  prompt: string;
  negative?: string;
  width: number;
  height: number;
  frames: number;
  fps: number;
  seed?: number;
  motionRef?: string;
  workflow?: string;
}

export interface TTSParams {
  text: string;
  language: string;
  voice?: string;
  sampleClip?: string;
  speed?: number;
  emotion?: string;
}

export interface InterpolationParams {
  videoPathA: string;
  videoPathB: string;
  overlapFrames: number;
  method?: string;
  fps?: number;
}

export interface UpscaleParams {
  imagePath: string;
  scale: number;
  method?: string;
}

export interface LLMParams {
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ProviderResult {
  success: boolean;
  localPath?: string;
  serverUrl?: string;
  duration?: number;
  frames?: number;
  width?: number;
  height?: number;
  text?: string;
  error?: string;
}

export type ProviderType = 'image' | 'video' | 'tts' | 'interpolation' | 'upscale' | 'llm';

export interface ProviderCapabilities {
  seedControl?: boolean;
  ipAdapter?: boolean;
  faceID?: boolean;
  controlNet?: boolean;
  flf2v?: boolean;
  i2v?: boolean;
  videoExtend?: boolean;
  voiceClone?: boolean;
  frameInterpolation?: boolean;
  maxFrames?: number;
  maxResolution?: string;
}

export interface FlowCutProvider {
  name: string;
  type: ProviderType;
  capabilities: ProviderCapabilities;
  generate(params: any): Promise<ProviderResult>;
  healthCheck(): Promise<boolean>;
}

export interface ProvidersConfig {
  image: { active: string; [key: string]: any };
  video: { active: string; [key: string]: any };
  tts: { active: string; [key: string]: any };
  interpolation: { active: string; [key: string]: any };
  upscale: { active: string; [key: string]: any };
  llm: { active: string; [key: string]: any };
}
