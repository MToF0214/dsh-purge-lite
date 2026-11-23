# dsh-purge-lite

dsh-purge 1.1.71 的整合版：官方包原样保留，加三处我改过的补丁。

## 为什么有这个仓库

官方 1.1.71 里有几条补丁下手太重，在我的 0.2.0-rc.2 桌面端上副作用很明显：

- 工具结果修剪被整个关掉，长会话上下文一路涨，最后只能靠压缩收场；
- 重复调用提醒的两个 `ctx.on` 被整段删除，依赖钩子存在的代码路径会报错；
- 子代理深度从 3 抬到 10，递归起来收不住。

我没有回滚这些补丁，而是把它们改成「还起作用、但不至于失控」的版本，其余 70 多条保持原样。

## 改了什么

| 补丁 | 原版 | 这里 |
|---|---|---|
| #19 工具结果修剪 | `pruneContent` 直接 `return null`，完全禁用 | 保留修剪，阈值放宽 4 倍 |
| #18 重复调用提醒 | 两个 `ctx.on` 整段删除 | 钩子补回，只清理 chains，不注入提醒 |
| #23 子代理深度 | `default(10)` | `default(5)` |
| #21 bash 超时 | 目标文件不存在，实际从未生效 | 保持官方默认，不做改动 |

其余补丁与官方 1.1.71 一致。

## 怎么用

1. 按官方方式装插件；
2. 先 dry-run 看命中：

   ```bash
   node lite/apply-lite-to-host.mjs --dry-run
   ```

3. 确认没问题再正式跑：

   ```bash
   node lite/apply-lite-to-host.mjs
   ```

4. 三个目标文件 `node --check` 通过即可。

脚本是幂等的（已含 `[dsh-purge-lite]` 标记就跳过），找不到目标片段会跳过并报告，不会盲改。每个文件只改一处。

## 目录

```
lib/           插件本体（与官方 1.1.71 相同）
presets/       agent preset
skills/        skill
lite/          温和版脚本与执行记录
  apply-lite-to-host.mjs   三处替换
  check-purge-patches.mjs  补丁状态检查
  LITE-APPLIED.md          执行记录（含踩过的坑）
```

## 说明

- 基于官方 dsh-purge 1.1.71，MIT 许可；
- 不是官方仓库，出问题别找原作者。

## 出处

- 原作者：小杨（YuJunZhiXue），原仓库已删除；
- 官方原版镜像：https://github.com/mmparko/dsh-purge（全量镜像，含全部分支、tag 与提交历史）；
- 本仓库基于该镜像的 1.1.71 版本，加上面三处修正。

## 许可

MIT，见 [LICENSE](LICENSE)。

