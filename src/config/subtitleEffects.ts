// FlowCut Subtitle Effects System
// Each effect is modular and can be applied per-clip, per-sentence, or per-word

export interface SubtitleWordEffect {
  name: string;
  description: string;
  // ASS override tags to apply
  assTags: {
    before?: string;   // tags before the word
    after?: string;    // tags after the word (reset)
    highlight?: string; // tags during karaoke highlight
  };
  // Timing adjustments
  timing?: {
    delayMs?: number;    // delay before this word
    extendMs?: number;   // extend duration
    accel?: number;      // animation acceleration (1=linear)
  };
}

export interface SubtitleStyle {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  category: 'basic' | 'karaoke' | 'cinematic' | 'shortform' | 'webtoon';
  
  // ASS Style properties
  fontName: string;
  fontSize: number;          // relative to 1080p (auto-scaled)
  primaryColor: string;      // ASS hex &HBBGGRR&
  secondaryColor: string;    // karaoke pre-highlight
  outlineColor: string;
  shadowColor: string;
  bold: boolean;
  italic: boolean;
  outlineWidth: number;
  shadowDepth: number;
  alignment: number;         // numpad position (1-9)
  marginL: number;
  marginR: number;
  marginV: number;           // vertical margin from edge
  
  // Background box
  backgroundBox: boolean;
  boxColor?: string;
  boxAlpha?: string;         // hex 00=opaque, FF=invisible
  boxPadding?: number;
  
  // Effects
  effects: {
    karaoke: 'none' | 'fill' | 'sweep' | 'outline';  // \k, \kf, \ko
    fadeIn: number;           // ms
    fadeOut: number;          // ms
    blur: number;             // edge blur strength
    wordAnimation?: 'none' | 'pop' | 'bounce' | 'typewriter' | 'slide';
    emphasisWords?: string[]; // words to emphasize (bigger/different color)
    emphasisColor?: string;
    emphasisScale?: number;   // percentage, e.g. 130
  };
  
  // Per-word overrides (advanced)
  wordOverrides?: Record<string, SubtitleWordEffect>;
}

export interface SubtitleConfig {
  defaultStyleId: string;
  styles: SubtitleStyle[];
  globalSettings: {
    maxCharsPerLine: number;
    maxLinesVisible: number;
    chunkMode: 'sentence' | 'phrase' | 'word-group';
    wordsPerChunk: number;    // for word-group mode
    lineSpacing: number;
  };
}

// ============ PRESET STYLES ============

export const SUBTITLE_PRESETS: SubtitleStyle[] = [
  // 1. Clean Default
  {
    id: 'clean',
    name: 'Clean',
    nameKo: '기본',
    description: 'Clean white text with outline, no animation',
    category: 'basic',
    fontName: 'Noto Sans KR',
    fontSize: 48,
    primaryColor: '&H00FFFFFF&',
    secondaryColor: '&H0000FFFF&',
    outlineColor: '&H00000000&',
    shadowColor: '&H80000000&',
    bold: true,
    italic: false,
    outlineWidth: 3,
    shadowDepth: 1,
    alignment: 2,
    marginL: 40,
    marginR: 40,
    marginV: 60,
    backgroundBox: false,
    effects: {
      karaoke: 'none',
      fadeIn: 200,
      fadeOut: 200,
      blur: 0,
    }
  },
  
  // 2. Karaoke Highlight (current default)
  {
    id: 'karaoke',
    name: 'Karaoke Highlight',
    nameKo: '카라오케',
    description: 'Word-by-word highlight sweep like karaoke',
    category: 'karaoke',
    fontName: 'Noto Sans KR',
    fontSize: 48,
    primaryColor: '&H0000D4FF&',    // yellow-orange highlight
    secondaryColor: '&H00FFFFFF&',   // white pre-highlight
    outlineColor: '&H00000000&',
    shadowColor: '&H80000000&',
    bold: true,
    italic: false,
    outlineWidth: 3,
    shadowDepth: 2,
    alignment: 2,
    marginL: 40,
    marginR: 40,
    marginV: 60,
    backgroundBox: false,
    effects: {
      karaoke: 'sweep',
      fadeIn: 150,
      fadeOut: 150,
      blur: 0.5,
    }
  },
  
  // 3. Background Pill (Netflix/YouTube style)
  {
    id: 'pill',
    name: 'Background Pill',
    nameKo: '배경 박스',
    description: 'Text with semi-transparent rounded background',
    category: 'cinematic',
    fontName: 'Noto Sans KR',
    fontSize: 44,
    primaryColor: '&H00FFFFFF&',
    secondaryColor: '&H0000FFFF&',
    outlineColor: '&H00000000&',
    shadowColor: '&H00000000&',
    bold: true,
    italic: false,
    outlineWidth: 0,
    shadowDepth: 0,
    alignment: 2,
    marginL: 40,
    marginR: 40,
    marginV: 60,
    backgroundBox: true,
    boxColor: '&H00000000&',
    boxAlpha: 'A0',
    boxPadding: 15,
    effects: {
      karaoke: 'none',
      fadeIn: 200,
      fadeOut: 200,
      blur: 0,
    }
  },
  
  // 4. Pop Emphasis (TikTok/Shorts style)
  {
    id: 'pop',
    name: 'Pop Emphasis',
    nameKo: '팝 강조',
    description: 'Words pop in with scale animation, key words emphasized',
    category: 'shortform',
    fontName: 'Noto Sans KR',
    fontSize: 52,
    primaryColor: '&H00FFFFFF&',
    secondaryColor: '&H0000FFFF&',
    outlineColor: '&H00000000&',
    shadowColor: '&H40000000&',
    bold: true,
    italic: false,
    outlineWidth: 4,
    shadowDepth: 3,
    alignment: 5,
    marginL: 80,
    marginR: 80,
    marginV: 0,
    backgroundBox: false,
    effects: {
      karaoke: 'fill',
      fadeIn: 0,
      fadeOut: 100,
      blur: 0.3,
      wordAnimation: 'pop',
      emphasisColor: '&H0000D4FF&',
      emphasisScale: 130,
    }
  },
  
  // 5. Webtoon Drama (화산귀환 style)
  {
    id: 'webtoon',
    name: 'Webtoon Drama',
    nameKo: '웹툰 드라마',
    description: 'Bold dramatic text with color emphasis and bounce',
    category: 'webtoon',
    fontName: 'Noto Sans KR',
    fontSize: 56,
    primaryColor: '&H00FFFFFF&',
    secondaryColor: '&H000055FF&',
    outlineColor: '&H00000000&',
    shadowColor: '&H60000000&',
    bold: true,
    italic: false,
    outlineWidth: 4,
    shadowDepth: 4,
    alignment: 2,
    marginL: 60,
    marginR: 60,
    marginV: 80,
    backgroundBox: false,
    effects: {
      karaoke: 'sweep',
      fadeIn: 0,
      fadeOut: 100,
      blur: 0.5,
      wordAnimation: 'bounce',
      emphasisColor: '&H0000CCFF&',
      emphasisScale: 140,
    }
  },
  
  // 6. Typewriter
  {
    id: 'typewriter',
    name: 'Typewriter',
    nameKo: '타자기',
    description: 'Text appears letter by letter like typing',
    category: 'cinematic',
    fontName: 'Noto Sans KR',
    fontSize: 42,
    primaryColor: '&H0000FFFF&',
    secondaryColor: '&H00FFFFFF&',
    outlineColor: '&H00000000&',
    shadowColor: '&H60000000&',
    bold: false,
    italic: false,
    outlineWidth: 2,
    shadowDepth: 1,
    alignment: 2,
    marginL: 40,
    marginR: 40,
    marginV: 60,
    backgroundBox: false,
    effects: {
      karaoke: 'fill',
      fadeIn: 0,
      fadeOut: 300,
      blur: 0,
      wordAnimation: 'typewriter',
    }
  },
  
  // 7. Cinematic Bottom Bar
  {
    id: 'cinematic',
    name: 'Cinematic',
    nameKo: '시네마틱',
    description: 'Film-style subtitles with elegant fade',
    category: 'cinematic',
    fontName: 'Noto Sans KR',
    fontSize: 40,
    primaryColor: '&H00FFFFFF&',
    secondaryColor: '&H0000FFFF&',
    outlineColor: '&H40000000&',
    shadowColor: '&H80000000&',
    bold: false,
    italic: false,
    outlineWidth: 2,
    shadowDepth: 2,
    alignment: 2,
    marginL: 120,
    marginR: 120,
    marginV: 50,
    backgroundBox: false,
    effects: {
      karaoke: 'none',
      fadeIn: 500,
      fadeOut: 500,
      blur: 0.8,
    }
  },
  
  // 8. Center Impact (shorts emphasis)
  {
    id: 'impact',
    name: 'Center Impact',
    nameKo: '센터 임팩트',
    description: 'Large center text, 3-5 word chunks, high impact',
    category: 'shortform',
    fontName: 'Noto Sans KR',
    fontSize: 64,
    primaryColor: '&H00FFFFFF&',
    secondaryColor: '&H000000FF&',
    outlineColor: '&H00000000&',
    shadowColor: '&H00000000&',
    bold: true,
    italic: false,
    outlineWidth: 5,
    shadowDepth: 0,
    alignment: 5,
    marginL: 100,
    marginR: 100,
    marginV: 0,
    backgroundBox: false,
    effects: {
      karaoke: 'fill',
      fadeIn: 0,
      fadeOut: 0,
      blur: 0,
      wordAnimation: 'pop',
      emphasisColor: '&H0000CCFF&',
      emphasisScale: 150,
    }
  },
];

export const DEFAULT_SUBTITLE_CONFIG: SubtitleConfig = {
  defaultStyleId: 'karaoke',
  styles: SUBTITLE_PRESETS,
  globalSettings: {
    maxCharsPerLine: 25,
    maxLinesVisible: 2,
    chunkMode: 'sentence',
    wordsPerChunk: 5,
    lineSpacing: 10,
  },
};

// ============ NATURAL LANGUAGE MAPPING ============
// Used by ScriptEngine to auto-select style from prompt
export const STYLE_KEYWORDS: Record<string, string[]> = {
  'clean':      ['깔끔', 'clean', '심플', 'simple', '기본', 'default', 'plain'],
  'karaoke':    ['카라오케', 'karaoke', '노래방', '하이라이트', 'highlight', '단어별'],
  'pill':       ['배경', 'background', 'box', '박스', 'pill', 'netflix', '넷플릭스'],
  'pop':        ['팝', 'pop', 'tiktok', '틱톡', 'shorts', '숏츠', '강조', 'emphasis'],
  'webtoon':    ['웹툰', 'webtoon', '드라마', 'drama', '화산귀환', '액션', 'action', '역동'],
  'typewriter': ['타자기', 'typewriter', '타이핑', 'typing', '느린'],
  'cinematic':  ['시네마틱', 'cinematic', '영화', 'film', 'movie', '우아', 'elegant'],
  'impact':     ['임팩트', 'impact', '크게', 'big', 'bold', '굵게', '센터', 'center'],
};