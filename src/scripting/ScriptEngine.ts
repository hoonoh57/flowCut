import type { FlowScript, FlowScriptAction, FlowScriptClip, FlowScriptMedia, FlowScriptTrack } from "./flowscript.schema";
import { DEFAULT_PROJECT } from '../types/project';
import { useEditorStore } from "../stores/editorStore";
import { createDefaultClip } from "../types/clip";
import { uid } from "../utils/uid";
import { AddClipCommand } from "../stores/commands/AddClipCommand";
import { DeleteClipCommand } from "../stores/commands/DeleteClipCommand";
import { SplitClipCommand } from "../stores/commands/SplitClipCommand";
import { AddTrackCommand } from "../stores/commands/AddTrackCommand";
import type { Track } from "../types/track";
import { injectWorldContext } from "./WorldContext";
import type { FlowScriptWorld } from "./flowscript.schema";
import { resolveCharacterRefs } from "../registry/CharacterRegistry";
import { enhanceWithCinematic } from "./PromptEnhancer";

export interface ScriptResult {
  success: boolean;
  log: string[];
  errors: string[];
  clipIds: string[];
  duration: number;
}


function normalizeScript(script: any): any {
  // Unwrap if nested in { flowScript: { ... } }
  if (script.flowScript && !script.version) script = script.flowScript;

  // World Context: inject before any processing
  if (script.world) {
    // Resolve character \ from registry
    if (script.world.characters) {
      script.world.characters = resolveCharacterRefs(script.world.characters);
    }
    script = injectWorldContext(script, script.world as FlowScriptWorld);
    // Enhance AI prompts with cinematic keywords
    if (script.media) {
      for (const m of script.media) {
        if ((m as any)._worldInjected && m.aiPrompt) {
          const enhanced = enhanceWithCinematic(m.aiPrompt);
          m.aiPrompt = enhanced.enhanced;
          if (!m._negative) (m as any)._negative = enhanced.negative;
        }
      }
    }
    if (script.media) { for (const m of script.media) { if ((m as any)._worldInjected) console.log('[WorldContext] aiPrompt:', ((m as any).aiPrompt || '').substring(0, 120)); } }
  }

  const fps = script.project?.fps || DEFAULT_PROJECT.fps;
  const totalFrames = fps * 30;

  // Fix project resolution
  if (!script.project) script.project = {};
  if (!script.project.width && script.project.resolution) {
    const parts = script.project.resolution.split("x");
    script.project.width = parseInt(parts[0]) || DEFAULT_PROJECT.width;
    script.project.height = parseInt(parts[1]) || DEFAULT_PROJECT.height;
  }
  if (!script.project.width) script.project.width = DEFAULT_PROJECT.width;
  if (!script.project.height) script.project.height = DEFAULT_PROJECT.height;
  if (!script.project.fps) script.project.fps = DEFAULT_PROJECT.fps;
  const pw = script.project.width;
  const ph = script.project.height;

  // Fix media: normalize id, src, type
  if (script.media && Array.isArray(script.media)) {
    for (const m of script.media) {
      if (!m.id && m.mediaId) m.id = m.mediaId;
      if (!m.src && m.prompt) m.src = m.prompt.startsWith("ai://") ? m.prompt : "ai://" + m.prompt;
      if (!m.src && m.aiPrompt) m.src = "ai://" + m.aiPrompt;
      if (!m.type) m.type = "image";
      if (!m.aiWorkflow && m.src && m.src.startsWith("ai://")) m.aiWorkflow = "background-scene";
      // Remove audio that tries AI generation
      if (m.type === "audio" && m.src && m.src.startsWith("ai://")) m._skip = true;
    }
    script.media = script.media.filter((m: any) => !m._skip);
  }

  // Extract clips from nested tracks[].clips[] if top-level clips is missing/empty
  if ((!script.clips || script.clips.length === 0) && script.tracks) {
    script.clips = [];
    for (const track of script.tracks) {
      if (track.clips && Array.isArray(track.clips)) {
        const trackType = track.type || "video";
        const trackId = track.id || (trackType === "video" ? "v1" : trackType === "text" ? "t1" : "a1");
        if (!track.id) track.id = trackId;
        for (const clip of track.clips) {
          // Determine clip type
          let clipType = clip.type || trackType;
          if (clipType === "video" && clip.text) clipType = "text";
          if (clipType === "video" && clip.mediaId) {
            const media = (script.media || []).find((m: any) => m.id === clip.mediaId);
            if (media && media.type === "image") clipType = "image";
          }

          // Normalize frame numbers
          let startFrame = clip.startFrame ?? clip.start ?? 0;
          let durationFrames = clip.durationFrames ?? clip.duration ?? 0;
          if (!durationFrames && clip.endFrame != null) durationFrames = clip.endFrame - startFrame;
          if (!durationFrames && clip.end != null) durationFrames = clip.end - startFrame;
          if (!durationFrames) durationFrames = 225;

          script.clips.push({
            ...clip,
            type: clipType,
            trackId: trackId,
            startFrame: startFrame,
            durationFrames: durationFrames,
            width: clip.width || (clipType === "text" ? pw : pw),
            height: clip.height || (clipType === "text" ? 200 : ph),
            textStyle: clip.textStyle || (clip.fontSize ? { fontSize: clip.fontSize, fontColor: clip.color || clip.fontColor || "#ffffff" } : undefined),
          });
        }
        // Remove clips from track object
        delete track.clips;
      }
    }
  }

  // Ensure tracks have id fields
  if (script.tracks) {
    let vi = 1, ai = 1, ti = 1;
    for (const t of script.tracks) {
      if (!t.id) {
        t.id = t.type === "video" ? "v" + (vi++) : t.type === "audio" ? "a" + (ai++) : "t" + (ti++);
      }
    }
  }

  // Fix clip types based on media
  const imgIds = new Set((script.media || []).filter((m: any) => m.type === "image").map((m: any) => m.id));
  const validMediaIds = new Set((script.media || []).map((m: any) => m.id));
  if (script.clips) {
    for (const c of script.clips) {
      if (c.type === "video" && c.mediaId && imgIds.has(c.mediaId)) c.type = "image";

      if (c.type === "audio" && c.mediaId && !validMediaIds.has(c.mediaId)) c._skip = true;
      // Auto-detect video clips by mediaId or src extension
      if (c.type === "image" && (c.mediaId?.endsWith("_video") || (c.src || "").endsWith(".mp4"))) c.type = "video";
      if (!c.width) c.width = c.type === "text" ? pw : pw;
      if (!c.height) c.height = c.type === "text" ? 200 : ph;
    }
    script.clips = script.clips.filter((c: any) => !c._skip);
  }

  // If still too few image clips, expand
  const imageMedia = (script.media || []).filter((m: any) => m.type === "image" && m.src?.startsWith("ai://"));
  const imageClips = (script.clips || []).filter((c: any) => c.type === "image");
  if (imageMedia.length >= 2 && imageClips.length <= 1) {
    // Create clips from media that aren't referenced
    const usedIds = new Set(imageClips.map((c: any) => c.mediaId));
    const vTrack = (script.tracks || []).find((t: any) => t.type === "video")?.id || "v1";
    let nextStart = imageClips.length > 0 ? Math.max(...imageClips.map((c: any) => c.startFrame + c.durationFrames)) : 0;
    const framesEach = Math.floor(totalFrames / imageMedia.length);
    
    // Redistribute all image clips evenly
    script.clips = script.clips.filter((c: any) => c.type !== "image");
    for (let i = 0; i < imageMedia.length; i++) {
      script.clips.push({
        type: "image", mediaId: imageMedia[i].id, trackId: vTrack,
        startFrame: i * framesEach, durationFrames: framesEach,
        width: pw, height: ph, fadeIn: 10, fadeOut: 10
      });
    }
  }

  return script;
}

export class ScriptEngine {
  private log: string[] = [];
  private _startTime: number = Date.now();
  private _lastStepTime: number = Date.now();

  private logT(msg: string): void {
    const now = Date.now();
    const elapsed = ((now - this._startTime) / 1000).toFixed(1);
    const stepTime = ((now - this._lastStepTime) / 1000).toFixed(1);
    const timeStr = new Date(now).toLocaleTimeString('ko-KR', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.log.push(`[${timeStr}] (+${elapsed}s, step ${stepTime}s) ${msg}`);
    console.log(`[${timeStr}] (+${elapsed}s, step ${stepTime}s) ${msg}`);
    this._lastStepTime = now;
  }
  private errors: string[] = [];
  private clipIdMap: Map<string, string> = new Map();
  private mediaIdMap: Map<string, string> = new Map();

  async execute(script: FlowScript): Promise<ScriptResult> {
    const start = Date.now();
    this._startTime = start;
    this._lastStepTime = start;
    this.log = []; this.errors = []; this.clipIdMap = new Map();
    script = normalizeScript(script) as FlowScript;
    this.logT("[Normalize] Script expanded: " + (script.media?.length || 0) + " media, " + (script.clips?.length || 0) + " clips");
    this.logT("[ScriptEngine] Starting FlowScript v" + script.version);
    try {
      this.logT("[DEBUG] script keys: " + Object.keys(script).join(", "));
      (this as any)._scriptData = script; // Store script data for TTS startFrame calculation
      (this as any)._subtitleSegments = []; // Collect subtitle segments from TTS
      this.logT("[DEBUG] media: " + (script.media ? "array(" + (Array.isArray(script.media) ? script.media.length : typeof script.media) + ")" : "undefined"));
      this.logT("[DEBUG] tracks: " + (script.tracks ? "array(" + (Array.isArray(script.tracks) ? script.tracks.length : typeof script.tracks) + ")" : "undefined"));
      this.logT("[DEBUG] clips: " + (script.clips ? "array(" + (Array.isArray(script.clips) ? script.clips.length : typeof script.clips) + ")" : "undefined"));
      this.logT("[DEBUG] actions: " + (script.actions ? "array(" + (Array.isArray(script.actions) ? script.actions.length : typeof script.actions) + ")" : "undefined"));
      try { this.setupProject(script); this.logT("[DEBUG] setupProject OK"); } catch(e: any) { this.errors.push("[setupProject] " + e.message); return { success: false, log: this.log, errors: this.errors, clipIds: [], duration: Date.now() - start }; }
      try { if (script.media && Array.isArray(script.media)) { this.logT("[DEBUG] importing " + script.media.length + " media..."); await this.importMedia(script.media); this.logT("[DEBUG] importMedia OK"); } } catch(e: any) { this.errors.push("[importMedia] " + e.message + " | stack: " + (e.stack || "").split("\n")[1]); }
      try { if (script.tracks && Array.isArray(script.tracks)) { this.logT("[DEBUG] creating " + script.tracks.length + " tracks..."); this.createTracks(script.tracks); this.logT("[DEBUG] createTracks OK"); } } catch(e: any) { this.errors.push("[createTracks] " + e.message + " | stack: " + (e.stack || "").split("\n")[1]); }
      try { this.logT("[DEBUG] creating " + (script.clips ? script.clips.length : 0) + " clips..."); this.createClips(script.clips || []); this.logT("[DEBUG] createClips OK");
      // I2V: clips with _video mediaId should be video type
      const _clips = useEditorStore.getState().clips;
      const _fixed = _clips.map(c => c.mediaId && c.mediaId.endsWith("_video") ? { ...c, type: "video" } : c);
      useEditorStore.getState().setClips(_fixed);
      this.logT("[DEBUG] i2v clips reclassified to video"); } catch(e: any) { this.errors.push("[createClips] " + e.message + " | stack: " + (e.stack || "").split("\n")[1]); }
      try { if (script.actions && Array.isArray(script.actions)) { this.logT("[DEBUG] executing " + script.actions.length + " actions..."); await this.executeActions(script.actions); this.logT("[DEBUG] executeActions OK");

      // === Auto Subtitle Generation ===
      const subtitleSegments = (this as any)._subtitleSegments || [];
      if (subtitleSegments.length > 0) {
        try {
          const subResp = await fetch("http://localhost:3456/api/subtitle/generate", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              segments: subtitleSegments,
              projectWidth: useEditorStore.getState().project?.width || 1920,
              projectHeight: useEditorStore.getState().project?.height || 1080,
              fps: useEditorStore.getState().project?.fps || 30,
            }),
          });
          const subData = await subResp.json();
          if (subData.success) {
            (this as any)._assPath = subData.assPath;
            // === Save to Zustand store for preview subtitle overlay ===
            try {
              const store = useEditorStore.getState();
              if (store.setSubtitleSegments) {
                store.setSubtitleSegments(subtitleSegments.map((seg: any) => ({
                  text: seg.text,
                  startFrame: seg.startFrame,
                  endFrame: seg.endFrame,
                })));
                store.setSubtitleVisible(true);
                if (store.subtitlePreset === 'none') store.setSubtitlePreset('clean');
                this.logT('[Subtitle] Saved ' + subtitleSegments.length + ' segments to preview store');
              }
            } catch (storeErr: any) {
              this.logT('[Subtitle] Store save skipped: ' + storeErr.message);
            }
            (this as any)._fontDir = subData.fontPath ? subData.fontPath.replace(/[^/\\]*$/, "") : "";
            this.logT("[Subtitle] ASS generated: " + subData.assPath + " (" + subData.segments + " segments)");
          } else {
            this.errors.push("[Subtitle] Failed: " + (subData.error || "unknown"));
          }
        } catch (subErr: any) {
          this.errors.push("[Subtitle] Error: " + subErr.message);
        }
      } } } catch(e: any) { this.errors.push("[executeActions] " + e.message + " | stack: " + (e.stack || "").split("\n")[1]); }
      this.logT("[ScriptEngine] Complete (" + (Date.now() - start) + "ms)");
    } catch (err: any) { this.errors.push("[ScriptEngine] Fatal: " + err.message); }
    return { success: this.errors.length === 0, log: this.log, errors: this.errors, clipIds: Array.from(this.clipIdMap.values()).length > 0 ? Array.from(this.clipIdMap.values()) : useEditorStore.getState().clips.map(c => c.id), duration: Date.now() - start };
  }

  private setupProject(script: FlowScript) {
    const store = useEditorStore.getState();
    const project = script.project;
    this.logT("[DEBUG] project: " + JSON.stringify(project));
    const validPresets = ["16:9", "9:16", "1:1", "4:5", "21:9"];
    if (project.aspectPreset && validPresets.includes(project.aspectPreset)) {
      this.logT("[DEBUG] setAspectPreset: " + project.aspectPreset);
      store.setAspectPreset(project.aspectPreset as any);
    } else {
      this.logT("[DEBUG] setProjectSize: " + project.width + "x" + project.height);
      store.setProjectSize(project.width || DEFAULT_PROJECT.width, project.height || DEFAULT_PROJECT.height);
    }
    if (project.fps) store.setFps(project.fps);
    this.logT("[Project] " + (project.width || DEFAULT_PROJECT.width) + "x" + (project.height || DEFAULT_PROJECT.height) + " @ " + (project.fps || DEFAULT_PROJECT.fps) + "fps");
  }

  private async importMedia(mediaList: FlowScriptMedia[]) {
    if (!mediaList || !Array.isArray(mediaList)) return;
    for (const media of mediaList) {
      if (!media.id && (media as any).mediaId) media.id = (media as any).mediaId;
      if (!media.id) media.id = "m_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
      if (media.src.startsWith("ai://")) {
        this.logT("[Media] AI generation: " + media.id);
        try {
          const resp = await fetch("http://localhost:3456/api/comfyui/generate", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workflowId: (media.aiWorkflow === "image-to-video" || media.aiWorkflow === "video-i2v") ? "background-scene" : (media.aiWorkflow || "background-scene"), positive: (() => { const p = media.aiPrompt || media.src.replace("ai://", ""); this.logT("[Media] ComfyUI positive: " + p.substring(0, 120)); return p; })(), width: 1024, height: 1024, seed: (media as any)._seeds ? Object.values((media as any)._seeds)[0] as number : undefined, characterRefs: (media as any)._characterRefs || [] }),
          });
          const data = await resp.json();
          if (data.success) {
            useEditorStore.getState().addMediaItem({ id: media.id, name: media.name || ("AI: " + (media.aiPrompt || media.src || "").replace("ai://", "").substring(0, 40)), type: media.type || "image", url: data.serverUrl && data.serverUrl.startsWith("http") ? data.serverUrl : "http://localhost:3456/media/" + (data.localPath || data.serverUrl || "").split(/[\\/]/).pop(), localPath: data.localPath || data.serverUrl, duration: media.duration || 5, width: 1024, height: 1024, size: 0 });
            this.mediaIdMap.set(media.id, media.id);
            if ((media as any).mediaId && (media as any).mediaId !== media.id) this.mediaIdMap.set((media as any).mediaId, media.id);
            
            // Phase 3.3: Image-to-Video conversion
            if (media.aiWorkflow === "image-to-video" || media.aiWorkflow === "video-i2v") {
              this.logT("[Media] Starting Image-to-Video conversion...");
                // === B1: Chain — use previous clip's last frame as start image ===
                let chainStartImage = data.localPath; // default: use the AI-generated image
                if ((media as any)._chainFrom) {
                  const chainFromId = (media as any)._chainFrom;
                  const prevMediaId = this.mediaIdMap.get(chainFromId) || chainFromId;
                  const prevMedia = useEditorStore.getState().mediaItems.find(m => m.id === prevMediaId);
                  if (prevMedia?.localPath && (prevMedia.localPath.endsWith('.mp4') || prevMedia.localPath.endsWith('.webm'))) {
                    this.logT("[B1-Chain] Extracting last frame from: " + prevMedia.localPath);
                    try {
                      const chainResp = await fetch("http://localhost:3456/api/extract-last-frame", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ videoLocalPath: prevMedia.localPath }),
                      });
                      const chainData = await chainResp.json();
                      if (chainData.success) {
                        chainStartImage = chainData.localPath;
                        this.logT("[B1-Chain] Using last frame as start image: " + chainData.localPath);
                      } else {
                        this.logT("[B1-Chain] Extract failed: " + (chainData.error || "unknown") + " — using AI image");
                      }
                    } catch (chainErr: any) {
                      this.logT("[B1-Chain] Extract error: " + chainErr.message + " — using AI image");
                    }
                  } else {
                    this.logT("[B1-Chain] Previous media not a video, using AI image");
                  }
                }
              try {
                // === B1-fix: When chaining, use continuation prompt instead of scene prompt ===
                const isChaining = (media as any)._chainFrom && chainStartImage !== data.localPath;
                const basePrompt = media.aiPrompt || media.src.replace("ai://", "");
                const i2vPrompt = isChaining
                  ? "seamless continuation of the previous scene, " + basePrompt.substring(0, 120) + ", smooth camera motion, consistent lighting, cinematic, same color palette, continuous movement"
                  : basePrompt + ", gentle camera motion, cinematic, smooth animation";
                if (isChaining) {
                  this.logT("[B1-Chain] Continuation prompt: " + i2vPrompt.substring(0, 100));
                }
                const i2vResp = await fetch("http://localhost:3456/api/comfyui/generate-video", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    imageLocalPath: chainStartImage,
                    positive: i2vPrompt,
                    width: 480, height: 480, length: 81, steps: 6
                  })
                });
                const i2vData = await i2vResp.json();
                if (i2vData.success) {
                  useEditorStore.getState().addMediaItem({
                    id: media.id + "_video",
                    name: (media.name || ("AI: " + (media.aiPrompt || media.src || "").replace("ai://", "").substring(0, 30))) + " [video]",
                    type: "video",
                    url: i2vData.serverUrl,
                    localPath: i2vData.localPath,
                    duration: (i2vData.frames || 81) / (i2vData.fps || 16),
                    width: i2vData.width || 480, height: i2vData.height || 832, size: 0
                  });
                  this.mediaIdMap.set(media.id, media.id + "_video");
                                    // === A2: Auto enhance — interpolate 16fps→30fps + upscale 2x ===
                  try {
                    const enhResp = await fetch("http://localhost:3456/api/enhance-video", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        videoLocalPath: i2vData.localPath,
                        targetFps: 30,
                        upscaleScale: 2,
                      }),
                    });
                    const enhData = await enhResp.json();
                    if (enhData.success) {
                      // Replace i2v media with enhanced version
                      useEditorStore.getState().addMediaItem({
                        id: media.id + "_enhanced",
                        name: (media.name || ("AI: " + (media.aiPrompt || media.src || "").replace("ai://", "").substring(0, 30))) + " [HD]",
                        type: "video",
                        url: enhData.serverUrl,
                        localPath: enhData.localPath,
                        duration: (i2vData.frames || 81) / (i2vData.fps || 16),
                        width: (i2vData.width || 480) * 2,
                        height: (i2vData.height || 832) * 2,
                        size: 0,
                      });
                      this.mediaIdMap.set(media.id, media.id + "_enhanced");
                      this.logT("[A2] Enhanced: " + enhData.localPath + " (30fps, " + (enhData.upscaleScale || 2) + "x, " + (enhData.sizeMB || "?") + "MB)");
                    } else {
                      this.logT("[A2] Enhance failed: " + (enhData.error || "unknown") + " — using original i2v");
                    }
                  } catch (enhErr: any) {
                    this.logT("[A2] Enhance error: " + enhErr.message + " — using original i2v");
                  }
                  this.logT("[Media] I2V complete: " + i2vData.localPath);
                } else {
                  this.logT("[Media] I2V failed: " + (i2vData.error || "unknown") + " - using image fallback");
                }
              } catch (i2vErr: any) {
                this.logT("[Media] I2V error: " + i2vErr.message + " - using image fallback");
              }
            }

                        
            // === A3: TTS clip placement (TTS already generated in Phase 1) ===
            if ((media as any).narration && (this as any)._ttsResults?.has(media.id)) {
              try {
                const narrText = (media as any).narration;
                const narrVoice = (media as any).narrationVoice || (media as any).narrationLang || "ko";
                const narrOutId = media.id + "_tts";
                const fps = useEditorStore.getState().project?.fps || 30;

                // Get scene startFrame from script data
                const scriptClips = (this as any)._scriptData?.clips || [];
                const myScriptClip = scriptClips.find((c: any) => c.mediaId === media.id);
                const mediaIdx = ((this as any)._scriptData?.media || []).findIndex((m: any) => m.id === media.id);
                const sceneStartFrame = myScriptClip ? myScriptClip.startFrame : (mediaIdx >= 0 ? mediaIdx * 150 : 0);

                const pregenTTS = (this as any)._ttsResults.get(media.id);
                this.logT("[A3-TTS] Using pre-generated TTS for " + media.id + ": " + narrText.substring(0, 50));

                const ttsData = { success: true, localPath: pregenTTS.localPath, serverUrl: pregenTTS.serverUrl, duration: pregenTTS.duration };
                const ttsDur = pregenTTS.duration;
                const ttsFrames = pregenTTS.frames;
                const videoDurFrames = myScriptClip ? (myScriptClip.durationFrames || 150) : 150;
                const videoDurSec = videoDurFrames / fps;

                this.logT("[A3-TTS] Narration: " + ttsFrames + "f (" + ttsDur.toFixed(1) + "s)");
                this.logT("[A3-TTS] Video:     " + videoDurFrames + "f (" + videoDurSec.toFixed(1) + "s)");

                // 2. Compare narration vs video duration
                if (ttsFrames > videoDurFrames && !(this as any)._ttsResults?.has(media.id)) {
                  // CASE 1: Narration longer than video -> EXTEND VIDEO (skipped in TTS-First mode)
                  const shortfallFrames = ttsFrames - videoDurFrames;
                  const shortfallSec = shortfallFrames / fps;
                  const targetDurSec = ttsDur + 0.5; // +0.5s padding
                  const targetDurFrames = Math.ceil(targetDurSec * fps);

                  this.logT("[A3-TTS] Video too short by " + shortfallFrames + "f (" + shortfallSec.toFixed(1) + "s)");
                  this.logT("[A3-TTS] Extending video to match narration...");

                  // Find the video media file (enhanced or original)
                  const videoMediaId = this.mediaIdMap.get(media.id) || media.id;
                  const videoMedia = useEditorStore.getState().mediaItems.find((m: any) => m.id === videoMediaId);

                  if (videoMedia?.localPath) {
                    try {
                      const extResp = await fetch("http://localhost:3456/api/video/extend", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          videoPath: videoMedia.localPath,
                          targetDurationSec: targetDurSec,
                          strategy: "auto",
                          shortfallSec: shortfallSec + 0.5,
                        }),
                      });
                      const extData = await extResp.json();
                      if (extData.success) {
                        // Update the media item with extended video
                        const store = useEditorStore.getState();
                        const extendedId = videoMediaId + "_ext";
                        store.addMediaItem({
                          id: extendedId,
                          name: (videoMedia.name || "Video") + " [ext]",
                          type: "video",
                          url: extData.serverUrl,
                          localPath: extData.localPath,
                          duration: extData.newDuration,
                          size: 0,
                        });
                        this.mediaIdMap.set(media.id, extendedId);
                        this.logT("[VideoExtend] " + extData.strategy + ": " + extData.originalDuration?.toFixed(1) + "s -> " + extData.newDuration?.toFixed(1) + "s (" + extData.sizeMB + "MB)");

                        // Update script clip duration
                        if (myScriptClip) {
                          myScriptClip.durationFrames = targetDurFrames;
                        }
                      } else {
                        this.logT("[VideoExtend] Failed: " + (extData.error || "unknown") + " - using original");
                      }
                    } catch (extErr: any) {
                      this.logT("[VideoExtend] Error: " + extErr.message + " - using original");
                    }
                  } else {
                    // No video file (image fallback) - just extend the clip duration
                    if (myScriptClip) {
                      myScriptClip.durationFrames = targetDurFrames;
                      this.logT("[A3-TTS] Image fallback: extended clip to " + targetDurFrames + "f");
                    }
                  }

                } else if (ttsFrames < videoDurFrames) {
                  // CASE 2: Video longer than narration -> KEEP AS IS
                  const surplus = videoDurFrames - ttsFrames;
                  this.logT("[A3-TTS] Video has " + surplus + "f (" + (surplus / fps).toFixed(1) + "s) surplus - keeping original");

                } else {
                  // CASE 3: Perfect match
                  this.logT("[A3-TTS] Perfect duration match!");
                }

                // 3. Register TTS media
                useEditorStore.getState().addMediaItem({
                  id: narrOutId, name: "Narration: " + narrText.substring(0, 50),
                  type: "audio", url: ttsData.serverUrl, localPath: ttsData.localPath,
                  duration: ttsDur, size: 0,
                });
                this.mediaIdMap.set(narrOutId, narrOutId);

                // 4. Create narration track if needed
                const audioTracks = useEditorStore.getState().tracks.filter((t: any) => t.type === "audio");
                let narrTrackId = audioTracks.find((t: any) => t.name?.includes("Narration") || t.name?.includes("나레이션"))?.id;
                if (!narrTrackId) {
                  narrTrackId = "narr_track";
                  useEditorStore.getState().dispatch(new AddTrackCommand({
                    id: narrTrackId, name: "나레이션", type: "audio",
                    order: 200, height: 60, color: "#f97316",
                    locked: false, visible: true, muted: false, solo: false,
                  }));
                  this.logT("[A3-TTS] Created narration track");
                }

                // 5. Place narration clip at scene startFrame
                const ttsClip = createDefaultClip({
                  id: uid(), name: "TTS: " + narrText.substring(0, 50), text: narrText,
                  type: "audio" as any, trackId: narrTrackId,
                  startFrame: sceneStartFrame, durationFrames: ttsFrames,
                  mediaId: narrOutId,
                });
                useEditorStore.getState().dispatch(new AddClipCommand(ttsClip, false));
                this.logT("[A3-TTS] Placed narration @ frame " + sceneStartFrame + " (" + ttsDur.toFixed(1) + "s)");

                // Collect subtitle segment for ASS generation
                const endFrame = sceneStartFrame + ttsFrames;
                const words = narrText.split(/\s+/).filter((w: string) => w.length > 0);
                const wordDurMs = (ttsDur * 1000) / Math.max(1, words.length);
                const subtitleWords = words.map((w: string, idx: number) => ({
                  text: w,
                  duration: wordDurMs / 1000,
                  startMs: Math.round(idx * wordDurMs),
                  endMs: Math.round((idx + 1) * wordDurMs),
                }));
                ((this as any)._subtitleSegments || []).push({
                  text: narrText,
                  startFrame: sceneStartFrame,
                  endFrame: endFrame,
                  words: subtitleWords,
                });
                this.logT("[Subtitle] Segment added: frame " + sceneStartFrame + "-" + endFrame + " (" + words.length + " words)");

                // 6. Shift subsequent clips if video was extended
                const finalDurFrames = myScriptClip ? myScriptClip.durationFrames : videoDurFrames;
                if (finalDurFrames > videoDurFrames) {
                  const shift = finalDurFrames - videoDurFrames;
                  for (const sc of scriptClips) {
                    if (sc.startFrame > sceneStartFrame) {
                      sc.startFrame += shift;
                      this.logT("[A3-TTS] Shifted clip " + (sc.mediaId || "?") + " to frame " + sc.startFrame);
                    }
                  }
                }

              } catch (narrErr: any) {
                this.errors.push("[A3-TTS] Error: " + narrErr.message);
              }
            }
// === A1: Auto-save first image as face reference ===
            if (data.localPath && (media as any)._seeds) {
              try {
                const regMod = await import('../registry/CharacterRegistry');
                for (const [charKey] of Object.entries((media as any)._seeds)) {
                  const existing = regMod.getCharacter(charKey);
                  if (existing && !existing.sheets.front) {
                    regMod.updateCharacterSheets(charKey, { front: data.localPath });
                    this.logT("[A1] Auto-saved face ref for " + charKey + ": " + data.localPath);
                  }
                }
              } catch (regErr: any) { this.logT("[A1] Registry update skipped: " + (regErr.message || regErr)); }
            }
            this.logT("[Media] AI generated: " + data.localPath + " | url: " + (data.serverUrl && data.serverUrl.startsWith("http") ? data.serverUrl : "http://localhost:3456/media/" + (data.localPath || "").split(/[\\/]/).pop()));
          } else { this.errors.push("[Media] AI failed: " + (data.error || "unknown")); }
        } catch (err: any) { this.errors.push("[Media] AI error: " + err.message); }
      } else {
        const store = useEditorStore.getState();
        if (!store.mediaItems.find(m => m.id === media.id)) {
          store.addMediaItem({ id: media.id, name: media.name || "Media", type: media.type, url: media.src.startsWith("http") ? media.src : "http://localhost:3456/media/" + media.src, localPath: media.src, duration: media.duration || 5, size: 0 });
        }
        this.logT("[Media] Imported: " + media.id);
      }
    }
  }

  private createTracks(trackList: FlowScriptTrack[]) {
    const store = useEditorStore.getState();
    const existingIds = new Set(store.tracks.map(t => t.id));
    if (!trackList || !Array.isArray(trackList)) return;
    for (const t of trackList) {
      if (existingIds.has(t.id)) continue;
      const track: Track = { id: t.id, name: t.name || (t.type === "video" ? "비디오" : t.type === "audio" ? "오디오" : "텍스트") + " " + t.id, type: t.type, order: t.type === "video" ? 500 : t.type === "text" ? 600 : 100, height: t.height || (t.type === "video" ? 80 : t.type === "audio" ? 60 : 40), color: t.type === "video" ? "#3b82f6" : t.type === "audio" ? "#22c55e" : "#f59e0b", locked: t.locked || false, visible: t.visible !== false, muted: t.muted || false, solo: t.solo || false };
      store.dispatch(new AddTrackCommand(track));
      this.logT("[Track] Created: " + t.id + " (" + t.type + ")");
    }
  }

  private createClips(clipList: FlowScriptClip[]) {
    // Auto-create tracks for clips that reference non-existent tracks
    const existingTrackIds = new Set(useEditorStore.getState().tracks.map(t => t.id));
    const neededTracks = new Map<string, string>(); // trackId -> type
    for (const sc of (clipList || [])) {
      const tid = sc.trackId;
      if (tid && !existingTrackIds.has(tid) && !neededTracks.has(tid)) {
        const clipType = sc.type === "image" ? "video" : sc.type || "video";
        neededTracks.set(tid, clipType);
      }
    }
    for (const [tid, ttype] of neededTracks) {
      const trackType = ttype === "image" ? "video" : ttype;
      const track: Track = {
        id: tid,
        name: (trackType === "video" ? String.fromCharCode(48708, 46356, 50724) : trackType === "audio" ? String.fromCharCode(50724, 46356, 50724) : String.fromCharCode(53581, 49828, 53944)) + " " + tid,
        type: trackType as any,
        order: trackType === "video" ? 500 : trackType === "text" ? 600 : 100,
        height: trackType === "video" ? 80 : trackType === "audio" ? 60 : 40,
        color: trackType === "video" ? "#3b82f6" : trackType === "audio" ? "#22c55e" : "#f59e0b",
        locked: false, visible: true, muted: false, solo: false
      };
      useEditorStore.getState().dispatch(new AddTrackCommand(track));
      this.logT("[Track] Auto-created: " + tid + " (" + trackType + ") for orphan clips");
      existingTrackIds.add(tid);
    }
    const store = useEditorStore.getState();
    if (!clipList || !Array.isArray(clipList)) return;
    for (const sc of clipList) {
      const actualId = sc.id || uid();
      if (sc.id) this.clipIdMap.set(sc.id, actualId);
      let trackId = sc.trackId;
      if (!trackId) {
        const tracks = useEditorStore.getState().tracks;
        const tt = tracks.filter(t => t.type === (sc.type === "image" ? "video" : sc.type));
        trackId = tt.length > 0 ? tt[0].id : "v1";
      }
      let src = "", localPath = "", mediaId = sc.mediaId || "";
      // Try to resolve mediaId from the mediaIdMap (handles AI script mediaId mismatch)
      if (mediaId) { const mapped = this.mediaIdMap.get(mediaId); if (mapped && mapped !== mediaId) { this.logT("[Clip] mediaId mapped: " + mediaId + " -> " + mapped); mediaId = mapped; } }
      // If still not found, try matching by index (first media for first clip, etc.)
      if (mediaId && !useEditorStore.getState().mediaItems.find(m => m.id === mediaId)) {
        const allMedia = useEditorStore.getState().mediaItems;
        const mediaType = sc.type === "text" ? null : sc.type === "audio" ? "audio" : "image";
        if (mediaType) {
          const candidates = allMedia.filter(m => mediaType === "image" ? (m.type === "image" || m.type === "video") : m.type === mediaType);
          if (candidates.length > 0) {
            // Pick next unused media of matching type
          const usedMediaIds = new Set();
          for (const c of useEditorStore.getState().clips) { if (c.mediaId) usedMediaIds.add(c.mediaId); }
          const unused = candidates.filter(m => !usedMediaIds.has(m.id));
          mediaId = (unused.length > 0 ? unused[0] : candidates[0]).id;
          this.logT("[Clip] mediaId resolved by type match: " + mediaId);
          }
        }
      }
      // If no mediaId at all but clip needs media, try to auto-assign
      if (!mediaId && sc.type !== "text") {
        const allMedia = useEditorStore.getState().mediaItems;
        const mediaType = sc.type === "audio" ? "audio" : null;
        const candidates = mediaType ? allMedia.filter(m => m.type === mediaType) : allMedia.filter(m => m.type === "image" || m.type === "video");
        if (candidates.length > 0) {
          // Use a counter based on how many clips of this type we've already created
          const usedCount = Array.from(this.clipIdMap.values()).length;
          const idx = Math.min(usedCount, candidates.length - 1);
          mediaId = candidates[idx].id;
          this.logT("[Clip] mediaId auto-assigned: " + mediaId);
        }
      }
      if (mediaId) {
        const media = useEditorStore.getState().mediaItems.find(m => m.id === mediaId);
        if (media) { src = media.url || ""; localPath = media.localPath || ""; if (!src && localPath) { const fn = localPath.split(/[\\/]/).pop() || ""; src = "http://localhost:3456/media/" + fn; } }
      }
      const clip = createDefaultClip({ id: actualId, name: sc.text || (((src || localPath || "").match(/\.(mp4|webm|mov|avi|mkv)$/i) ? "video" : sc.type) + " clip"), type: (() => { const ext = (src || localPath || "").split(".").pop()?.toLowerCase(); if (sc.type === "video" && ext && ["png","jpg","jpeg","webp","bmp","gif"].includes(ext)) return "image"; // If localPath or src is a video file, force type to video
              const videoExts = ["mp4","webm","mov","avi","mkv"];
              if (ext && videoExts.includes(ext)) return "video";
              return sc.type === "image" ? "image" : sc.type; })(), trackId, startFrame: sc.startFrame, durationFrames: sc.durationFrames, src, mediaId, localPath, x: sc.x || 0, y: sc.y || 0, width: sc.width || useEditorStore.getState().projectWidth || DEFAULT_PROJECT.width, height: sc.height || useEditorStore.getState().projectHeight || DEFAULT_PROJECT.height, rotation: sc.rotation || 0, opacity: sc.opacity ?? 100, volume: sc.volume ?? 100, muted: sc.muted || false, speed: sc.speed || 1, fadeIn: sc.fadeIn || 0, fadeOut: sc.fadeOut || 0, groupId: sc.groupId, sourceStart: sc.sourceStart || 0, sourceDuration: sc.sourceDuration, text: sc.text, fontFamily: sc.textStyle?.fontFamily, fontSize: sc.textStyle?.fontSize, fontColor: sc.textStyle?.fontColor, fontWeight: sc.textStyle?.fontWeight, textAlign: sc.textStyle?.textAlign, textBgColor: sc.textStyle?.backgroundColor, textBgOpacity: sc.textStyle?.backgroundOpacity, borderWidth: sc.textStyle?.borderWidth, borderColor: sc.textStyle?.borderColor, shadowX: sc.textStyle?.shadowX, shadowY: sc.textStyle?.shadowY, shadowColor: sc.textStyle?.shadowColor, lineHeight: sc.textStyle?.lineHeight });
      if (sc.keyframes) (clip as any).keyframes = sc.keyframes;
      if (sc.effects) (clip as any).scriptEffects = sc.effects;
      const ripple = useEditorStore.getState().rippleMode;
      // === Auto cross-fade for chained scenes ===
      if (sc.startFrame > 0 && clip.type !== 'audio' && clip.type !== 'text') {
        const prevClips = useEditorStore.getState().clips
          .filter(c => c.trackId === trackId && c.type !== 'audio' && c.type !== 'text')
          .sort((a, b) => a.startFrame - b.startFrame);
        const prevClip = prevClips.length > 0 ? prevClips[prevClips.length - 1] : null;
        if (prevClip) {
          const fps = useEditorStore.getState().fps || 30;
          const overlapFrames = Math.min(Math.round(fps * 0.33), 10); // ~10 frames (0.33s) overlap
          const prevEnd = prevClip.startFrame + prevClip.durationFrames;
          // If clips are adjacent or nearly adjacent, create overlap
          if (Math.abs(clip.startFrame - prevEnd) <= overlapFrames * 2) {
            clip.startFrame = Math.max(0, prevEnd - overlapFrames);
            (clip as any).transitionIn = { type: 'dissolve', duration: overlapFrames };
            this.logT("[Transition] Auto dissolve " + overlapFrames + "f between prev clip and " + actualId);
          }
        }
      }
      store.dispatch(new AddClipCommand(clip, ripple));
      this.logT("[Clip] " + actualId + " @ frame " + sc.startFrame + " (" + sc.type + ") src=" + (src || "none").substring(0, 60));
    }
  }

  private async executeActions(actions: FlowScriptAction[]) {
    if (!actions || !Array.isArray(actions)) return;
    for (const act of actions) {
      switch (act.action || (act as any).type) {
        case "split": {
          const cid = this.resolveClipId(act.clipId);
          useEditorStore.getState().dispatch(new SplitClipCommand(cid, act.frame));
          this.logT("[Action] Split " + cid + " at frame " + act.frame); break;
        }
        case "splitAll": {
          const clips = useEditorStore.getState().clips.filter(c => c.startFrame < act.frame && c.startFrame + c.durationFrames > act.frame);
          for (const c of clips) useEditorStore.getState().dispatch(new SplitClipCommand(c.id, act.frame));
          this.logT("[Action] SplitAll at frame " + act.frame); break;
        }
        case "delete": {
          for (const id of act.clipIds) useEditorStore.getState().dispatch(new DeleteClipCommand(this.resolveClipId(id), false));
          this.logT("[Action] Delete " + act.clipIds.length + " clips"); break;
        }
        case "rippleDelete": {
          for (const id of act.clipIds) useEditorStore.getState().dispatch(new DeleteClipCommand(this.resolveClipId(id), true));
          this.logT("[Action] RippleDelete " + act.clipIds.length + " clips"); break;
        }
        case "group": {
          const gid = uid();
          const resolved = act.clipIds.map(id => this.resolveClipId(id));
          const clips = useEditorStore.getState().clips.map(c => resolved.includes(c.id) ? { ...c, groupId: gid } : c);
          useEditorStore.setState({ clips });
          this.logT("[Action] Group " + act.clipIds.length + " clips"); break;
        }
        case "setVolume": {
          const cid = this.resolveClipId(act.clipId);
          const clips = useEditorStore.getState().clips.map(c => c.id === cid ? { ...c, volume: act.volume } : c);
          useEditorStore.setState({ clips });
          this.logT("[Action] SetVolume " + cid + " -> " + act.volume); break;
        }
        case "setSpeed": {
          const cid2 = this.resolveClipId(act.clipId);
          const clips2 = useEditorStore.getState().clips.map(c => c.id === cid2 ? { ...c, speed: act.speed } : c);
          useEditorStore.setState({ clips: clips2 });
          this.logT("[Action] SetSpeed " + cid2 + " -> " + act.speed); break;
        }
        case "move": {
          const cid3 = this.resolveClipId(act.clipId);
          const clips3 = useEditorStore.getState().clips.map(c => c.id === cid3 ? { ...c, trackId: act.toTrack, startFrame: act.toFrame } : c);
          useEditorStore.setState({ clips: clips3 });
          this.logT("[Action] Move " + cid3); break;
        }
        case "export": {
          this.logT("[Action] Export " + act.format + " (delegating to /api/export)");
          try {
            const s = useEditorStore.getState();
            const resp = await fetch("http://localhost:3456/api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inputFiles: s.clips.map(c => ({ clipId: c.id, type: c.type, localPath: c.localPath, startFrame: c.startFrame, durationFrames: c.durationFrames, trackId: c.trackId, volume: c.volume, muted: c.muted, speed: c.speed, opacity: c.opacity, x: c.x, y: c.y, clipWidth: c.width, clipHeight: c.height, text: c.text, fontFamily: c.fontFamily, fontSize: c.fontSize, fontColor: c.fontColor, fontWeight: c.fontWeight, textAlign: c.textAlign, fadeIn: c.fadeIn, fadeOut: c.fadeOut, volumeEnvelope: c.volumeEnvelope, name: c.name, sourceStart: c.sourceStart, sourceDuration: c.sourceDuration })), projectWidth: s.projectWidth, projectHeight: s.projectHeight, fps: s.fps, tracks: s.tracks, format: act.format || "mp4", quality: act.quality || "medium", fileName: act.fileName || "flowscript_export" }) });
            const data = await resp.json();
            if (data.success) this.logT("[Action] Export complete: " + data.filePath);
            else this.errors.push("[Action] Export failed: " + data.error);
          } catch (err: any) { this.errors.push("[Action] Export error: " + err.message); }
          break;
        }        case "generateTTS": {
          const ttsText = (act as any).text;
          const ttsLang = (act as any).language || "ko";
          const ttsVoice = (act as any).voice;
          const ttsOutId = (act as any).outputMediaId || "tts_" + uid();
          if (ttsText) {
            try {
              const ttsResp = await fetch("http://localhost:3456/api/tts/generate", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: ttsText, language: ttsLang, voice: ttsVoice }),
              });
              const ttsData = await ttsResp.json();
              if (ttsData.success) {
                useEditorStore.getState().addMediaItem({
                  id: ttsOutId, name: "TTS: " + ttsText.substring(0, 30),
                  type: "audio", url: ttsData.serverUrl, localPath: ttsData.localPath,
                  duration: ttsData.duration || 5, size: 0,
                });
                this.mediaIdMap.set(ttsOutId, ttsOutId);
                this.logT("[Action] generateTTS -> " + ttsOutId + " (" + ttsData.duration + "s)");
              } else { this.errors.push("[Action] TTS failed: " + (ttsData.error || "unknown")); }
            } catch (err: any) { this.errors.push("[Action] TTS error: " + err.message); }
          }
          break;
        }
        case "generateBGM": {
          const bgmMood = (act as any).mood || "calm";
          const bgmId = (act as any).bgmId || "";
          const bgmDur = (act as any).duration || 30;
          const bgmVol = (act as any).volume || 40;
          const bgmOutId = (act as any).outputMediaId || "bgm_" + uid();
          const bgmDucking = (act as any).duckingEnabled !== false;
          const bgmDuckLevel = (act as any).duckingLevel || 25;
          try {
            const bgmResp = await fetch("http://localhost:3456/api/bgm/generate", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                bgmId: bgmId || undefined, mood: bgmMood, duration: bgmDur,
                volume: bgmVol, fadeIn: 2, fadeOut: 3,
                duckingEnabled: bgmDucking, duckingLevel: bgmDuckLevel,
              }),
            });
            const bgmData = await bgmResp.json();
            if (bgmData.success) {
              useEditorStore.getState().addMediaItem({
                id: bgmOutId, name: "BGM: " + (bgmData.preset || bgmMood),
                type: "audio", url: bgmData.serverUrl, localPath: bgmData.localPath,
                duration: bgmData.duration || bgmDur, size: 0,
              });
              this.mediaIdMap.set(bgmOutId, bgmOutId);
              this.logT("[Action] generateBGM -> " + bgmOutId + " (" + (bgmData.preset || bgmMood) + ", " + bgmData.duration + "s, " + (bgmData.sizeMB || "?") + "MB)");

              // Auto-place BGM clip on a BGM track
              const store = useEditorStore.getState();
              const fps = store.project?.fps || 30;
              const bgmDurFrames = Math.ceil((bgmData.duration || bgmDur) * fps);
              
              // Find or create BGM track
              let bgmTrackId = store.tracks.find((t: any) => 
                t.name?.toLowerCase().includes("bgm") || t.name?.toLowerCase().includes("music")
              )?.id;
              if (!bgmTrackId) {
                bgmTrackId = "bgm_track";
                store.dispatch(new AddTrackCommand({
                  id: bgmTrackId, name: "BGM", type: "audio",
                  order: 300, height: 40, color: "#4a9eff",
                } as any));
                this.logT("[B3-BGM] Created BGM track");
              }

              // Place BGM clip at frame 0 spanning full duration
              const bgmClip = createDefaultClip({
                id: uid(), name: "BGM: " + (bgmData.preset || bgmMood),
                type: "audio" as any, trackId: bgmTrackId,
                startFrame: 0, durationFrames: bgmDurFrames,
                mediaId: bgmOutId, volume: bgmVol,
              });
              store.dispatch(new AddClipCommand(bgmClip, false));
              this.logT("[B3-BGM] Placed BGM clip @ frame 0 (" + (bgmData.duration || bgmDur) + "s, vol=" + bgmVol + "%)");
            } else {
              this.errors.push("[Action] BGM failed: " + (bgmData.error || "unknown"));
            }
          } catch (bgmErr: any) {
            this.errors.push("[Action] BGM error: " + bgmErr.message);
          }
          break;
        }
        case "upscale": {
          const upMediaId = (act as any).mediaId;
          const upScale = (act as any).scale || 2;
          const upOutId = (act as any).outputMediaId || "upscaled_" + uid();
          const upMedia = useEditorStore.getState().mediaItems.find(m => m.id === upMediaId);
          if (upMedia?.localPath) {
            try {
              const upResp = await fetch("http://localhost:3456/api/comfyui/upscale", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageLocalPath: upMedia.localPath, scale: upScale }),
              });
              const upData = await upResp.json();
              if (upData.success) {
                useEditorStore.getState().addMediaItem({
                  id: upOutId, name: "Upscaled " + upScale + "x",
                  type: "image", url: upData.serverUrl, localPath: upData.localPath,
                  duration: 5, size: 0,
                });
                this.mediaIdMap.set(upOutId, upOutId);
                this.logT("[Action] upscale " + upMediaId + " -> " + upOutId + " (" + upScale + "x)");
              } else { this.errors.push("[Action] Upscale failed: " + (upData.error || "unknown")); }
            } catch (err: any) { this.errors.push("[Action] Upscale error: " + err.message); }
          } else { this.errors.push("[Action] Upscale: media not found: " + upMediaId); }
          break;
        }
        case "transition": {
          const trA = (act as any).clipIdA ? this.resolveClipId((act as any).clipIdA) : "";
          const trB = (act as any).clipIdB ? this.resolveClipId((act as any).clipIdB) : "";
          const trType = (act as any).type || "dissolve";
          const trDur = (act as any).duration || 15;
          this.logT("[Action] transition " + trType + " (" + trDur + " frames) between " + trA + " <-> " + trB);
          break;
        }
        case "save": {
          this.logT("[Action] save placeholder");
          break;
        }
        case "undo": case "redo": {
          this.logT("[Action] " + ((act as any).action) + " placeholder");
          break;
        }

        case "upload": { this.logT("[Action] Upload to " + act.platform + " (placeholder)"); break; }
        case "autoSubtitle": { this.logT("[Action] Auto subtitle (" + (act.language || "auto") + ")"); break; }
        case "wait": { await new Promise(r => setTimeout(r, act.seconds * 1000)); this.logT("[Action] Wait " + act.seconds + "s"); break; }
        case "log": { this.logT("[User] " + act.message); break; }        case "addClip": {
          const newClipId = uid();
          const aStore = useEditorStore.getState();
          const addType = (act as any).clipType || (act as any).type || "video";
          let addTrackId = (act as any).trackId || aStore.tracks.find(t => t.type === (addType === "image" ? "video" : addType))?.id || "";
          if (!addTrackId || !aStore.tracks.find(t => t.id === addTrackId)) {
            // Auto-create track if not exists
            const autoTrackType = addType === "image" ? "video" : addType;
            addTrackId = addTrackId || (autoTrackType === "video" ? "v1" : autoTrackType === "audio" ? "a1" : "t1");
            if (!aStore.tracks.find(t => t.id === addTrackId)) {
              const autoTrack: Track = {
                id: addTrackId,
                name: (autoTrackType === "video" ? "비디오" : autoTrackType === "audio" ? "오디오" : "텍스트") + " " + addTrackId,
                type: autoTrackType as any,
                order: autoTrackType === "video" ? 500 : autoTrackType === "text" ? 600 : 100,
                height: autoTrackType === "video" ? 80 : autoTrackType === "audio" ? 60 : 40,
                color: autoTrackType === "video" ? "#3b82f6" : autoTrackType === "audio" ? "#22c55e" : "#f59e0b",
                locked: false, visible: true, muted: false, solo: false,
              };
              useEditorStore.getState().dispatch(new AddTrackCommand(autoTrack));
              this.logT("[Action] addClip: auto-created track " + addTrackId + " (" + autoTrackType + ")");
            }
          }
          const addClip = createDefaultClip({
            id: newClipId,
            name: (act as any).name || addType + " clip",
            type: addType as any,
            trackId: addTrackId,
            startFrame: (act as any).startFrame || 0,
            durationFrames: (act as any).durationFrames || aStore.fps * 5,
            mediaId: (act as any).mediaId || "",
            src: (act as any).src || "",
            localPath: (act as any).localPath || "",
            text: (act as any).text,
            width: (act as any).width || aStore.projectWidth || DEFAULT_PROJECT.width,
            height: (act as any).height || aStore.projectHeight || DEFAULT_PROJECT.height,
          });
          aStore.dispatch(new AddClipCommand(addClip, aStore.rippleMode));
          if ((act as any).clipId) this.clipIdMap.set((act as any).clipId, newClipId);
          this.logT("[Action] addClip " + newClipId + " (" + addType + ") @ frame " + addClip.startFrame);
          break;
        }
        case "setClipProperty": {
          const spCid = this.resolveClipId((act as any).clipId);
          const spProp = (act as any).property;
          const spVal = (act as any).value;
          if (spCid && spProp) {
            const spClips = useEditorStore.getState().clips.map(c =>
              c.id === spCid ? { ...c, [spProp]: spVal } : c
            );
            useEditorStore.setState({ clips: spClips });
            this.logT("[Action] setClipProperty " + spCid + "." + spProp + " = " + JSON.stringify(spVal));
          }
          break;
        }
        case "addTrack": {
          const atId = (act as any).id || (act as any).trackId || uid();
          const atType = (act as any).trackType || (act as any).type || "video";
          const newTrack: Track = {
            id: atId,
            name: (act as any).name || atType + " " + atId,
            type: atType as any,
            order: atType === "video" ? 500 : atType === "text" ? 600 : 100,
            height: atType === "video" ? 80 : atType === "audio" ? 60 : 40,
            color: atType === "video" ? "#3b82f6" : atType === "audio" ? "#22c55e" : "#f59e0b",
            locked: false, visible: true, muted: false, solo: false,
          };
          useEditorStore.getState().dispatch(new AddTrackCommand(newTrack));
          this.logT("[Action] addTrack " + atId + " (" + atType + ")");
          break;
        }
        case "removeTrack": {
          const rtId = (act as any).trackId || (act as any).id;
          if (rtId) {
            useEditorStore.getState().removeTrack(rtId);
            this.logT("[Action] removeTrack " + rtId);
          }
          break;
        }
        case "setProject": {
          const spStore = useEditorStore.getState();
          if ((act as any).width && (act as any).height) {
            spStore.setProjectSize((act as any).width, (act as any).height);
          }
          if ((act as any).fps) spStore.setFps((act as any).fps);
          if ((act as any).aspectPreset) spStore.setAspectPreset((act as any).aspectPreset);
          this.logT("[Action] setProject " + ((act as any).width || "") + "x" + ((act as any).height || "") + " fps=" + ((act as any).fps || ""));
          break;
        }
        case "trim": {
          const trCid = this.resolveClipId((act as any).clipId);
          const trClips = useEditorStore.getState().clips;
          const trClip = trClips.find(c => c.id === trCid);
          if (trClip) {
            const edge = (act as any).edge || "right";
            const frames = (act as any).frames || 0;
            let updated: typeof trClip;
            if (edge === "left") {
              updated = { ...trClip, startFrame: trClip.startFrame + frames, durationFrames: Math.max(1, trClip.durationFrames - frames), sourceStart: trClip.sourceStart + frames };
            } else {
              updated = { ...trClip, durationFrames: Math.max(1, trClip.durationFrames + frames) };
            }
            useEditorStore.setState({ clips: trClips.map(c => c.id === trCid ? updated : c) });
            this.logT("[Action] trim " + trCid + " edge=" + edge + " frames=" + frames);
          }
          break;
        }
        case "duplicate": {
          const dupIds = (act as any).clipIds || [(act as any).clipId];
          const dupOffset = (act as any).offset || 0;
          const dupClips = useEditorStore.getState().clips;
          for (const did of dupIds) {
            const resolved = this.resolveClipId(did);
            const orig = dupClips.find(c => c.id === resolved);
            if (orig) {
              const newId = uid();
              const dup = { ...orig, id: newId, startFrame: orig.startFrame + orig.durationFrames + dupOffset };
              useEditorStore.getState().dispatch(new AddClipCommand(dup, false));
              this.logT("[Action] duplicate " + resolved + " -> " + newId);
            }
          }
          break;
        }
        default: {
          const a = (act as any);
          // Handle common AI-generated non-standard actions
          if (a.action === "add_text" || a.action === "addText") {
            this.logT("[Action] add_text -> creating text clip");
            if (a.text || a.params?.text) {
              const textClip = createDefaultClip({
                id: uid(), name: a.text || a.params?.text || "Text",
                type: "text" as any, trackId: a.trackId || a.params?.trackId || "t1",
                startFrame: a.startFrame || a.params?.startFrame || 0,
                durationFrames: a.durationFrames || a.params?.durationFrames || 90,
                text: a.text || a.params?.text,
                fontFamily: a.textStyle?.fontFamily || a.params?.fontFamily,
                fontSize: a.textStyle?.fontSize || a.params?.fontSize || 48,
                fontColor: a.textStyle?.fontColor || a.params?.fontColor || "#ffffff",
              });
              useEditorStore.getState().dispatch(new AddClipCommand(textClip, false));
              this.logT("[Action] Text clip created: " + (a.text || a.params?.text));
            }
          } else if (a.action === "add_audio" || a.action === "addAudio") {
            this.logT("[Action] add_audio -> creating audio clip");
            if (a.mediaId || a.params?.mediaId) {
              const audioClip = createDefaultClip({
                id: uid(), name: "Audio", type: "audio" as any,
                trackId: a.trackId || a.params?.trackId || "a1",
                startFrame: a.startFrame || a.params?.startFrame || 0,
                durationFrames: a.durationFrames || a.params?.durationFrames || 900,
                mediaId: a.mediaId || a.params?.mediaId,
                volume: a.volume || a.params?.volume || 100,
              });
              useEditorStore.getState().dispatch(new AddClipCommand(audioClip, false));
              this.logT("[Action] Audio clip created");
            } else { this.logT("[Action] add_audio skipped (no mediaId)"); }
          } else {
            this.logT("[Action] Unknown: " + a.action + " (params: " + JSON.stringify(a).substring(0, 100) + ")");
          }
          break;
        }
      }
    }
  }

  private resolveClipId(scriptId: string): string { return this.clipIdMap.get(scriptId) || scriptId; }

  static toFlowScript(): FlowScript {
    const s = useEditorStore.getState();
    return {
      version: "1.0",
      project: { width: s.projectWidth, height: s.projectHeight, fps: s.fps, aspectPreset: s.aspectPreset },
      media: s.mediaItems.map(m => ({ id: m.id, type: m.type, src: m.localPath || m.url, name: m.name, duration: m.duration })),
      tracks: s.tracks.map(t => ({ id: t.id, name: t.name, type: t.type, muted: t.muted, solo: t.solo, locked: t.locked, visible: t.visible, height: t.height })),
      clips: s.clips.map(c => ({ id: c.id, type: c.type, mediaId: c.mediaId, trackId: c.trackId, startFrame: c.startFrame, durationFrames: c.durationFrames, sourceStart: c.sourceStart, sourceDuration: c.sourceDuration, x: c.x, y: c.y, width: c.width, height: c.height, rotation: c.rotation, opacity: c.opacity, volume: c.volume, muted: c.muted, speed: c.speed, fadeIn: c.fadeIn, fadeOut: c.fadeOut, groupId: c.groupId, text: c.text, textStyle: c.text ? { fontFamily: c.fontFamily, fontSize: c.fontSize, fontColor: c.fontColor, fontWeight: c.fontWeight, textAlign: c.textAlign, backgroundColor: c.textBgColor, backgroundOpacity: c.textBgOpacity } : undefined, volumeEnvelope: c.volumeEnvelope })),
      metadata: { createdAt: new Date().toISOString(), author: "FlowCut" },
    };
  }
}

if (typeof window !== "undefined") {
  (window as any).__flowcut = {
    executeScript: async (json: FlowScript | string) => {
      const script = typeof json === "string" ? JSON.parse(json) : json;
      const engine = new ScriptEngine();
      return engine.execute(script);
    },
    getScript: () => ScriptEngine.toFlowScript(),
    getState: () => useEditorStore.getState(),
    store: useEditorStore,
  };
}
