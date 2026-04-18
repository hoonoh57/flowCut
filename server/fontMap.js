// server/fontMap.js — 프리뷰 CSS font-family → Windows TTF 매핑
const path = require('path');
const fs = require('fs');

const FONT_DIR = 'C:/Windows/Fonts';

// CSS font-family → TTF filename 매핑
const FONT_MAP = {
  // 한국어
  'Malgun Gothic': 'malgun.ttf',
  '맑은 고딕': 'malgun.ttf',
  'NanumGothic': 'NanumGothic.ttf',
  '나눔고딕': 'NanumGothic.ttf',
  'NanumMyeongjo': 'NanumMyeongjo.ttf',
  '나눔명조': 'NanumMyeongjo.ttf',
  'Batang': 'batang.ttc',
  '바탕': 'batang.ttc',
  'Gulim': 'gulim.ttc',
  '굴림': 'gulim.ttc',
  'Dotum': 'dotum.ttc',
  '돋움': 'dotum.ttc',
  
  // 영문 기본
  'Arial': 'arial.ttf',
  'Arial Black': 'ariblk.ttf',
  'Times New Roman': 'times.ttf',
  'Courier New': 'cour.ttf',
  'Georgia': 'georgia.ttf',
  'Verdana': 'verdana.ttf',
  'Tahoma': 'tahoma.ttf',
  'Trebuchet MS': 'trebuc.ttf',
  'Impact': 'impact.ttf',
  'Comic Sans MS': 'comic.ttf',
  'Consolas': 'consola.ttf',
  'Segoe UI': 'segoeui.ttf',
  'Calibri': 'calibri.ttf',
  'Cambria': 'cambria.ttc',
  
  // CSS generic → 기본 매핑
  'sans-serif': 'malgun.ttf',
  'serif': 'batang.ttc',
  'monospace': 'consola.ttf',
  'cursive': 'comic.ttf',
  'fantasy': 'impact.ttf',
};

// Bold 변형 매핑
const BOLD_MAP = {
  'malgun.ttf': 'malgunbd.ttf',
  'arial.ttf': 'arialbd.ttf',
  'times.ttf': 'timesbd.ttf',
  'cour.ttf': 'courbd.ttf',
  'georgia.ttf': 'georgiab.ttf',
  'verdana.ttf': 'verdanab.ttf',
  'tahoma.ttf': 'tahomabd.ttf',
  'consola.ttf': 'consolab.ttf',
  'segoeui.ttf': 'segoeuib.ttf',
  'calibri.ttf': 'calibrib.ttf',
};

// Italic 변형 매핑
const ITALIC_MAP = {
  'malgun.ttf': 'malgun.ttf', // 한글은 이탤릭 없음
  'arial.ttf': 'ariali.ttf',
  'times.ttf': 'timesi.ttf',
  'cour.ttf': 'couri.ttf',
  'georgia.ttf': 'georgiai.ttf',
  'consola.ttf': 'consolai.ttf',
};

/**
 * CSS font-family 문자열에서 첫 번째 매칭되는 TTF 경로 반환
 * @param {string} cssFontFamily - e.g. "'NanumGothic', sans-serif"
 * @param {boolean} bold
 * @param {boolean} italic
 * @returns {string} 절대 경로 e.g. "C:/Windows/Fonts/NanumGothic.ttf"
 */
function resolveFontPath(cssFontFamily, bold = false, italic = false) {
  if (!cssFontFamily) cssFontFamily = 'sans-serif';
  
  // CSS font-family 파싱: 'Font Name', "Font Name", Font Name
  const families = cssFontFamily
    .split(',')
    .map(f => f.trim().replace(/^['"]|['"]$/g, ''));
  
  let ttfFile = null;
  
  for (const family of families) {
    if (FONT_MAP[family]) {
      ttfFile = FONT_MAP[family];
      break;
    }
    // 대소문자 무시 매칭
    const lower = family.toLowerCase();
    for (const [key, val] of Object.entries(FONT_MAP)) {
      if (key.toLowerCase() === lower) {
        ttfFile = val;
        break;
      }
    }
    if (ttfFile) break;
  }
  
  if (!ttfFile) ttfFile = 'malgun.ttf'; // 최종 fallback
  
  // Bold/Italic 변형 적용
  if (bold && BOLD_MAP[ttfFile]) {
    const boldFile = BOLD_MAP[ttfFile];
    if (fs.existsSync(path.join(FONT_DIR, boldFile))) {
      ttfFile = boldFile;
    }
  } else if (italic && ITALIC_MAP[ttfFile]) {
    const italicFile = ITALIC_MAP[ttfFile];
    if (fs.existsSync(path.join(FONT_DIR, italicFile))) {
      ttfFile = italicFile;
    }
  }
  
  const fullPath = path.join(FONT_DIR, ttfFile).replace(/\\/g, '/');
  
  // 파일 존재 확인, 없으면 malgun fallback
  if (!fs.existsSync(fullPath)) {
    console.warn(`[fontMap] Font not found: ${fullPath}, fallback to malgun.ttf`);
    return path.join(FONT_DIR, 'malgun.ttf').replace(/\\/g, '/');
  }
  
  return fullPath;
}

module.exports = { resolveFontPath, FONT_MAP, FONT_DIR };