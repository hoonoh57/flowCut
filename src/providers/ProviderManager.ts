// src/providers/ProviderManager.ts
// Provider 관리자 — 활성 Provider 선택 + 능력 감지 + 체이닝 전략

import type {
  FlowCutProvider,
  ProviderType,
  ProvidersConfig,
  ProviderResult,
  ImageGenerationParams,
  VideoGenerationParams,
  TTSParams,
  InterpolationParams,
  UpscaleParams,
  LLMParams,
} from './types';

type ChainQuality = 'S' | 'A' | 'B' | 'C' | 'D';

interface ChainStrategy {
  clipGenMethod: 'flf2v' | 'extend' | 'i2v-chain' | 't2v-independent';
  blendMethod: 'rife' | 'gmfss' | 'minterpolate' | 'xfade' | 'crossfade';
  qualityGrade: ChainQuality;
}

interface EnvironmentDiagnosis {
  comfyui: boolean;
  ollama: boolean;
  ffmpeg: boolean;
  edgeTts: boolean;
  recommendedGrade: ChainQuality;
}

// Default config when flowcut.providers.json doesn't exist
const DEFAULT_CONFIG: ProvidersConfig = {
  image:         { active: 'comfyui', comfyui: { url: 'http://127.0.0.1:8188', workflow: 'background-scene' } },
  video:         { active: 'comfyui', comfyui: { url: 'http://127.0.0.1:8188', workflow: 'video-i2v' } },
  tts:           { active: 'edge-tts' },
  interpolation: { active: 'ffmpeg', ffmpeg: { method: 'xfade' } },
  upscale:       { active: 'ffmpeg', ffmpeg: { method: 'lanczos' } },
  llm:           { active: 'ollama', ollama: { url: 'http://localhost:11434', model: 'gemma4:e4b' } },
};

export class ProviderManager {
  private config: ProvidersConfig;
  private healthCache: Map<string, boolean> = new Map();

  constructor(config?: ProvidersConfig) {
    this.config = config || DEFAULT_CONFIG;
  }

  getActiveProviderName(type: ProviderType): string {
    return this.config[type]?.active || 'none';
  }

  getProviderConfig(type: ProviderType): Record<string, any> {
    const active = this.getActiveProviderName(type);
    return this.config[type]?.[active] || {};
  }

  // --- Image Generation ---
  async generateImage(params: ImageGenerationParams): Promise<ProviderResult> {
    const active = this.getActiveProviderName('image');
    const cfg = this.getProviderConfig('image');

    if (active === 'comfyui') {
      return this.callServer('/api/comfyui/generate', {
        workflowId: params.workflow || cfg.workflow || 'background-scene',
        positive: params.prompt,
        negative: params.negative,
        width: params.width,
        height: params.height,
        seed: params.seed,
      });
    }
    if (active === 'fal') {
      return this.callExternalAPI(cfg.apiUrl || 'https://fal.run/' + (cfg.model || 'fal-ai/flux-pro/v1.1'), {
        prompt: params.prompt,
        image_size: { width: params.width, height: params.height },
        seed: params.seed,
      }, cfg.apiKey);
    }
    return { success: false, error: 'Unknown image provider: ' + active };
  }

  // --- Video Generation ---
  async generateVideo(params: VideoGenerationParams): Promise<ProviderResult> {
    const active = this.getActiveProviderName('video');
    const cfg = this.getProviderConfig('video');

    if (active === 'comfyui') {
      if (params.startImage && params.endImage) {
        // FLF2V mode
        return this.callServer('/api/comfyui/generate-video', {
          imageLocalPath: params.startImage,
          endImageLocalPath: params.endImage,
          positive: params.prompt,
          negative: params.negative,
          width: params.width,
          height: params.height,
          length: params.frames,
          steps: 30,
          seed: params.seed,
          mode: 'flf2v',
        });
      }
      // Standard I2V
      return this.callServer('/api/comfyui/generate-video', {
        imageLocalPath: params.startImage,
        positive: params.prompt,
        negative: params.negative,
        width: params.width,
        height: params.height,
        length: params.frames,
        steps: 30,
        seed: params.seed,
      });
    }
    if (active === 'fal') {
      return this.callExternalAPI(cfg.apiUrl || 'https://fal.run/' + (cfg.model || 'fal-ai/wan-2.7/image-to-video'), {
        prompt: params.prompt,
        image_url: params.startImage,
        duration: (params.frames / params.fps).toFixed(1),
        seed: params.seed,
      }, cfg.apiKey);
    }
    return { success: false, error: 'Unknown video provider: ' + active };
  }

  // --- TTS ---
  async generateTTS(params: TTSParams): Promise<ProviderResult> {
    const active = this.getActiveProviderName('tts');
    const cfg = this.getProviderConfig('tts');

    if (active === 'edge-tts') {
      return this.callServer('/api/tts/generate', {
        text: params.text,
        language: params.language,
        voice: params.voice,
      });
    }
    if (active === 'xtts-v2') {
      const url = cfg.url || 'http://localhost:8020';
      return this.callExternalAPI(url + '/tts_to_audio/', {
        text: params.text,
        speaker_wav: params.sampleClip,
        language: params.language,
      });
    }
    if (active === 'elevenlabs') {
      return this.callExternalAPI('https://api.elevenlabs.io/v1/text-to-speech/' + (params.voice || 'default'), {
        text: params.text,
        model_id: 'eleven_multilingual_v2',
      }, cfg.apiKey);
    }
    return { success: false, error: 'Unknown TTS provider: ' + active };
  }

  // --- Interpolation ---
  async interpolateFrames(params: InterpolationParams): Promise<ProviderResult> {
    const active = this.getActiveProviderName('interpolation');

    if (active === 'ffmpeg') {
      return this.callServer('/api/interpolate', {
        videoA: params.videoPathA,
        videoB: params.videoPathB,
        overlapFrames: params.overlapFrames,
        method: params.method || 'xfade',
        fps: params.fps,
      });
    }
    if (active === 'comfyui-rife') {
      return this.callServer('/api/comfyui/interpolate', {
        videoA: params.videoPathA,
        videoB: params.videoPathB,
        overlapFrames: params.overlapFrames,
        model: 'rife',
      });
    }
    return { success: false, error: 'Unknown interpolation provider: ' + active };
  }

  // --- Upscale ---
  async upscaleImage(params: UpscaleParams): Promise<ProviderResult> {
    const active = this.getActiveProviderName('upscale');

    if (active === 'ffmpeg') {
      return this.callServer('/api/comfyui/upscale', {
        imageLocalPath: params.imagePath,
        scale: params.scale,
      });
    }
    if (active === 'comfyui') {
      return this.callServer('/api/comfyui/upscale', {
        imageLocalPath: params.imagePath,
        scale: params.scale,
        method: 'realesrgan',
      });
    }
    return { success: false, error: 'Unknown upscale provider: ' + active };
  }

  // --- LLM ---
  async callLLM(params: LLMParams): Promise<ProviderResult> {
    const active = this.getActiveProviderName('llm');
    const cfg = this.getProviderConfig('llm');

    if (active === 'ollama') {
      const url = cfg.url || 'http://localhost:11434';
      const model = cfg.model || 'gemma4:e4b';
      try {
        const resp = await fetch(url + '/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt: params.prompt,
            system: params.system,
            stream: false,
            options: { temperature: params.temperature || 0.7, num_predict: params.maxTokens || 2000 },
          }),
        });
        const data = await resp.json();
        return { success: true, text: data.response || '' };
      } catch (err: any) {
        return { success: false, error: 'Ollama error: ' + err.message };
      }
    }
    if (active === 'openai') {
      try {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.apiKey },
          body: JSON.stringify({
            model: cfg.model || 'gpt-4o',
            messages: [
              ...(params.system ? [{ role: 'system', content: params.system }] : []),
              { role: 'user', content: params.prompt },
            ],
            temperature: params.temperature || 0.7,
            max_tokens: params.maxTokens || 2000,
          }),
        });
        const data = await resp.json();
        return { success: true, text: data.choices?.[0]?.message?.content || '' };
      } catch (err: any) {
        return { success: false, error: 'OpenAI error: ' + err.message };
      }
    }
    return { success: false, error: 'Unknown LLM provider: ' + active };
  }

  // --- Chain Strategy Auto-Selection ---
  selectChainStrategy(): ChainStrategy {
    const video = this.getActiveProviderName('video');
    const interp = this.getActiveProviderName('interpolation');
    const videoCfg = this.getProviderConfig('video');

    let clipGenMethod: ChainStrategy['clipGenMethod'] = 't2v-independent';
    let blendMethod: ChainStrategy['blendMethod'] = 'crossfade';
    let qualityGrade: ChainQuality = 'D';

    // Clip generation method
    if (video === 'comfyui') {
      clipGenMethod = 'flf2v';  // ComfyUI supports FLF2V with Wan2.2
    } else if (video === 'fal' || video === 'runway' || video === 'kling') {
      clipGenMethod = 'i2v-chain';  // Cloud APIs: last-frame chaining
    }

    // Blend method
    if (interp === 'comfyui-rife' || interp === 'comfyui-gmfss') {
      blendMethod = interp === 'comfyui-rife' ? 'rife' : 'gmfss';
    } else if (interp === 'ffmpeg') {
      blendMethod = 'xfade';
    }

    // Quality grade
    if (clipGenMethod === 'flf2v' && blendMethod === 'rife') qualityGrade = 'A';
    else if (clipGenMethod === 'flf2v' && blendMethod === 'xfade') qualityGrade = 'B';
    else if (clipGenMethod === 'i2v-chain' && blendMethod === 'rife') qualityGrade = 'B';
    else if (clipGenMethod === 'i2v-chain' && blendMethod === 'xfade') qualityGrade = 'C';
    else qualityGrade = 'D';

    return { clipGenMethod, blendMethod, qualityGrade };
  }

  // --- Environment Diagnosis ---
  async diagnoseEnvironment(): Promise<EnvironmentDiagnosis> {
    const checks = await Promise.allSettled([
      this.healthCheck('http://127.0.0.1:8188/system_stats'),
      this.healthCheck('http://localhost:11434/api/tags'),
      this.healthCheck('http://localhost:3456/api/health'),
    ]);

    const comfyui = checks[0].status === 'fulfilled' && checks[0].value;
    const ollama = checks[1].status === 'fulfilled' && checks[1].value;
    const ffmpeg = checks[2].status === 'fulfilled' && checks[2].value;

    let grade: ChainQuality = 'D';
    if (comfyui && ffmpeg) grade = 'A';
    else if (comfyui) grade = 'B';
    else if (ffmpeg) grade = 'C';

    return { comfyui, ollama, ffmpeg, edgeTts: true, recommendedGrade: grade };
  }

  // --- Internal Helpers ---
  private async callServer(endpoint: string, body: Record<string, any>): Promise<ProviderResult> {
    try {
      const resp = await fetch('http://localhost:3456' + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return await resp.json();
    } catch (err: any) {
      return { success: false, error: 'Server error: ' + err.message };
    }
  }

  private async callExternalAPI(url: string, body: Record<string, any>, apiKey?: string): Promise<ProviderResult> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = 'Key ' + apiKey;
      const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await resp.json();
      return { success: !data.error, ...data };
    } catch (err: any) {
      return { success: false, error: 'API error: ' + err.message };
    }
  }

  private async healthCheck(url: string): Promise<boolean> {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(3000) });
      return resp.ok;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let _instance: ProviderManager | null = null;

export function getProviderManager(config?: ProvidersConfig): ProviderManager {
  if (!_instance || config) {
    _instance = new ProviderManager(config);
  }
  return _instance;
}
