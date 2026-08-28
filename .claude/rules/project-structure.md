# 包目录组织规则

> 适用范围：`packages/` 下全部包。规范包内目录组织与测试文件位置，所有新包、新模块、新测试必须遵守。规格见 `docs/superpowers/spec/15-包目录组织重构-20260828.md`。

## 1. 统一包结构

每个包必须遵循：

```
packages/<pkg>/
├── src/               # 纯源码，零测试文件
│   ├── index.ts       # 包入口
│   └── <module>/      # 功能模块目录
├── __tests__/         # 与 src 平级，内部镜像 src 结构
│   └── <module>/
│       └── foo.test.ts
├── vite.config.ts
└── package.json
```

## 2. 测试文件位置（强制）

- 测试文件统一放 `packages/<pkg>/__tests__/`，**禁止与源码混放在 `src/` 内**
- `__tests__/` 内部目录结构**镜像 `src/`**：`src/composables/useTheme.ts` 的测试是 `__tests__/composables/useTheme.test.ts`
- 源码在 src 根级的，其测试放 `__tests__/` 根级
- 测试内相对导入指向源码（如 `../../src/composables/useTheme`）；`@toimc/*` 别名导入不受此影响
- 根级 `tests/setup.ts`（Vitest 全局 setup）与 `e2e/`（Playwright）不属于包测试，位置不变

## 3. src 内模块组织原则

- src 根只留三类文件：`index.ts`（包入口）、`env.d.ts`（环境声明）、包级公共 `types.ts`
- **同类职责文件 ≥2 个才成组归目录，禁止一文一目录**（避免过度碎片化）
- 模块目录按功能命名（`composables/`、`message/`、`routes/` 等），不按技术分层重复拆分
- deprecated 组件集中放 `src/deprecated/`，注释标注替代方案，版本删除时整目录移除
- 新增文件先看是否已有归属模块目录，有则归入，无则评估是否与既有根级文件同类

## 4. 配套配置约定

- `vitest.config.ts`（根级单配置）：`include` 只认 `packages/*/__tests__/**`
- 各包 `tsconfig.json`：`include` 必须含 `__tests__`（保证 type-check 覆盖测试）；不设 `rootDir`（构建走 vite lib mode）
- 覆盖率统计范围为 `packages/*/src/**`，与 `__tests__` 天然隔离

## 5. 新包脚手架检查清单

- [ ] `src/index.ts` 入口存在，公共导出集中于此
- [ ] `__tests__/` 目录已建（即使暂时为空）
- [ ] `tsconfig.json` include 含 `src` 与 `__tests__`，无 rootDir
- [ ] 根 `vitest.config.ts` 的 alias 若需源码解析已登记

## 6. 提交前自查

- [ ] `find packages -path '*/src/*' -name '*.test.ts'` 为空（src 内零测试）
- [ ] 新增测试在 `__tests__/` 的镜像位置
- [ ] 新增源码不在 src 根散放（除非 index.ts/env.d.ts/types.ts）
