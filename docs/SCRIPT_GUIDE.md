# FlowScript Narration Guide

## Core Principle
- **1 Scene = 1 Narration**: Each narration describes only its own scene.
- **Narration First**: Video extends to match narration (narration is NEVER trimmed).

## Correct Example
- s1 (beach scene): "해변에 아침이 밝았습니다. 파도가 해안을 적시고 있습니다."
- s2 (lighthouse scene): "절벽 위의 등대가 모습을 드러냅니다."
- Result: Each narration matches its video content.

## Wrong Example (causes mismatch)
- s1 (beach scene): "해변에 아침이 밝았습니다. 멀리 등대도 보입니다."
- Problem: s1 shows beach but narration mentions lighthouse.

## Duration Guide
- narration < video: Keep original video (surplus as natural gap)
- narration > video +15%: SlowMotion extension
- narration > video +15-50%: Hybrid (70% slow + 30% freeze)
- narration > video +50%: Hybrid with warning

## Recommended Narration Length
- 5s video (150f): Korean 2-3 sentences (3-5s)
- Keep narration within 50% of video length when possible

## Video Extension Strategies
1. SlowMotion: Slightly slower playback (cinematic)
2. Hybrid: 70% slow + 30% last frame freeze
3. Freeze: Last frame hold (good for landscapes)
4. Loop: Repeat playback (waves, walking)

## Auto Clip Shifting
When video extends, all subsequent clips shift automatically.
Example: s1(0-150f) s2(150-300f) -> s1(0-369f) s2(369-519f)