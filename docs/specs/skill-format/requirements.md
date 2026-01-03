# SKILL.md 統一格式 需求規格

## 概述

統一 skillpkg 的 skill 格式，移除 `skill.yaml`，直接使用 `SKILL.md` 作為唯一格式。

**核心理念：一個格式走天下，減少轉換和認知負擔。**

## 目標

1. 移除 skill.yaml，統一使用 SKILL.md
2. 簡化 skill 開發流程
3. 與業界標準對齊 (Claude Code, Codex)
4. 減少 skillpkg 內部轉換邏輯

## 現況分析

### 問題

```
目前流程：
skill.yaml ──轉換──► SKILL.md ──複製──► .claude/skills/
    │                   │
    └─── 多餘的格式 ────┘
```

| 問題 | 影響 |
|------|------|
| 兩種格式 | 增加認知負擔 |
| 需要轉換 | 額外的程式碼維護 |
| 不一致 | 開發用 yaml，發布用 md |

### 目標狀態

```
目標流程：
SKILL.md ──────────直接複製──────────► .claude/skills/
```

## 功能需求

### FR-1: skillpkg init 改用 SKILL.md

```bash
skillpkg init
# 產生 SKILL.md（不是 skill.yaml）
```

產生的檔案：
```markdown
---
name: my-skill
version: 1.0.0
description: 簡短描述
---

# My Skill

在這裡寫 skill 的指令...
```

### FR-2: 支援讀取 SKILL.md

```bash
skillpkg install ./my-skill/
# 讀取 SKILL.md，安裝到 skillpkg.json
```

優先順序：
1. SKILL.md (新標準)
2. skill.yaml (向後相容)

### FR-3: 同步直接複製

```bash
skillpkg sync
# SKILL.md 直接複製到 .claude/skills/
# 不需要格式轉換
```

### FR-4: 向後相容 skill.yaml

```bash
# 仍可讀取舊的 skill.yaml
skillpkg install ./old-skill/
# 如果只有 skill.yaml，仍可使用

# 可選：提供遷移命令
skillpkg migrate
# 將 skill.yaml 轉換為 SKILL.md
```

### FR-5: GitHub 搜尋優化

```bash
skillpkg search "code review"
# 搜尋包含 SKILL.md 的 repo
# 不再搜尋 skill.yaml
```

## 非功能需求

### NFR-1: 相容性

- 保留 skill.yaml 讀取能力（至少一個版本週期）
- 新建 skill 一律用 SKILL.md
- 提供遷移指引

### NFR-2: 業界對齊

| 平台 | 格式 |
|------|------|
| Claude Code | SKILL.md |
| Codex | SKILL.md |
| skillpkg (新) | SKILL.md |

## SKILL.md 格式規範

### 必要欄位

```markdown
---
name: skill-name        # 必填：小寫、連字號
version: 1.0.0          # 必填：semver
description: 簡短描述    # 必填：一行說明
---

# Skill Title

指令內容...
```

### 可選欄位

```markdown
---
name: skill-name
version: 1.0.0
description: 簡短描述
author: Your Name
tags:
  - productivity
  - code-review
triggers:
  - pattern: "/review"
    description: "觸發程式碼審查"
dependencies:
  skills:
    - git-helper
  mcp:
    - name: github
      package: "@anthropic/mcp-server-github"
---
```

## 驗收標準

- [ ] `skillpkg init` 產生 SKILL.md
- [ ] `skillpkg install` 可讀取 SKILL.md
- [ ] `skillpkg sync` 直接複製 SKILL.md
- [ ] 向後相容 skill.yaml
- [ ] 文件更新說明新格式
