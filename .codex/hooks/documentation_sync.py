#!/usr/bin/env python3

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
STATE_DIR = ROOT / ".codex" / "run"
PATCH_PATH_RE = re.compile(r"^\*\*\* (?:Add|Update|Delete) File: (.+)$", re.MULTILINE)

DOC_LABELS = {
    "README.md": "项目概览 README.md",
    "packages/docs/guide/installation.md": "安装文档",
    "packages/docs/guide/getting-started.md": "快速开始文档",
    "packages/docs/guide/usage.md": "使用指南",
    "packages/docs/guide/theming.md": "主题文档",
    "packages/docs/composables/use-chat.md": "useChat 文档",
    "packages/docs/playground.md": "Playground 文档",
}

COMPONENT_DOCS = {
    "conversation": "packages/docs/components/conversation.md",
    "message": "packages/docs/components/message.md",
    "prompt-input": "packages/docs/components/prompt-input.md",
    "attachment": "packages/docs/components/attachments.md",
    "tool-call": "packages/docs/components/tool-call.md",
    "ChatWindow.vue": "packages/docs/components/chat-window.md",
    "MessageList.vue": "packages/docs/components/message-list.md",
    "MessageBubble.vue": "packages/docs/components/message-bubble.md",
    "InputArea.vue": "packages/docs/components/input-area.md",
    "StreamText.vue": "packages/docs/components/stream-text.md",
    "Button.vue": "packages/docs/components/button.md",
    "Shimmer.vue": "packages/docs/components/shimmer.md",
}

MARKDOWN_DOCS = {
    "MarkdownRenderer.vue": "packages/docs/components/markdown-renderer.md",
    "CodeBlock.vue": "packages/docs/components/code-block.md",
    "LatexBlock.vue": "packages/docs/components/latex-block.md",
    "MermaidBlock.vue": "packages/docs/components/markdown-renderer.md",
}


def run_git(*args):
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        return ""
    return result.stdout.strip()


def commit_exists(commit):
    if not commit:
        return False
    result = subprocess.run(
        ["git", "cat-file", "-e", f"{commit}^{{commit}}"],
        cwd=ROOT,
        capture_output=True,
        check=False,
    )
    return result.returncode == 0


def read_event():
    try:
        value = json.load(sys.stdin)
    except (json.JSONDecodeError, TypeError):
        return {}
    return value if isinstance(value, dict) else {}


def state_file(event=None):
    event = event or {}
    identifier = (
        event.get("session_id")
        or event.get("thread_id")
        or os.environ.get("CODEX_THREAD_ID")
        or "default"
    )
    safe_identifier = re.sub(r"[^A-Za-z0-9._-]+", "-", str(identifier))
    return STATE_DIR / f"documentation-sync-{safe_identifier}.json"


def load_state(event=None):
    try:
        value = json.loads(state_file(event).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return value if isinstance(value, dict) else {}


def save_state(state, event=None):
    target = state_file(event)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def relative_path(path, cwd=None):
    candidate = Path(path.strip())
    if not candidate.is_absolute():
        candidate = Path(cwd or ROOT) / candidate
    try:
        return candidate.resolve().relative_to(ROOT.resolve()).as_posix()
    except (OSError, ValueError):
        return ""


def event_paths(event):
    tool_input = event.get("tool_input") or {}
    candidates = []
    patch_texts = []

    if isinstance(tool_input, str):
        patch_texts.append(tool_input)
    elif isinstance(tool_input, dict):
        for key in ("file_path", "path"):
            if isinstance(tool_input.get(key), str):
                candidates.append(tool_input[key])
        for key in ("patch", "input", "content"):
            if isinstance(tool_input.get(key), str):
                patch_texts.append(tool_input[key])

    for patch_text in patch_texts:
        candidates.extend(PATCH_PATH_RE.findall(patch_text))

    cwd = event.get("cwd")
    if isinstance(tool_input, dict) and isinstance(tool_input.get("workdir"), str):
        cwd = tool_input["workdir"]

    paths = []
    for candidate in candidates:
        path = relative_path(candidate, cwd)
        if path and path not in paths:
            paths.append(path)
    return paths


def changed_files(baseline):
    changed = set()
    if commit_exists(baseline):
        changed.update(run_git("diff", "--name-only", baseline, "HEAD").splitlines())

    changed.update(run_git("diff", "--name-only").splitlines())
    changed.update(run_git("diff", "--cached", "--name-only").splitlines())
    changed.update(run_git("ls-files", "--others", "--exclude-standard").splitlines())
    return {path for path in changed if path}


def file_fingerprint(path):
    candidate = ROOT / path
    try:
        content = candidate.read_bytes()
    except FileNotFoundError:
        return "<deleted>"
    except OSError:
        return "<unreadable>"
    return hashlib.sha256(content).hexdigest()


def session_changed_files(state):
    files = changed_files(state.get("baseline", ""))
    initial_files = state.get("initial_files") or {}
    if not isinstance(initial_files, dict):
        return files
    return {
        path
        for path in files
        if path not in initial_files or file_fingerprint(path) != initial_files[path]
    }


def is_test_or_declaration(path):
    return (
        ".test." in path
        or ".spec." in path
        or path.endswith(".d.ts")
        or path.endswith("/env.d.ts")
    )


def expected_documentation(path):
    if is_test_or_declaration(path):
        return None

    if path in {"package.json", "pnpm-workspace.yaml"} or (
        path.startswith("packages/") and path.endswith("/package.json")
    ):
        return {
            "label": "安装和依赖说明",
            "docs": {"README.md", "packages/docs/guide/installation.md"},
        }

    if path == "pnpm-lock.yaml":
        return None

    if path.startswith("packages/core/src/"):
        return {
            "label": "@ai-chat/core 公共 API",
            "docs": {
                "README.md",
                "packages/docs/composables/use-chat.md",
                "packages/docs/guide/usage.md",
            },
        }

    if path.startswith("packages/vue/src/"):
        if path.startswith("packages/vue/src/styles/"):
            return {
                "label": "Design Token 与主题能力",
                "docs": {"README.md", "packages/docs/guide/theming.md"},
            }
        if path.endswith("packages/vue/src/index.ts"):
            return {
                "label": "@ai-chat/vue 导出清单",
                "docs": {"README.md", "packages/docs/guide/usage.md"},
                "prefixes": {"packages/docs/components/"},
            }
        if not path.endswith(".vue"):
            return None
        relative = path.removeprefix("packages/vue/src/")
        first = relative.split("/", 1)[0]
        filename = Path(path).name
        doc = COMPONENT_DOCS.get(first) or COMPONENT_DOCS.get(filename)
        if doc:
            return {"label": f"Vue 组件 {filename}", "docs": {doc}}
        return {
            "label": f"Vue 组件 {filename}",
            "docs": {"README.md", "packages/docs/guide/usage.md"},
            "prefixes": {"packages/docs/components/"},
        }

    if path.startswith("packages/markdown/src/"):
        filename = Path(path).name
        if path.endswith("packages/markdown/src/index.ts"):
            return {
                "label": "@ai-chat/markdown 导出清单",
                "docs": {"README.md", "packages/docs/guide/usage.md"},
                "prefixes": {"packages/docs/components/"},
            }
        if filename in MARKDOWN_DOCS:
            return {"label": f"Markdown 组件 {filename}", "docs": {MARKDOWN_DOCS[filename]}}
        if "/composables/" in path:
            return {
                "label": "Markdown 渲染行为",
                "docs": {"packages/docs/components/markdown-renderer.md"},
            }
        return None

    if path.startswith("packages/playground/src/") and not is_test_or_declaration(path):
        return {
            "label": "Playground 行为",
            "docs": {"packages/docs/playground.md"},
        }

    return None


def documentation_changes(paths):
    return {
        path
        for path in paths
        if path == "README.md"
        or path.startswith("packages/docs/")
        or path.startswith("docs/")
    }


def missing_documentation(paths):
    docs_changed = documentation_changes(paths)
    requirements = {}
    for path in sorted(paths):
        requirement = expected_documentation(path)
        if not requirement:
            continue
        key = requirement["label"]
        group = requirements.setdefault(
            key,
            {"sources": [], "docs": set(), "prefixes": set()},
        )
        group["sources"].append(path)
        group["docs"].update(requirement.get("docs", set()))
        group["prefixes"].update(requirement.get("prefixes", set()))

    missing = []
    for label, group in requirements.items():
        matched = bool(group["docs"] & docs_changed) or any(
            any(path.startswith(prefix) for prefix in group["prefixes"])
            for path in docs_changed
        )
        if not matched:
            missing.append({"label": label, **group})
    return missing


def format_requirement(requirement):
    source_sample = ", ".join(f"`{path}`" for path in requirement["sources"][:3])
    candidates = sorted(requirement["docs"])
    candidate_text = "、".join(
        f"`{path}`（{DOC_LABELS.get(path, '对应文档')}）" for path in candidates
    )
    if requirement["prefixes"]:
        prefixes = "、".join(f"`{prefix}*`" for prefix in sorted(requirement["prefixes"]))
        candidate_text = f"{candidate_text} 或 {prefixes}"
    return f"- {requirement['label']}：{source_sample}\n  建议同步：{candidate_text}"


def emit_context(event_name, message):
    print(
        json.dumps(
            {
                "systemMessage": message,
                "hookSpecificOutput": {
                    "hookEventName": event_name,
                    "additionalContext": message,
                },
            },
            ensure_ascii=False,
        )
    )


def tool_command(event):
    tool_input = event.get("tool_input") or {}
    if not isinstance(tool_input, dict):
        return ""
    command = tool_input.get("command") or tool_input.get("cmd")
    return command if isinstance(command, str) else ""


def block_message(missing):
    details = "\n".join(format_requirement(requirement) for requirement in missing)
    return (
        "检测到公共代码已修改，但没有找到对应文档更新：\n"
        f"{details}\n\n"
        "请继续完成以下任一项：\n"
        "1. 更新 README.md 或 packages/docs 下对应页面，并校准示例与 API；\n"
        "2. 若本次只是内部实现或不改变用户可见行为，运行 "
        "`python3 .codex/hooks/documentation_sync.py acknowledge --reason \"具体原因\"`。"
    )


def pre_commit(event):
    command = tool_command(event)
    if not re.search(r"\bgit\b[^\n;&|]*\bcommit\b", command):
        return

    state = load_state(event)
    missing = missing_documentation(session_changed_files(state))
    acknowledgement = state.get("acknowledgement", "").strip()
    if not missing or acknowledgement:
        return

    print(
        json.dumps(
            {
                "decision": "block",
                "reason": block_message(missing),
            },
            ensure_ascii=False,
        )
    )


def session_start(event):
    initial_paths = changed_files("")
    state = {
        "baseline": run_git("rev-parse", "HEAD"),
        "initial_files": {path: file_fingerprint(path) for path in initial_paths},
        "session_id": event.get("session_id") or event.get("thread_id") or "",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "acknowledgement": "",
    }
    save_state(state, event)
    emit_context(
        "SessionStart",
        "本项目启用了代码与文档同步门禁。修改公共 API、组件、使用方式或依赖后，"
        "收尾前必须同步 README/VitePress 对应页面；若确认没有文档影响，运行 "
        "`python3 .codex/hooks/documentation_sync.py acknowledge --reason \"原因\"` 记录判断。",
    )


def post_edit(event):
    requirements = [
        expected_documentation(path) for path in event_paths(event)
    ]
    requirements = [requirement for requirement in requirements if requirement]
    if not requirements:
        return
    labels = "、".join(sorted({requirement["label"] for requirement in requirements}))
    emit_context(
        "PostToolUse",
        f"检测到可能影响文档的代码修改：{labels}。完成实现后请同步 README 或 VitePress 对应页面，"
        "并确保示例、API、props/events、安装方式与实际代码一致。",
    )


def acknowledge(reason):
    state = load_state()
    if not state:
        state = {"baseline": run_git("rev-parse", "HEAD")}
    state["acknowledgement"] = reason.strip()
    state["acknowledged_at"] = datetime.now(timezone.utc).isoformat()
    save_state(state)
    print(f"已记录本次无需更新文档：{state['acknowledgement']}")


def session_end(_event):
    state = load_state(_event)
    files = session_changed_files(state)
    missing = missing_documentation(files)
    if not missing:
        return

    acknowledgement = state.get("acknowledgement", "").strip()
    if acknowledgement:
        print(
            json.dumps(
                {
                    "systemMessage": f"代码与文档同步检查已按显式判断放行：{acknowledgement}"
                },
                ensure_ascii=False,
            )
        )
        return

    reason = block_message(missing)
    print(
        json.dumps(
            {
                "continue": False,
                "stopReason": reason,
                "systemMessage": "代码与文档同步门禁未通过，请补充文档或记录无需更新的理由。",
            },
            ensure_ascii=False,
        )
    )


def check():
    state = load_state()
    files = session_changed_files(state)
    missing = missing_documentation(files)
    if not missing:
        print("代码与文档同步检查通过。")
        return 0
    for requirement in missing:
        print(format_requirement(requirement))
    return 1


def main():
    parser = argparse.ArgumentParser(description="ai-chat-ui 代码与文档同步 hook")
    subparsers = parser.add_subparsers(dest="action", required=True)
    subparsers.add_parser("pre-commit")
    subparsers.add_parser("session-start")
    subparsers.add_parser("post-edit")
    subparsers.add_parser("session-end")
    subparsers.add_parser("check")
    acknowledge_parser = subparsers.add_parser("acknowledge")
    acknowledge_parser.add_argument("--reason", required=True)
    args = parser.parse_args()

    event = (
        read_event()
        if args.action in {"pre-commit", "session-start", "post-edit", "session-end"}
        else {}
    )
    if args.action == "pre-commit":
        pre_commit(event)
    elif args.action == "session-start":
        session_start(event)
    elif args.action == "post-edit":
        post_edit(event)
    elif args.action == "session-end":
        session_end(event)
    elif args.action == "acknowledge":
        acknowledge(args.reason)
    elif args.action == "check":
        raise SystemExit(check())


if __name__ == "__main__":
    main()
