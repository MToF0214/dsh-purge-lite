// apply-lite-to-host.mjs — 把 3 条破坏性补丁在宿主上就地改成温和版
//
// 适用场景：没有"官方原版"备份可用于 restore，只能直接改宿主文件。
// 安全性：每个替换都做前置校验，匹配不到就跳过并报告，绝不盲改。
// 备份：调用方负责先备份（E:\BACKUP\host-backups\lite-patch-files-*）
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const BASE = 'D:/AI/nodejs/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai';
const DRY = process.argv.includes('--dry-run');

const JOBS = [
  // ---------- #19 工具结果修剪：从"永不修剪"改为"阈值×4" ----------
  {
    id: 19,
    label: 'TOOL_RESULT_PRUNER',
    file: `${BASE}/dsh-compaction-tool-result-pruner/lib/index.js`,
    find: `\t\t// [dsh-purge] tool-result pruning disabled: results pass through unchanged.\n\t\treturn null;`,
    repl: `\t\t// [dsh-purge-lite] pruning KEPT, threshold x4 (was: pure pass-through)\n\t\tconst totalChars = this.measureContent(blocks);\n\t\tif (totalChars <= this.config.thresholdChars * 4) return null;`,
    marker: '[dsh-purge-lite] pruning KEPT',
  },
  // ---------- #18 重复调用守卫：补回两个 ctx.on 注册 ----------
  {
    id: 18,
    label: 'REPEAT_TOOL_REMINDER',
    file: `${BASE}/dsh-repeat-tool-reminder/lib/index.js`,
    find: `\t// [dsh-purge] repeat-tool-reminder disabled: no reminder injection,\n\t// no chain tracking. The guard is fully inert.`,
    repl: `\t// [dsh-purge-lite] repeat-tool-reminder: hooks KEPT (reminder suppressed)\n\tctx.on("tools/post-execute", async (exec, _result, next) => {\n\t\treturn next();\n\t});\n\tctx.on("agent/pre-step", ({ agent, messages }, next) => {\n\t\tif (messages.some((message) => message.source.kind === "user")) chains.delete(agent);\n\t\treturn next();\n\t});`,
    marker: '[dsh-purge-lite] repeat-tool-reminder',
  },
  // ---------- #23 子代理深度：10 → 5 ----------
  {
    id: 23,
    label: 'SUBAGENT_MAXDEPTH',
    file: `${BASE}/dsh-tool-subagent/lib/index.js`,
    find: `.default(10) // [dsh-purge] subagent depth raised`,
    repl: `.default(5) // [dsh-purge-lite] subagent depth raised`,
    marker: 'default(5) // [dsh-purge-lite]',
  },
];

let ok = 0, skip = 0, fail = 0;
for (const j of JOBS) {
  console.log('\n' + '='.repeat(70));
  console.log(`### #${j.id} ${j.label}`);
  console.log(`file: ${j.file}`);

  if (!existsSync(j.file)) { console.log('  [SKIP] 文件不存在'); skip++; continue; }
  const src = readFileSync(j.file, 'utf8');

  if (src.includes(j.marker)) { console.log('  [SKIP] 已是温和版（幂等）'); skip++; continue; }
  if (!src.includes(j.find)) {
    console.log('  [SKIP] 找不到目标片段 —— 结构可能已变，人工核对');
    skip++; continue;
  }

  const patched = src.replace(j.find, j.repl);
  if (patched === src) { console.log('  [SKIP] 替换未产生变化'); skip++; continue; }

  if (DRY) { console.log('  [DRY] 将替换 1 处，未写入'); ok++; continue; }

  writeFileSync(j.file, patched, 'utf8');
  console.log(`  [OK] 已写入（${src.length} → ${patched.length} B）`);
  ok++;
}

console.log('\n' + '='.repeat(70));
console.log(`结果: 成功 ${ok} / 跳过 ${skip} / 失败 ${fail}`);
if (DRY) console.log('（DRY 模式：未实际写入）');
process.exit(0);
