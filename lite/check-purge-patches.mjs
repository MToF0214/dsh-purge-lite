// check-purge-patches.mjs - 只读检查：补丁关键词 + 当前 app 树的注入痕迹
//
// 相对原版的改动：
//   ① 不再硬编码单一 desktop profile 路径（原版 web 宿主下直接 throw）
//      改为按优先级探测多个候选，全都不存在则给出明确提示并正常退出
//   ② 显式退出码：0=检查完成（无论命中与否） 2=一个候选文件都没找到
//   ③ 输出更结构化，便于肉眼扫
//   ④ --json 输出机器可读结果
import { readFileSync, existsSync } from 'node:fs';

const HOME = process.env.USERPROFILE || process.env.HOME || 'C:/Users/Administrator';

// core.js 候选（按优先级）
const CORE_CANDIDATES = [
  `${HOME}/.dsh/profiles/web/node_modules/dsh-purge/lib/core.js`,
  `${HOME}/.dsh/profiles/desktop/node_modules/dsh-purge/lib/core.js`,
  `${HOME}/.dsh/plugins/node_modules/dsh-purge/lib/core.js`,
];

// 当前宿主 app 树里的 client.js 候选
const CLIENT_CANDIDATES = [
  'D:/AI/DeepSeek Harness/resources/app/dsh/node_modules/@deepseek-ai/dsh-api-session-controller/lib/client.js',
  'D:/AI/nodejs/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-api-session-controller/lib/client.js',
];

const KEYWORDS = [
  'KNOWN_SESSION_EVENT_TYPES',
  'known-event-types',
  'team/mode',
  'job/registered',
  'job/settled',
  'api-session-controller',
];

const JSON_OUT = process.argv.includes('--json');
const result = { coreFile: null, keywords: {}, clientFile: null, markers: 0, eventTypes: {}, warnings: [] };

function log(...a) { if (!JSON_OUT) console.log(...a); }

// ---------- 1. core.js ----------
const coreFile = CORE_CANDIDATES.find((p) => existsSync(p));
if (!coreFile) {
  result.warnings.push('core.js 未找到（候选: ' + CORE_CANDIDATES.join(' | ') + '）');
  log('[SKIP] core.js 未找到，跳过关键词检查');
  log('       候选路径:');
  CORE_CANDIDATES.forEach((p) => log('         ' + p));
} else {
  result.coreFile = coreFile;
  log('[core] ' + coreFile);
  let core = '';
  try {
    core = readFileSync(coreFile, 'utf8');
  } catch (e) {
    result.warnings.push('core.js 读取失败: ' + String(e).slice(0, 120));
    log('[ERR] 读取失败:', String(e).slice(0, 120));
  }
  if (core) {
    log('[core] 大小 ' + core.length + ' B');
    for (const n of KEYWORDS) {
      const c = core.split(n).length - 1;
      result.keywords[n] = c;
      log(`[core] ${n}  x${c}`);
      if (c > 0 && !JSON_OUT) {
        const i = core.indexOf(n);
        const ctx = core.slice(Math.max(0, i - 200), i + 200).replace(/\s+/g, ' ').slice(0, 380);
        log('       ' + ctx);
      }
    }
  }
}

// ---------- 2. 当前 app 树的 client.js ----------
log('');
const clientFile = CLIENT_CANDIDATES.find((p) => existsSync(p));
if (!clientFile) {
  result.warnings.push('client.js 未找到（候选: ' + CLIENT_CANDIDATES.join(' | ') + '）');
  log('[SKIP] client.js 未找到，跳过注入痕迹检查');
  log('       候选路径:');
  CLIENT_CANDIDATES.forEach((p) => log('         ' + p));
} else {
  result.clientFile = clientFile;
  log('[client] ' + clientFile);
  let t = '';
  try {
    t = readFileSync(clientFile, 'utf8');
  } catch (e) {
    result.warnings.push('client.js 读取失败: ' + String(e).slice(0, 120));
    log('[ERR] 读取失败:', String(e).slice(0, 120));
  }
  if (t) {
    const markers = t.split('[dsh-purge]').length - 1;
    result.markers = markers;
    log('[client] 大小 ' + t.length + ' B, 注入标记 [dsh-purge] x' + markers);

    const i = t.indexOf('KNOWN_SESSION_EVENT_TYPES');
    if (i >= 0 && !JSON_OUT) {
      log('[client] KNOWN_SESSION_EVENT_TYPES 上下文:');
      log('         ' + t.slice(i, i + 650).replace(/\s+/g, ' ').slice(0, 620));
    }

    for (const type of ['job/registered', 'job/settled', 'team/mode']) {
      const hit = t.includes(`"${type}"`) || t.includes(`'${type}'`) || t.includes(type);
      result.eventTypes[type] = hit;
      log(`[client] ${type}: ${hit ? '✓ 命中' : '-'}`);
    }
  }
}

// ---------- 3. 结论 ----------
log('');
if (result.warnings.length) {
  log('[warn] ' + result.warnings.length + ' 条提示:');
  result.warnings.forEach((w) => log('       - ' + w));
}
const nothingFound = !result.coreFile && !result.clientFile;
if (nothingFound) {
  log('[result] 两个目标都没找到——当前宿主布局与本脚本候选不符，需手工指定路径');
} else {
  log('[result] 检查完成');
}

if (JSON_OUT) console.log(JSON.stringify(result, null, 2));
process.exit(nothingFound ? 2 : 0);
