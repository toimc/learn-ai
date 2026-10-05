#!/usr/bin/env bash
# tidy scan — 只读扫描垃圾分布（tidy skill 专用）。
# 铁律：本脚本绝不删除/修改任何文件；任何情况下不得向其加入删除类命令。
# 兼容 macOS(bash 3.2/BSD) 与 Linux；路径含中文/空格安全。
set -euo pipefail

PROJ="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CH="$HOME/.claude"

# ---------- 工具函数 ----------
if stat -f%z / >/dev/null 2>&1; then
  statfmt() { stat -f%z "$1"; }
else
  statfmt() { stat -c%s "$1"; }
fi

human() {
  awk -v b="${1:-0}" 'BEGIN{
    split("B KB MB GB TB",u," "); i=1
    while (b>=1024 && i<5){b/=1024;i++}
    if (i==1) printf "%d B",b; else printf "%.1f %s",b,u[i]
  }'
}

dir_bytes() { # 目录（du -sk 换算）或单文件的字节；不存在输出 0
  local kb
  if [ -f "$1" ]; then
    statfmt "$1" 2>/dev/null || echo 0
  elif [ -d "$1" ]; then
    kb=$(du -sk "$1" 2>/dev/null | cut -f1)
    echo $(( ${kb:-0} * 1024 ))
  else
    echo 0
  fi
}

find_bytes() { # stdin 收 find -print0 流，累加字节
  local total=0 f b
  while IFS= read -r -d '' f; do
    b=$(statfmt "$f" 2>/dev/null || echo 0)
    total=$(( total + b ))
  done
  echo "$total"
}

row() { printf '  %-52s %10s\n' "$1" "$2"; }
hr()  { printf '%s\n' "------------------------------------------------------------"; }

A_TOTAL=0
B_TOTAL=0
addA() { A_TOTAL=$(( A_TOTAL + $1 )); }
addB() { B_TOTAL=$(( B_TOTAL + $1 )); }

# ---------- 项目层 ----------
echo "== 项目层 ==  $PROJ"
hr

b=$(dir_bytes "$PROJ/.temp")
row "A  .temp/" "$(human "$b")"; addA "$b"

b=$(dir_bytes "$PROJ/.playwright-mcp")
row "A  .playwright-mcp/" "$(human "$b")"; addA "$b"

if [ -d "$PROJ/.claude/worktrees" ] && [ -n "$(ls -A "$PROJ/.claude/worktrees" 2>/dev/null)" ]; then
  printf '  B  worktrees（须 git worktree remove，勿直接删目录）:\n'
  git -C "$PROJ" worktree list --porcelain 2>/dev/null | awk '
    /^worktree /{ path=substr($0, 9) }
    /^branch /{ printf "     %-46s %s\n", path, substr($0, 8) }
  '
  b=$(dir_bytes "$PROJ/.claude/worktrees"); addB "$b"
fi

printf '  B  git 未追踪的散落截图/日志：\n'
found_untracked=0
git -C "$PROJ" status --porcelain -z 2>/dev/null | while IFS= read -r -d '' entry; do
  st="${entry:0:2}"; p="${entry:3}"
  [ "$st" = "??" ] || continue
  case "$p" in
    *.png|*.jpg|*.jpeg|*.gif|*.webp|*.log|*.tmp|*.har)
      if [ -f "$PROJ/$p" ]; then
        printf '     %-46s %10s\n' "$p" "$(human "$(statfmt "$PROJ/$p")")"
      fi ;;
  esac
done

if [ -d "$PROJ/packages" ]; then
  printf '  B  构建产物 dist/：\n'
  for d in "$PROJ"/packages/*/dist; do
    [ -d "$d" ] || continue
    b=$(dir_bytes "$d"); addB "$b"
    row "     ${d#"$PROJ"/}" "$(human "$b")"
  done
fi

# ---------- ~/.claude 层 ----------
echo
echo "== ~/.claude 会话层 ==  $CH"
hr

b=$(dir_bytes "$CH/telemetry")
row "A  telemetry/" "$(human "$b")"; addA "$b"

b=$(dir_bytes "$CH/paste-cache")
row "A  paste-cache/" "$(human "$b")"; addA "$b"

if [ -d "$CH/shell-snapshots" ]; then
  b=$(find "$CH/shell-snapshots" -type f -mtime +7 -print0 2>/dev/null | find_bytes)
  row "A  shell-snapshots/ (>7天)" "$(human "$b")"; addA "$b"
fi

if [ -f "$CH/history.jsonl" ]; then
  b=$(statfmt "$CH/history.jsonl")
  row "B  history.jsonl（建议跳过）" "$(human "$b")"; addB "$b"
fi

if [ -d "$CH/file-history" ]; then
  b=$(find "$CH/file-history" -type f -mtime +30 -print0 2>/dev/null | find_bytes)
  row "B  file-history/ (>30天，影响 rewind)" "$(human "$b")"; addB "$b"
fi

b=$(dir_bytes "$CH/jobs")
row "B  jobs/（建议跳过）" "$(human "$b")"; addB "$b"

if [ -d "$CH/projects" ]; then
  b=$(find "$CH/projects" -name '*.jsonl' -mtime +30 -not -path '*/memory/*' -print0 2>/dev/null | find_bytes)
  n=$(find "$CH/projects" -name '*.jsonl' -mtime +30 -not -path '*/memory/*' -print0 2>/dev/null | tr -dc '\0' | wc -c | tr -d ' ')
  row "B  projects 旧会话 jsonl (>30天，${n}个)" "$(human "$b")"
  b=$(find "$CH/projects" -name '*.jsonl' -mtime +90 -not -path '*/memory/*' -print0 2>/dev/null | find_bytes)
  n=$(find "$CH/projects" -name '*.jsonl' -mtime +90 -not -path '*/memory/*' -print0 2>/dev/null | tr -dc '\0' | wc -c | tr -d ' ')
  row "B  projects 旧会话 jsonl (>90天，${n}个)" "$(human "$b")"; addB "$b"

  printf '  B  projects 体积 top10（含全部数据，删前看上面 jsonl 口径）：\n'
  du -sm "$CH/projects"/*/ 2>/dev/null | sort -rn | head -10 | while read -r m p; do
    printf '     %-46s %6s MB\n' "${p#"$CH/projects"/}" "$m"
  done
fi

# ---------- memory 与多 CLI 层 ----------
echo
echo "== memory 与多 CLI =="
hr

CM="$HOME/.claude-mem"
if [ -d "$CM" ]; then
  printf '  claude-mem：\n'
  b=$(dir_bytes "$CM/logs"); row "A  logs/（观察者日志）" "$(human "$b")"; addA "$b"
  b=$(dir_bytes "$CM/claude-mem.db"); row "-  claude-mem.db（记忆库本体，默认保留）" "$(human "$b")"
  b=$(dir_bytes "$CM/chroma"); row "-  chroma/（向量索引，异常大再重建）" "$(human "$b")"
fi

CX="$HOME/.codex"
if [ -d "$CX" ]; then
  printf '  Codex：\n'
  b=$(dir_bytes "$CX/memories"); row "M  memories/（内容压缩对象）" "$(human "$b")"
  b=$(dir_bytes "$CX/log"); row "A  log/" "$(human "$b")"; addA "$b"
  b=$(dir_bytes "$CX/tmp"); row "A  tmp/" "$(human "$b")"; addA "$b"
  if [ -d "$CX/shell_snapshots" ]; then
    b=$(find "$CX/shell_snapshots" -type f -mtime +7 -print0 2>/dev/null | find_bytes)
    row "A  shell_snapshots/ (>7天)" "$(human "$b")"; addA "$b"
  fi
  if [ -d "$CX/sessions" ]; then
    b=$(find "$CX/sessions" -name '*.jsonl' -mtime +30 -print0 2>/dev/null | find_bytes)
    n=$(find "$CX/sessions" -name '*.jsonl' -mtime +30 -print0 2>/dev/null | tr -dc '\0' | wc -c | tr -d ' ')
    row "B  sessions jsonl (>30天，${n}个)" "$(human "$b")"; addB "$b"
  fi
  nb=$(ls "$CX"/*.bak* 2>/dev/null | wc -l | tr -d ' ')
  if [ "$nb" -gt 0 ]; then
    row "B  *.bak* 备份 ${nb} 个（auth 备份含凭证，删更安全）" ""
  fi
  sq=$(find "$CX" -maxdepth 1 -name '*.sqlite*' -print0 2>/dev/null | find_bytes)
  row "-  thread_history/logs 等 sqlite（默认保留）" "$(human "$sq")"
fi

for d in "$HOME/.gemini" "$HOME/.cursor"; do
  if [ -d "$d" ]; then
    row "探测  ${d#"$HOME"/}（仅列体积，默认不动）" "$(human "$(dir_bytes "$d")")"
  fi
done

if [ -d "$CH/projects" ]; then
  printf '  Claude auto-memory（体积 top8 + 死链/孤儿检测）：\n'
  du -sm "$CH/projects"/*/memory/ 2>/dev/null | sort -rn | head -8 | while read -r m p; do
    proj="${p#"$CH/projects"/}"; proj="${proj%/memory/}"
    dead=0; orph=0; idx="$p/MEMORY.md"
    if [ -f "$idx" ]; then
      while IFS= read -r f; do
        [ -f "$p/$f" ] || dead=$((dead+1))
      done < <(grep -o '\]([^)]*\.md)' "$idx" 2>/dev/null | sed 's/^](//;s/)$//' | sort -u)
      for f in "$p"/*.md; do
        b_=$(basename "$f"); [ "$b_" = "MEMORY.md" ] && continue
        grep -q "($b_)" "$idx" 2>/dev/null || orph=$((orph+1))
      done
    fi
    printf '     %-40s %5s MB  死链%s/孤儿%s\n' "$proj" "$m" "$dead" "$orph"
  done
fi

# ---------- 汇总 ----------
echo
hr
printf 'A 级（安全直删）合计：%s\n' "$(human "$A_TOTAL")"
printf 'B 级（需确认）合计：%s\n' "$(human "$B_TOTAL")"
printf '总计可释放（A+B）：%s\n' "$(human "$(( A_TOTAL + B_TOTAL ))")"
echo "C 级红线（永不删）：.git .env* node_modules ~/.claude/{plugins,skills,memory,settings*,CLAUDE.md} projects/*/memory/"
