// src/scripting/WorldContext.ts
// World Context — 프롬프트 빌더 + 일관성 주입

export interface WorldCharacter {
  name: string;
  description: string;
  face?: string;
  body?: string;
  wardrobeDefault?: string;
  wardrobeVariations?: Record<string, string>;
  personality?: string;
  faceRef?: string | null;
  bodyRef?: string | null;
  voice?: {
    engine?: string;
    preset?: string;
    sampleClip?: string | null;
    style?: { speed?: number; pitch?: string; tone?: string; emotion?: string };
    language?: string;
  };
  motion?: {
    style?: string;
    gait?: string;
    defaultPose?: string;
  };
  generation?: {
    seed?: number;
    model?: string;
    workflow?: string;
  };
}

export interface WorldLocation {
  name: string;
  type?: string;
  description: string;
  props?: string[];
  lighting?: string;
  ambience?: string;
  ref?: string | null;
}

export interface WorldProp {
  description: string;
  recurring?: boolean;
}

export interface WorldVisualStyle {
  look?: string;
  colorPalette?: string;
  colorGrading?: string;
  lighting?: string;
}

export interface WorldContinuity {
  strategy?: string;
  overlapFrames?: number;
  overlapBlend?: string;
  seedBase?: number;
  seedStrategy?: string;
  keyframePreGenerate?: boolean;
  colorNormalize?: boolean;
  qualityTarget?: string;
}

export interface WorldMotion {
  label: string;
  description: string;
  refVideo?: string;
  duration?: number;
  tags?: string[];
}

export interface WorldMotionLibrary {
  categories?: Record<string, { label: string; motions: Record<string, WorldMotion> }>;
  custom?: Record<string, WorldMotion>;
}

export interface FlowScriptWorld {
  title?: string;
  genre?: string;
  era?: string;
  tone?: string;
  visualStyle?: WorldVisualStyle;
  characters?: Record<string, WorldCharacter>;
  locations?: Record<string, WorldLocation>;
  props?: Record<string, WorldProp>;
  motionLibrary?: WorldMotionLibrary;
  continuity?: WorldContinuity;
}

// --- Scene context for prompt building ---
export interface SceneContext {
  action: string;
  characters?: string[];
  location?: string;
  props?: string[];
  wardrobe?: Record<string, string>;
  motion?: Record<string, string>;
  emotion?: Record<string, string>;
  styleOverride?: Partial<WorldVisualStyle>;
}

export interface BuiltPrompt {
  positive: string;
  negative: string;
  characterRefs: string[];
  locationRef: string | null;
  motionRefs: string[];
  voiceMap: Record<string, { engine: string; preset?: string; sampleClip?: string | null; language: string }>;
  seeds: Record<string, number>;
}

// --- Negative prompt templates by scene type ---
const NEGATIVE_BASE = 'blurry, ugly, deformed, low quality, JPEG artifacts, watermark, text, banner';
const NEGATIVE_PERSON = 'deformed face, extra fingers, mutated hands, bad anatomy, disfigured';
const NEGATIVE_LANDSCAPE = 'people, person, human, text overlay';

function detectSceneType(action: string, characters?: string[]): 'person' | 'landscape' | 'general' {
  if (characters && characters.length > 0) return 'person';
  const lc = action.toLowerCase();
  if (lc.includes('scenery') || lc.includes('landscape') || lc.includes('sunset') || lc.includes('mountain') || lc.includes('ocean')) return 'landscape';
  return 'general';
}

function buildNegativePrompt(world: FlowScriptWorld, sceneType: 'person' | 'landscape' | 'general'): string {
  const parts = [NEGATIVE_BASE];
  if (sceneType === 'person') parts.push(NEGATIVE_PERSON);
  if (sceneType === 'landscape') parts.push(NEGATIVE_LANDSCAPE);

  // Era-based anachronism prevention
  if (world.era) {
    const era = world.era.toLowerCase();
    if (era.includes('modern') || era.includes('contemporary') || era.includes('2020') || era.includes('2025') || era.includes('2026')) {
      parts.push('medieval, ancient, futuristic, sci-fi armor');
    } else if (era.includes('medieval') || era.includes('ancient') || era.includes('joseon')) {
      parts.push('modern clothing, smartphone, car, computer, neon');
    } else if (era.includes('future') || era.includes('sci-fi') || era.includes('cyberpunk')) {
      parts.push('ancient, medieval, horse carriage, traditional');
    }
  }
  return parts.join(', ');
}

// --- Main prompt builder ---
export function buildScenePrompt(scene: SceneContext, world: FlowScriptWorld): BuiltPrompt {
  const positiveParts: string[] = [];
  const characterRefs: string[] = [];
  const motionRefs: string[] = [];
  const voiceMap: Record<string, any> = {};
  const seeds: Record<string, number> = {};

  // 1. Action (user's core intent)
  positiveParts.push(scene.action);

  // 2. Characters
  if (scene.characters && world.characters) {
    for (const cid of scene.characters) {
      const char = world.characters[cid];
      if (!char) continue;

      // Appearance
      const descParts: string[] = [];
      if (char.description) descParts.push(char.description);
      if (char.face) descParts.push(char.face);

      // Wardrobe (scene override > variation > default)
      const wardrobeKey = scene.wardrobe?.[cid];
      let wardrobe = char.wardrobeDefault || '';
      if (wardrobeKey && char.wardrobeVariations?.[wardrobeKey]) {
        wardrobe = char.wardrobeVariations[wardrobeKey];
      }
      if (wardrobe) descParts.push('wearing ' + wardrobe);

      // Emotion
      const emotion = scene.emotion?.[cid];
      if (emotion) descParts.push(emotion + ' expression');

      positiveParts.push(descParts.join(', '));

      // Face reference
      if (char.faceRef) characterRefs.push(char.faceRef);

      // Voice mapping
      if (char.voice) {
        voiceMap[cid] = {
          engine: char.voice.engine || 'edge-tts',
          preset: char.voice.preset,
          sampleClip: char.voice.sampleClip,
          language: char.voice.language || 'ko',
        };
      }

      // Seed
      if (char.generation?.seed) seeds[cid] = char.generation.seed;

      // Motion
      const motionKey = scene.motion?.[cid];
      if (motionKey) {
        const motionDesc = resolveMotion(motionKey, world.motionLibrary);
        if (motionDesc.description) positiveParts.push(motionDesc.description);
        if (motionDesc.refVideo) motionRefs.push(motionDesc.refVideo);
      } else if (char.motion?.style) {
        positiveParts.push(char.motion.style);
      }
    }
  }

  // 3. Location
  let locationRef: string | null = null;
  if (scene.location && world.locations) {
    const loc = world.locations[scene.location];
    if (loc) {
      positiveParts.push(loc.description);
      if (loc.lighting) positiveParts.push(loc.lighting);
      if (loc.ref) locationRef = loc.ref;
    }
  }

  // 4. Props
  if (scene.props && world.props) {
    const propDescs = scene.props
      .map(pid => world.props?.[pid]?.description)
      .filter(Boolean) as string[];
    if (propDescs.length > 0) positiveParts.push(propDescs.join(', '));
  }

  // 5. Visual style (with override)
  const style = { ...world.visualStyle, ...scene.styleOverride };
  if (style?.look) positiveParts.push(style.look);
  if (style?.colorGrading) positiveParts.push(style.colorGrading);
  if (style?.lighting) positiveParts.push(style.lighting);

  // 6. Tone
  if (world.tone) positiveParts.push(world.tone);

  // Build final
  const sceneType = detectSceneType(scene.action, scene.characters);
  const positive = positiveParts.filter(Boolean).join(', ');
  const negative = buildNegativePrompt(world, sceneType);

  return { positive, negative, characterRefs, locationRef, motionRefs, voiceMap, seeds };
}

// --- Motion resolver ---
function resolveMotion(key: string, library?: WorldMotionLibrary): { description: string; refVideo?: string } {
  if (!library) return { description: '' };

  // Search in categories
  if (library.categories) {
    for (const cat of Object.values(library.categories)) {
      if (cat.motions[key]) {
        return {
          description: cat.motions[key].description,
          refVideo: cat.motions[key].refVideo,
        };
      }
    }
  }

  // Search in custom
  if (library.custom?.[key]) {
    return {
      description: library.custom[key].description,
      refVideo: library.custom[key].refVideo,
    };
  }

  // Key not found — use as literal description
  return { description: key };
}

// --- Utility: Merge world into a FlowScript's media prompts ---
export function injectWorldContext(
  script: any,
  world: FlowScriptWorld
): any {
  if (!world || !script) return script;

  // If screenplay exists, convert to standard FlowScript with world injection
  if (script.screenplay && Array.isArray(script.screenplay)) {
    for (const scene of script.screenplay) {
      const ctx: SceneContext = {
        action: scene.action || scene.description || '',
        characters: scene.characters,
        location: scene.location,
        props: scene.props,
        wardrobe: scene.characterState
          ? Object.fromEntries(
              Object.entries(scene.characterState).map(([k, v]: [string, any]) => [k, v.wardrobe || 'default'])
            )
          : undefined,
        motion: scene.characterState
          ? Object.fromEntries(
              Object.entries(scene.characterState)
                .filter(([_, v]: [string, any]) => v.motion)
                .map(([k, v]: [string, any]) => [k, v.motion])
            )
          : undefined,
        emotion: scene.characterState
          ? Object.fromEntries(
              Object.entries(scene.characterState)
                .filter(([_, v]: [string, any]) => v.emotion)
                .map(([k, v]: [string, any]) => [k, v.emotion])
            )
          : undefined,
        styleOverride: scene.override?.style,
      };

      const built = buildScenePrompt(ctx, world);
      scene._enhancedPrompt = built.positive;
      scene._negativePrompt = built.negative;
      scene._characterRefs = built.characterRefs;
      scene._locationRef = built.locationRef;
      scene._motionRefs = built.motionRefs;
      scene._voiceMap = built.voiceMap;
      scene._seeds = built.seeds;
    }
  }

  // Inject into media items that use ai:// source
  if (script.media && Array.isArray(script.media)) {
    for (const media of script.media) {
      if (media.src?.startsWith('ai://') && !media._worldInjected) {
        const rawPrompt = media.aiPrompt || media.src.replace('ai://', '');
        // Build scene context with ALL world characters and locations
        const allCharIds = world.characters ? Object.keys(world.characters) : [];
        const firstLocId = world.locations ? Object.keys(world.locations)[0] : undefined;
        const ctx: SceneContext = { action: rawPrompt, characters: allCharIds.length > 0 ? allCharIds : undefined, location: firstLocId };
        const built = buildScenePrompt(ctx, world);
        media.aiPrompt = built.positive;
        media._negative = built.negative;
        media._characterRefs = built.characterRefs;
        media._seeds = built.seeds;
        media._worldInjected = true;
      }
    }
  }

  return script;
}
