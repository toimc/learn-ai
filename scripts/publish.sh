#!/bin/bash
# AI Chat UI 组件库发布脚本
# 支持手动版本模式和 changeset 自动模式

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示帮助信息
show_help() {
    cat << EOF
AI Chat UI 组件库发布脚本

用法:
    ./scripts/publish.sh [选项]

选项:
    -m, --manual VERSION      手动指定版本号 (如: 1.0.0)
    -c, --changeset          使用 changeset 模式 (自动生成 CHANGELOG)
    -t, --tag TAG            添加 git tag (如: v1.0.0)
    -d, --dry-run            模拟运行，不实际发布
    -h, --help               显示帮助信息

环境变量:
    NPM_TOKEN                npm 认证 token (必需)
    NPM_REGISTRY            npm registry 地址 (默认: https://registry.npmjs.org)

示例:
    # 手动发布版本 1.0.0
    NPM_TOKEN=xxx ./scripts/publish.sh -m 1.0.0

    # 使用 changeset 模式发布
    NPM_TOKEN=xxx ./scripts/publish.sh -c

    # 模拟运行
    NPM_TOKEN=xxx ./scripts/publish.sh -m 1.0.0 -d

EOF
}

# 参数解析
MANUAL_VERSION=""
USE_CHANGESET=false
GIT_TAG=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -m|--manual)
            MANUAL_VERSION="$2"
            shift 2
            ;;
        -c|--changeset)
            USE_CHANGESET=true
            shift
            ;;
        -t|--tag)
            GIT_TAG="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "未知参数: $1"
            show_help
            exit 1
            ;;
    esac
done

# 检查环境变量
if [ -z "$NPM_TOKEN" ]; then
    log_error "NPM_TOKEN 环境变量未设置"
    exit 1
fi

# 配置
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org}"
PACKAGES=("core" "vue" "markdown")

# 进入项目根目录
cd "$(dirname "$0")/.."
ROOT_DIR=$(pwd)
log_info "项目根目录: $ROOT_DIR"

# 检查 git 工作区状态
check_git_status() {
    log_info "检查 git 工作区状态..."
    if [ -n "$(git status --porcelain)" ]; then
        log_error "工作区有未提交的更改，请先提交或暂存"
        git status --short
        exit 1
    fi
    log_success "Git 工作区干净"
}

# 设置 npm 认证
setup_npm_auth() {
    log_info "配置 npm 认证..."
    if [ "$DRY_RUN" = false ]; then
        npm config set registry "$NPM_REGISTRY"
        npm config set "//registry.npmjs.org/:_authToken" "$NPM_TOKEN"
        npm config set registry "$NPM_REGISTRY"
        log_success "npm 认证配置完成"
    else
        log_info "DRY_RUN: 跳过 npm 认证配置"
    fi
}

# 使用 changeset 管理版本
run_changeset() {
    log_info "使用 changeset 管理版本..."

    # 检查 changeset 是否安装
    if ! command -v changeset &> /dev/null; then
        log_info "安装 changeset..."
        if [ "$DRY_RUN" = false ]; then
            pnpm add -D -w @changesets/cli
        else
            log_info "DRY_RUN: 跳过安装 changeset"
        fi
    fi

    # 初始化 changeset（如果未初始化）
    if [ ! -f ".changeset/config.json" ]; then
        log_info "初始化 changeset..."
        if [ "$DRY_RUN" = false ]; then
            pnpm changeset init
        else
            log_info "DRY_RUN: 跳过 changeset 初始化"
        fi
    fi

    # 创建 changeset
    log_info "创建 changeset..."
    if [ "$DRY_RUN" = false ]; then
        pnpm changeset
    else
        log_info "DRY_RUN: 跳过创建 changeset"
    fi

    # 更新版本
    log_info "更新版本..."
    if [ "$DRY_RUN" = false ]; then
        pnpm changeset version
    else
        log_info "DRY_RUN: 跳过版本更新"
    fi

    log_success "Changeset 处理完成"
}

# 手动更新版本号
manual_version() {
    local version=$1
    log_info "手动设置版本: $version"

    for pkg in "${PACKAGES[@]}"; do
        local pkg_file="packages/$pkg/package.json"
        log_info "更新 $pkg 版本为 $version"
        if [ "$DRY_RUN" = false ]; then
            jq --arg version "$version" '.version = $version' "$pkg_file" > "$pkg_file.tmp"
            mv "$pkg_file.tmp" "$pkg_file"
        else
            log_info "DRY_RUN: 跳过更新 $pkg 版本"
        fi
    done

    log_success "版本更新完成"
}

# 构建所有包
build_packages() {
    log_info "构建所有包..."
    if [ "$DRY_RUN" = false ]; then
        pnpm build
    else
        log_info "DRY_RUN: 跳过构建"
    fi
    log_success "构建完成"
}

# 运行测试
run_tests() {
    log_info "运行测试..."
    if [ "$DRY_RUN" = false ]; then
        pnpm test
        pnpm type-check
    else
        log_info "DRY_RUN: 跳过测试"
    fi
    log_success "测试通过"
}

# 发布单个包
publish_package() {
    local pkg=$1
    local pkg_dir="packages/$pkg"
    local pkg_name=$(jq -r '.name' "$pkg_dir/package.json")
    local version=$(jq -r '.version' "$pkg_dir/package.json")

    log_info "发布 $pkg_name@$version"

    if [ "$DRY_RUN" = false ]; then
        cd "$pkg_dir"
        npm publish --access public
        cd "$ROOT_DIR"
    else
        log_info "DRY_RUN: 跳过发布 $pkg_name"
    fi

    log_success "$pkg_name 发布成功"
}

# 发布所有包
publish_all() {
    log_info "开始发布包..."

    # 按依赖顺序发布
    for pkg in "${PACKAGES[@]}"; do
        publish_package "$pkg"
    done

    log_success "所有包发布完成"
}

# 创建 git tag
create_git_tag() {
    if [ -n "$GIT_TAG" ]; then
        log_info "创建 git tag: $GIT_TAG"
        if [ "$DRY_RUN" = false ]; then
            git tag -a "$GIT_TAG" -m "Release $GIT_TAG"
            git push origin "$GIT_TAG"
        else
            log_info "DRY_RUN: 跳过创建 git tag"
        fi
        log_success "Git tag 创建完成"
    fi
}

# 主流程
main() {
    log_info "========================================="
    log_info "AI Chat UI 组件库发布流程"
    log_info "========================================="

    if [ "$DRY_RUN" = true ]; then
        log_warn "DRY_RUN 模式：不会实际发布"
    fi

    # 1. 检查 git 状态
    check_git_status

    # 2. 设置 npm 认证
    setup_npm_auth

    # 3. 版本管理
    if [ "$USE_CHANGESET" = true ]; then
        run_changeset
    elif [ -n "$MANUAL_VERSION" ]; then
        manual_version "$MANUAL_VERSION"
    else
        log_error "请指定 --manual VERSION 或 --changeset"
        show_help
        exit 1
    fi

    # 4. 构建所有包
    build_packages

    # 5. 运行测试
    run_tests

    # 6. 发布所有包
    publish_all

    # 7. 创建 git tag
    create_git_tag

    log_success "========================================="
    log_success "发布流程完成！"
    log_success "========================================="

    if [ "$DRY_RUN" = false ]; then
        log_info "请在 GitHub 上创建 Release 页面"
    fi
}

# 执行主流程
main