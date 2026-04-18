# FlowCut Data Flow Reference

## Media Import -> Clip Creation -> Export

```
File (user picks)
  |
  v
useMediaImport.ts
  - uploadToServer() -> server saves to media_cache/, returns localPath + servePath
  - creates MediaItem { id, name, type, url, objectUrl, localPath, ... }
  - stores in editorStore.mediaItems[]
  |
  v
LeftPanel.tsx (double-click) or TrackLane.tsx (drag-drop)
  - calls clipFactory.createMediaClipFromItem(mediaItem, trackId, startFrame, fps)
  - clipFactory guarantees: mediaId, src, localPath are all set
  - dispatches AddClipCommand(clip)
  - clip stored in editorStore.clips[]
  |
  v
Preview (PreviewCanvas.tsx)
  - reads URL via: getClipPreviewUrl(clip)     [from mediaResolver.ts]
  - renders <video src={url}> or <img src={url}>
  |
  v
Export (ExportPanel.tsx)
  - reads path via: getClipLocalPath(clip, mediaItems)  [from mediaResolver.ts]
  - sends localPath to server -> FFmpeg encodes
```

## Key Rules

1. **Never access clip.src or clip.previewUrl directly** -> use `getClipPreviewUrl()`
2. **Never access clip.localPath directly for export** -> use `getClipLocalPath()`
3. **Never create clips with raw createDefaultClip for media** -> use `clipFactory.createMediaClipFromItem()`
4. **Never create inline uid()** -> import from `utils/uid.ts`
5. **Never use `as any` for clip property access** -> use `getClipNumericValue()` or proper types

## Central Files

| File | Purpose |
|------|---------|
| `utils/mediaResolver.ts` | All media URL/path lookups |
| `utils/clipFactory.ts` | All clip creation |
| `utils/uid.ts` | Single uid generator |
| `types/clip.ts` | Clip interface + ClipNumericKey + getEnvelopeVolume |
