#!/usr/bin/env python3
"""i18n 守卫 hook：组件开发时自动注入 i18n 规范，提交前拦截硬编码 UI 文案。

子命令（与 documentation_sync.py 同模式，stdin 收 hook 事件 JSON）：
- component-reminder  PostToolUse(Write|Edit)：库内 .vue 组件被改动 → 注入 i18n 规范上下文
- pre-commit          PreToolUse(Bash)：git commit → 扫 staged 的库内 .vue 模板区硬编码文案，发现即 block

逃生阀：确认非 UI 文案误报时 `I18N_ALLOW=1 git commit ...` 跳过检查。
规范正文见 .claude/skills/i18n/SKILL.md。
"""

import argparse
import json
import os
import re
import subprocess
import sys

# 守卫范围：组件库两包的 .vue（playground 的 pg 字典靠 reminder 约束，不做硬门禁）
VUE_RE = re.compile(r"packages/(vue|markdown)/src/.*\.vue$")
# 模板内硬编码文案两类信号：
# 1) 模板区出现中文字符（注释除外）
CJK_RE = re.compile(r"[一-鿿]")
# 2) 静态文案属性（title/placeholder/aria-label/alt/label="字面量"）；
#    绑定形式（:title="t(...)"）以 :/@/v- 开头，天然不匹配
STATIC_TEXT_ATTR_RE = re.compile(
    r'(?<![:@a-zA-Z-])(?:title|placeholder|aria-label|alt|label)\s*=\s*"([^"]*[A-Za-z一-鿿][^"]*)"'
)
COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
TEMPLATE_RE = re.compile(r"<template[^>]*>.*</template>", re.DOTALL)

REMINDER = (
    "【i18n 规范已生效】本次改动的是组件库 .vue 组件，必须遵循 .claude/skills/i18n/SKILL.md：\n"
    "1. UI 文案（placeholder/title/aria-label/按钮/空态/错误文案）禁止硬编码，"
    "进 packages/vue/src/locales/{zh-CN,en-US}.ts 字典，组件内用 aiChatI18n.global 的 t()\n"
    "2. zh-CN.ts 与 en-US.ts 同次提交同时更新（en-US satisfies MessageSchema，缺 key 编译报错）\n"
    "3. key 用 camelCase，namespace = 组件域；文本 props 用 props ?? t() 兜底，不写死默认值\n"
    "4. 若本次改动未新增任何 UI 文案（纯样式/逻辑），忽略本提醒"
)


def read_event():
    try:
        value = json.load(sys.stdin)
    except (json.JSONDecodeError, TypeError):
        return {}
    return value if isinstance(value, dict) else {}


def emit(payload):
    print(json.dumps(payload, ensure_ascii=False))


def repo_root():
    return subprocess.run(
        ["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True
    ).stdout.strip()


def scan_vue(path):
    """返回 (命中列表, 错误信息)。命中项为 (行号, 摘要)。文件不存在/读失败返回错误。"""
    try:
        content = open(path, encoding="utf-8").read()
    except OSError as e:
        return None, str(e)
    hits = []
    for m in TEMPLATE_RE.finditer(content):
        block = m.group(0)
        block_wo_comments = COMMENT_RE.sub("", block)
        # 行号按命中片段在原文件中的偏移折算
        offset = m.start()
        for i, line in enumerate(block_wo_comments.splitlines()):
            if CJK_RE.search(line):
                hits.append((offset_to_line(content, offset, i), f"中文字符：{line.strip()[:60]}"))
            for attr in STATIC_TEXT_ATTR_RE.finditer(line):
                hits.append(
                    (offset_to_line(content, offset, i), f"静态文案属性：{attr.group(0)[:60]}")
                )
    return hits, None


def offset_to_line(content, block_offset, line_idx_in_block):
    # 模板区去注释后行号可能与原文件有偏差，这里取近似：按原始块行偏移计算
    block_start_line = content.count("\n", 0, block_offset)
    return block_start_line + line_idx_in_block + 1


def component_reminder(event):
    tool_input = event.get("tool_input") or {}
    path = tool_input.get("file_path") or tool_input.get("notebook_path") or ""
    if not VUE_RE.search(path):
        return
    emit(
        {
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": REMINDER,
            },
            "suppressOutput": True,
        }
    )


def staged_vue_files(root):
    out = subprocess.run(
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return [
        line.strip()
        for line in out.splitlines()
        if line.strip() and VUE_RE.search(line.strip())
    ]


def pre_commit(event):
    command = event.get("tool_input", {}).get("command", "")
    if not re.search(r"\bgit\b[^\n;&|]*\bcommit\b", command or ""):
        return
    if os.environ.get("I18N_ALLOW") == "1":
        return

    root = repo_root()
    findings = []
    for rel in staged_vue_files(root):
        hits, err = scan_vue(os.path.join(root, rel))
        if err or not hits:
            continue
        for line, desc in hits[:5]:
            findings.append(f"- {rel}:{line} {desc}")

    if findings:
        emit(
            {
                "decision": "block",
                "reason": (
                    "检测到组件库 .vue 模板内的新硬编码 UI 文案（i18n 规范）：\n"
                    + "\n".join(findings)
                    + "\n\n请按 .claude/skills/i18n/SKILL.md 修复：文案进 "
                    "packages/vue/src/locales/{zh-CN,en-US}.ts 字典（双语同步），"
                    "组件内用 t()；静态属性改绑定形式 :title=\"t('xx.yy')\"。\n"
                    "若确认为非 UI 文案误报（如代码示例），可用 I18N_ALLOW=1 git commit 跳过本次检查。"
                ),
            }
        )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["component-reminder", "pre-commit", "scan-file"])
    parser.add_argument("path", nargs="?", help="scan-file 用的调试参数")
    args = parser.parse_args()

    if args.action == "scan-file":
        hits, err = scan_vue(args.path)
        if err:
            print(f"ERROR: {err}")
            sys.exit(1)
        for line, desc in hits or []:
            print(f"{line}: {desc}")
        return

    event = read_event()
    if args.action == "component-reminder":
        component_reminder(event)
    elif args.action == "pre-commit":
        pre_commit(event)


if __name__ == "__main__":
    main()
