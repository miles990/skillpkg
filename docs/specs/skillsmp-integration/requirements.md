# Skills Registry 整合需求規格

## 概述

讓 AI 可以從多個來源搜尋、發現、分析 SKILL.md，並決定直接使用或參考建立新 skill。

## 核心理念

```
┌─────────────────────────────────────────────────────────────────┐
│  AI 驅動的 Skill Discovery                                     │
│                                                                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │  搜尋發現   │ ──→ │  分析學習   │ ──→ │  決策行動   │       │
│  │             │     │             │     │             │       │
│  │ • local     │     │ • 讀取內容  │     │ A. 直接安裝 │       │
│  │ • awesome   │     │ • 理解結構  │     │ B. 改造使用 │       │
│  │ • github    │     │ • 學習模式  │     │ C. 參考建新 │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
│                                                                 │
│  重點：MCP 工具給 AI 用，CLI 只顯示結果                         │
└─────────────────────────────────────────────────────────────────┘
```

## 資料來源

### 來源優先順序

```
┌─────────────────────────────────────────────────────────────────┐
│  有 API Key：  local → skillsmp (40K+) → github                 │
│  無 API Key：  local → awesome (~30) → github                   │
└─────────────────────────────────────────────────────────────────┘
```

| 優先級 | 來源 | 數量 | 需要 API Key | 說明 |
|--------|------|------|--------------|------|
| 1 | `local` | 已安裝 | ❌ | 永遠優先 |
| 2 | `skillsmp` | 40,000+ | ✅ | **主要來源** |
| 2 | `awesome` | ~30 | ❌ | 無 Key 時的 fallback |
| 3 | `github` | 不定 | ❌ | 補充搜尋 |

### Skillsmp.com (主要來源)

全球最大 skill registry，40,000+ skills，支援 AI 組合學習：

```
API: https://skillsmp.com/api/v1/skills/search
認證: Authorization: Bearer sk_live_xxx
```

**首次設定（一次性）**：
```bash
skillpkg config set skillsmp.apiKey sk_live_xxx
```

### Awesome Repos (Fallback)

無 API Key 時的備選來源：

| Repo | 說明 |
|------|------|
| `anthropics/skills` | 官方範例 |
| `ComposioHQ/awesome-claude-skills` | 社群精選 |

### GitHub Topic 搜尋 (補充)

用 `topic:claude-skill` 搜尋，作為補充來源。

## 功能需求

### FR-1: 子目錄 SKILL.md 支援 ✅ 已完成

**描述**：支援 `github:user/repo#path/to/skill` 格式

**驗收標準**：
- [x] 支援 `github:user/repo#path` 格式
- [x] fetcher 可從指定路徑取得 SKILL.md
- [x] 安裝後正確記錄完整 source URL

### FR-2: 多來源搜尋

**描述**：AI 可同時搜尋多個來源

**驗收標準**：
- [ ] 支援 local (已安裝) 搜尋
- [ ] 支援 awesome repos 搜尋
- [ ] 支援 GitHub topic 搜尋 (補充)
- [ ] 結果包含可安裝的 source URL

**MCP 工具**：
```typescript
search_skills({
  query: "git commit helper",
  sources: ["local", "awesome", "github"],  // 可選，預設 local+awesome
  limit: 20
})
// 返回: SkillInfo[] 包含 name, description, source, stars, found_in
```

### FR-3: Skill 內容抓取

**描述**：AI 可讀取任意 SKILL.md 的完整內容

**驗收標準**：
- [ ] 給定 source URL，返回 SKILL.md 原始內容
- [ ] 支援 GitHub repo (含 subpath)
- [ ] 支援已安裝的 local skills
- [ ] 返回解析後的 metadata

**MCP 工具**：
```typescript
fetch_skill_content({
  source: "github:user/repo#path"
})
// 返回: { content: string, metadata: {...} }
```

### FR-4: 去重機制

**描述**：同一 skill 出現在多個 awesome repos 時自動去重

**驗收標準**：
- [ ] 使用 normalized source URL 作為去重 key
- [ ] 保留 `found_in` 資訊（出現在哪些 repos）
- [ ] 返回 `duplicates_removed` 數量

### FR-5: CLI 結果顯示

**描述**：CLI 只顯示搜尋結果

**驗收標準**：
- [ ] `skillpkg search <query>` 顯示結果列表
- [ ] 結果包含 source URL 可直接複製安裝
- [ ] 顯示去重數量和 `Also in:` 資訊

**範例**：
```bash
$ skillpkg search "git commit"

Found 5 skills (2 duplicates removed):

  git-helper         ⭐120
  Git operations and commit message helper
  github:alice/tools#git-helper
  Also in: travisvn/awesome-claude-skills

  conventional-commits  ⭐85
  Conventional commit format
  github:bob/repo

Install: skillpkg install <source>
```

## 非功能需求

### NFR-1: AI 優先

- MCP 工具是主要介面
- CLI 是輔助，只顯示結果
- 過程由 AI 自行處理

### NFR-2: 效能

- 並行查詢多個來源
- awesome repos 快取 30 分鐘
- github 搜尋快取 5 分鐘

### NFR-3: 容錯

- 單一來源失敗不影響其他
- 返回部分可用結果

## 優先級

| 需求 | 優先級 | 狀態 |
|------|--------|------|
| FR-1 子目錄支援 | P0 | ✅ 完成 |
| FR-2 多來源搜尋 | P1 | ⏳ |
| FR-3 內容抓取 | P1 | ⏳ |
| FR-4 去重機制 | P1 | ⏳ |
| FR-5 CLI 結果 | P2 | ⏳ |

## 使用場景

### 場景 1: 找現成 Skill

```
用戶：我需要一個幫我寫 commit message 的 skill

AI：
1. search_skills({ query: "git commit message" })
2. 找到 3 個相關 skills (已去重)
3. 顯示給用戶選擇
4. 用戶選擇後 install_skill(source)
```

### 場景 2: 參考建立新 Skill

```
用戶：幫我建一個專門處理 PR review 的 skill

AI：
1. search_skills({ query: "code review PR" })
2. 找到相關 skills
3. fetch_skill_content(top_result) 讀取內容
4. 分析結構和模式
5. 參考建立新 skill，針對用戶需求調整
```

### 場景 3: 改造現有 Skill

```
用戶：git-helper 不錯但缺少 X 功能

AI：
1. fetch_skill_content("github:user/repo#git-helper")
2. 讀取完整內容
3. 分析結構
4. 建立新版本加入 X 功能
```

## 設計決策

| 決策 | 選擇 | 原因 |
|------|------|------|
| 主要來源 | skillsmp.com | 40K+ skills，AI 組合學習需要大量樣本 |
| Fallback | awesome repos | 無 API Key 時仍可使用基本功能 |
| GitHub 搜尋方式 | topic 而非 filename | 更精準，減少雜訊 |
| 去重 key | normalized source URL | 準確識別相同 skill |
