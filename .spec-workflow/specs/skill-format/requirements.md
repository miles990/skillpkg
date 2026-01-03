# SKILL.md 統一格式 - 需求規格

## 概述

統一 skillpkg 的 skill 定義格式，**只使用 SKILL.md**，移除 skill.yaml 支援。
新增 `skillpkg new` 命令用於建立新 skill。

**核心理念：一個格式，零轉換，與業界標準對齊。**

## 問題陳述

### 現況
- parser.ts 解析 skill.yaml（YAML 格式）
- 但業界標準是 SKILL.md（Markdown + frontmatter）
- 與 Claude Code / Codex 實際格式不一致

### 目標
- 只使用 SKILL.md 格式
- 新增 `skillpkg new` 命令建立 skill
- 移除所有 skill.yaml 相關程式碼

## 使用者故事

### US-1: Skill 開發者
**As a** skill 開發者
**I want to** 用 `skillpkg new` 快速建立 SKILL.md
**So that** 我的 skill 格式與 Claude Code 完全一致

**驗收標準:**
- `skillpkg new my-skill` 產生 SKILL.md
- 產生的 SKILL.md 可直接被 Claude Code 使用
- 不需要任何格式轉換

## 功能需求

### FR-1: skillpkg new 命令

```bash
# 在當前目錄建立 SKILL.md
skillpkg new

# 建立新目錄並產生 SKILL.md
skillpkg new my-skill
→ 建立 my-skill/SKILL.md

# 互動式
skillpkg new -i
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

### FR-2: 只讀取 SKILL.md

```bash
skillpkg install ./my-skill/
# 只讀取 SKILL.md
# 若無 SKILL.md 則報錯
```

### FR-3: sync 直接複製

```bash
skillpkg sync
# SKILL.md 直接複製到 .claude/skills/
# 零轉換
```

### FR-4: search 搜尋 SKILL.md

```bash
skillpkg search "code review"
# 搜尋包含 SKILL.md 的 GitHub repo
```

## 命令結構

```bash
skillpkg init           # 專案配置 → skillpkg.json
skillpkg init -i        # 互動式專案配置
skillpkg new [name]     # 新建 skill → SKILL.md
skillpkg new -i         # 互動式新建 skill
```

## SKILL.md 格式規範

### 必填欄位
```markdown
---
name: skill-name        # 小寫、連字號
version: 1.0.0          # semver 格式
description: 簡短描述    # 一行說明
---
```

### 可選欄位
```markdown
---
author: Your Name
tags:
  - productivity
dependencies:
  mcp:
    - name: github
      package: "@anthropic/mcp-server-github"
---
```

## 非功能需求

### NFR-1: 破壞性變更
- 不再支援 skill.yaml
- v0.5.0 發布說明需標註 Breaking Change

### NFR-2: 業界對齊

| 平台 | 格式 |
|------|------|
| Claude Code | SKILL.md |
| Codex | SKILL.md |
| skillpkg | SKILL.md |

## 驗收標準

- [ ] `skillpkg new` 產生 SKILL.md
- [ ] `skillpkg new my-skill` 建立目錄並產生 SKILL.md
- [ ] `skillpkg install` 只讀取 SKILL.md
- [ ] `skillpkg sync` 直接複製 SKILL.md
- [ ] 移除所有 skill.yaml 相關程式碼
- [ ] README.md 更新說明

## 範圍外

- 不涉及 skillpkg.json 結構（由 init 處理）
- 不涉及 MCP 配置管理
