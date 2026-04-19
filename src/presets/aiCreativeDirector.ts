import type { Clip } from '../types/clip';
import { generateTextViaLLM, getAIBridgeConfig } from './aiTextBridge';

/* ═══════════════════════════════════════════
   AI Creative Director — Analyzes prompts and
   decides what to create: text, image, video,
   composite layout, or combination.
   ═══════════════════════════════════════════ */

export type CreativeAction =
  | 'textOnly'           // Just text with preset
  | 'generateImage'      // ComfyUI image generation
  | 'generateVideo'      // Wan2.2 video generation
  | 'compositeLayout'    // Table/infographic (Canvas)
  | 'imageWithText'      // Image + text overlay
  | 'videoWithText';     // Video + text overlay

export interface CreativePlan {
  action: CreativeAction;
  text?: string;
  presetId?: string;
  workflow?: string;        // workflow template ID
  comfyPrompt?: string;     // positive prompt for ComfyUI
  comfyNegative?: string;
  layoutData?: LayoutData;  // for infographic/table
  width?: number;
  height?: number;
  duration?: number;        // seconds, for video
  steps?: string[];         // human-readable plan description
}

export interface LayoutData {
  type: 'table' | 'comparison' | 'list' | 'timeline' | 'custom';
  title: string;
  columns?: string[];
  rows?: string[][];
  items?: { label: string; value: string; icon?: string }[];
  style?: {
    bgColor?: string;
    textColor?: string;
    accentColor?: string;
    fontSize?: number;
  };
}

const DIRECTOR_SYSTEM_PROMPT = `You are an AI Creative Director for a video editor.
Analyze the user's request and create a detailed production plan.

You MUST respond in valid JSON with this structure:
{
  "action": "textOnly" | "generateImage" | "generateVideo" | "compositeLayout" | "imageWithText" | "videoWithText",
  "text": "generated text content (Korean preferred)",
  "presetId": "text preset ID if text is involved",
  "workflow": "workflow template ID if image/video needed",
  "comfyPrompt": "English prompt for image/video generation",
  "comfyNegative": "negative prompt (optional)",
  "layoutData": { ... } (only for compositeLayout),
  "width": 1920,
  "height": 1080,
  "duration": 5,
  "steps": ["step 1 description", "step 2 description"]
}

AVAILABLE WORKFLOWS:
- "title-card": Photorealistic title card image (SDXL Lightning, fast)
- "background-scene": Artistic background/scene (DreamShaper XL)
- "anime-illustration": Anime/illustration style art (novaAnimeXL)
- "upscale-image": AI upscale existing image (4x-UltraSharp)
- "infographic-layout": Table/chart/infographic (Canvas, instant)

AVAILABLE TEXT PRESETS:
- trending-highlight: RED box, YouTube thumbnails, strong impact
- title-big: Large bold, main titles
- title-neon: Cyan glow, tech/gaming
- title-gold: Gold luxury text
- trending-fire: Orange energy text
- subtitle-classic: Yellow on black subtitles
- aesthetic-handwrite: Cursive vlog style
- lower-news: Professional info bar

DECISION RULES:
- "유튜브 썸네일/인트로" → action: imageWithText, workflow: title-card
- "배경 만들어줘" → action: generateImage, workflow: background-scene
- "비교표/설명자료/테이블" → action: compositeLayout
- "애니메이션/움직이는 영상" → action: generateVideo (note: requires Wan2.2)
- "강한 제목/타이틀만" → action: textOnly
- "인포그래픽" → action: compositeLayout with layoutData
- General image request → action: generateImage

For compositeLayout, provide layoutData with type, title, columns, rows.
For comfyPrompt, write in ENGLISH, be descriptive, include style keywords.
Always include "steps" array explaining what will be created.`;

export async function analyzeAndPlan(userPrompt: string): Promise<CreativePlan> {
  const config = getAIBridgeConfig();
  
  try {
    const resp = await fetch(config.ollamaUrl + '/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        prompt: userPrompt,
        system: DIRECTOR_SYSTEM_PROMPT,
        stream: false,
        options: { temperature: 0.4, num_predict: 1500 },
      }),
      signal: AbortSignal.timeout(config.timeout * 2),
    });

    if (!resp.ok) throw new Error('Ollama HTTP ' + resp.status);
    const data = await resp.json();
    const responseText = data.response || '';

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const plan = JSON.parse(jsonMatch[0]) as CreativePlan;
      // Validate action
      const validActions: CreativeAction[] = [
        'textOnly', 'generateImage', 'generateVideo',
        'compositeLayout', 'imageWithText', 'videoWithText'
      ];
      if (!validActions.includes(plan.action)) plan.action = 'textOnly';
      if (!plan.steps) plan.steps = [plan.action + ' will be executed'];
      return plan;
    }

    // Fallback
    return {
      action: 'textOnly',
      text: responseText.trim() || userPrompt,
      presetId: 'basic-white',
      steps: ['AI could not parse a structured plan, falling back to text-only'],
    };
  } catch (err) {
    console.warn('[AIDirector] Plan generation failed:', err);
    throw err;
  }
}

// Execute ComfyUI workflow
export async function executeComfyWorkflow(
  workflowId: string,
  params: Record<string, any>
): Promise<{ imageUrl?: string; videoUrl?: string; localPath?: string }> {
  const comfyUrl = getAIBridgeConfig().comfyuiUrl;

  // Load workflow template
  const resp = await fetch('/config/workflows/' + workflowId + '.json');
  if (!resp.ok) throw new Error('Workflow not found: ' + workflowId);
  const template = await resp.json();

  if (template.engine === 'canvas') {
    // Canvas-based rendering handled separately
    return { localPath: '' };
  }

  // Deep clone and fill parameters
  const workflow = JSON.parse(JSON.stringify(template.workflow));
  for (const [nodeId, node] of Object.entries(workflow) as any[]) {
    if (node.inputs) {
      for (const [key, val] of Object.entries(node.inputs)) {
        if (typeof val === 'string' && val.startsWith('{{') && val.endsWith('}}')) {
          const paramName = val.slice(2, -2);
          if (params[paramName] !== undefined) {
            node.inputs[key] = params[paramName];
          }
        }
      }
    }
    // Override dimensions if provided
    if (node.class_type === 'EmptyLatentImage') {
      if (params.width) node.inputs.width = params.width;
      if (params.height) node.inputs.height = params.height;
    }
    // Random seed
    if (node.class_type === 'KSampler' && node.inputs.seed === -1) {
      node.inputs.seed = Math.floor(Math.random() * 1e15);
    }
  }

  // Submit to ComfyUI
  const queueResp = await fetch(comfyUrl + '/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  });
  if (!queueResp.ok) throw new Error('ComfyUI queue error: ' + queueResp.status);
  const queueData = await queueResp.json();
  const promptId = queueData.prompt_id;

  // Poll for result
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const histResp = await fetch(comfyUrl + '/history/' + promptId);
      const histData = await histResp.json();
      const entry = histData[promptId];
      if (!entry) continue;

      // Find output images
      for (const [nodeId, output] of Object.entries(entry.outputs || {}) as any[]) {
        if (output.images && output.images.length > 0) {
          const img = output.images[0];
          const imageUrl = comfyUrl + '/view?filename=' + encodeURIComponent(img.filename)
            + '&subfolder=' + encodeURIComponent(img.subfolder || '')
            + '&type=' + (img.type || 'output');
          return { imageUrl };
        }
        if (output.gifs && output.gifs.length > 0) {
          const vid = output.gifs[0];
          const videoUrl = comfyUrl + '/view?filename=' + encodeURIComponent(vid.filename)
            + '&subfolder=' + encodeURIComponent(vid.subfolder || '')
            + '&type=' + (vid.type || 'output');
          return { videoUrl };
        }
      }
    } catch {}
  }

  throw new Error('ComfyUI generation timed out (120s)');
}

// Render infographic/table layout to PNG via Canvas
export function renderInfographic(
  layout: LayoutData,
  width: number = 1920,
  height: number = 1080
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const style = layout.style || {};
  const bgColor = style.bgColor || '#1a1a2e';
  const textColor = style.textColor || '#ffffff';
  const accentColor = style.accentColor || '#3b82f6';
  const fontSize = style.fontSize || 24;

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = accentColor;
  ctx.font = 'bold ' + (fontSize * 1.8) + 'px "Malgun Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(layout.title, width / 2, 80);

  if (layout.type === 'table' && layout.columns && layout.rows) {
    const cols = layout.columns.length;
    const rows = layout.rows.length;
    const tableW = width * 0.85;
    const tableH = height * 0.7;
    const startX = (width - tableW) / 2;
    const startY = 120;
    const cellW = tableW / cols;
    const cellH = tableH / (rows + 1);

    // Header row
    ctx.fillStyle = accentColor + '44';
    ctx.fillRect(startX, startY, tableW, cellH);
    ctx.fillStyle = accentColor;
    ctx.font = 'bold ' + fontSize + 'px "Malgun Gothic", sans-serif';
    for (let c = 0; c < cols; c++) {
      ctx.textAlign = 'center';
      ctx.fillText(layout.columns[c], startX + cellW * c + cellW / 2, startY + cellH / 2 + fontSize / 3);
    }

    // Data rows
    ctx.font = fontSize + 'px "Malgun Gothic", sans-serif';
    for (let r = 0; r < rows; r++) {
      const y = startY + cellH * (r + 1);
      // Alternating row bg
      if (r % 2 === 0) {
        ctx.fillStyle = '#ffffff08';
        ctx.fillRect(startX, y, tableW, cellH);
      }
      ctx.fillStyle = textColor;
      for (let c = 0; c < cols; c++) {
        const text = layout.rows[r]?.[c] || '';
        ctx.textAlign = 'center';
        ctx.fillText(text, startX + cellW * c + cellW / 2, y + cellH / 2 + fontSize / 3);
      }
    }

    // Grid lines
    ctx.strokeStyle = '#ffffff22';
    ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(startX + cellW * c, startY);
      ctx.lineTo(startX + cellW * c, startY + cellH * (rows + 1));
      ctx.stroke();
    }
    for (let r = 0; r <= rows + 1; r++) {
      ctx.beginPath();
      ctx.moveTo(startX, startY + cellH * r);
      ctx.lineTo(startX + tableW, startY + cellH * r);
      ctx.stroke();
    }
  } else if (layout.type === 'comparison' && layout.items) {
    const items = layout.items;
    const cardW = (width * 0.85) / items.length;
    const startX = (width - cardW * items.length) / 2;
    const startY = 140;
    const cardH = height - startY - 60;

    for (let i = 0; i < items.length; i++) {
      const x = startX + cardW * i + 10;
      const w = cardW - 20;

      // Card bg
      ctx.fillStyle = '#ffffff0a';
      ctx.beginPath();
      ctx.roundRect(x, startY, w, cardH, 12);
      ctx.fill();

      // Card border
      ctx.strokeStyle = accentColor + '66';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, startY, w, cardH, 12);
      ctx.stroke();

      // Label
      ctx.fillStyle = accentColor;
      ctx.font = 'bold ' + (fontSize * 1.2) + 'px "Malgun Gothic", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(items[i].label, x + w / 2, startY + 50);

      // Value
      ctx.fillStyle = textColor;
      ctx.font = fontSize + 'px "Malgun Gothic", sans-serif';
      const words = items[i].value.split(' ');
      let lineY = startY + 100;
      let line = '';
      for (const word of words) {
        const test = line + word + ' ';
        if (ctx.measureText(test).width > w - 30 && line) {
          ctx.fillText(line.trim(), x + w / 2, lineY);
          line = word + ' ';
          lineY += fontSize * 1.4;
        } else {
          line = test;
        }
      }
      if (line.trim()) ctx.fillText(line.trim(), x + w / 2, lineY);
    }
  } else if (layout.type === 'list' && layout.items) {
    const startX = width * 0.1;
    let y = 140;
    ctx.textAlign = 'left';

    for (let i = 0; i < layout.items.length; i++) {
      // Bullet
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(startX + 12, y + fontSize / 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px "Malgun Gothic"';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), startX + 12, y + fontSize / 2 + 5);

      // Label
      ctx.fillStyle = textColor;
      ctx.font = 'bold ' + fontSize + 'px "Malgun Gothic", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(layout.items[i].label, startX + 40, y + fontSize);

      // Value
      ctx.fillStyle = textColor + 'bb';
      ctx.font = (fontSize * 0.85) + 'px "Malgun Gothic", sans-serif';
      ctx.fillText(layout.items[i].value, startX + 40, y + fontSize * 2.2);

      y += fontSize * 3.5;
    }
  }

  return canvas;
}
