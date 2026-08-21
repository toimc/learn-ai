#!/bin/bash
# 发布流程测试脚本（不实际发布）

set -e

echo "========================================="
echo "发布流程测试"
echo "========================================="

# 1. 检查环境
echo "1. 检查环境..."
if command -v jq &> /dev/null; then
    echo "✓ jq 已安装"
else
    echo "✗ jq 未安装，请先安装: brew install jq"
    exit 1
fi

if command -v pnpm &> /dev/null; then
    echo "✓ pnpm 已安装"
else
    echo "✗ pnpm 未安装"
    exit 1
fi

# 2. 检查包配置
echo ""
echo "2. 检查包配置..."
packages=("core" "vue" "markdown")
for pkg in "${packages[@]}"; do
    if [ -f "packages/$pkg/package.json" ]; then
        name=$(jq -r '.name' "packages/$pkg/package.json")
        version=$(jq -r '.version' "packages/$pkg/package.json")
        echo "✓ $name: $version"
    else
        echo "✗ packages/$pkg/package.json 不存在"
        exit 1
    fi
done

# 3. 检查构建状态
echo ""
echo "3. 检查构建状态..."
for pkg in "${packages[@]}"; do
    if [ -d "packages/$pkg/dist" ]; then
        echo "✓ $pkg/dist 已构建"
    else
        echo "✗ $pkg/dist 未构建，请先运行: pnpm build"
        exit 1
    fi
done

# 4. 检查 git 状态
echo ""
echo "4. 检查 git 状态..."
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠ 工作区有未提交的更改："
    git status --short
else
    echo "✓ Git 工作区干净"
fi

# 5. 模拟版本更新
echo ""
echo "5. 模拟版本更新..."
test_version="0.0.2-test"
for pkg in "${packages[@]}"; do
    pkg_file="packages/$pkg/package.json"
    current_version=$(jq -r '.version' "$pkg_file")
    echo "  $pkg: $current_version → $test_version"
done

# 6. 检查 npm 认证状态（不使用真实 token）
echo ""
echo "6. 检查 npm 配置..."
if [ -z "$NPM_TOKEN" ]; then
    echo "⚠ NPM_TOKEN 未设置（测试模式正常）"
else
    echo "✓ NPM_TOKEN 已设置"
fi

echo ""
echo "========================================="
echo "测试完成！所有检查项："
echo "✓ 环境依赖"
echo "✓ 包配置"
echo "✓ 构建状态"
echo "✓ Git 状态"
echo "✓ 版本管理"
echo "========================================="
echo ""
echo "可以执行实际发布："
echo "  NPM_TOKEN=your_token ./scripts/publish.sh -m 0.0.2"
echo ""
echo "或使用 changeset 模式："
echo "  pnpm changeset"
echo "  NPM_TOKEN=your_token ./scripts/publish.sh -c"