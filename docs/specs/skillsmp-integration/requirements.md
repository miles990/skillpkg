# 通用 Registry 整合需求規格

## 概述

建立可插拔的 Registry 架構，讓 skillpkg 可以從多個來源搜尋與安裝 skills。

## 背景

### 現有限制
1. skillpkg 只支援根目錄或 `.claude/skills/` 的 SKILL.md
2. 缺乏集中式搜尋功能
3. 無法整合第三方 skill 來源

### 潛在 Registry 來源
| 來源 | 說明 | 狀態 |
|------|------|------|
| Skills Marketplace | skillsmp.com, 40K+ skills | 已存在 |
| GitHub Search | 直接搜尋 GitHub SKILL.md | 可實作 |
| 自建 Registry | 企業內部 registry | 未來 |
| npm-like Registry | 類似 npm 的中心化 registry | 未來 |

## 功能需求

### FR-1: 支援子目錄 SKILL.md 安裝 (P0)

**描述**：skillpkg 可以安裝位於 repo 任意路徑的 SKILL.md

**驗收標準**：
- [ ] 支援 `github:user/repo#path/to/skill` 格式
- [ ] 支援 `github:user/repo/path/to/skill` 格式 (alias)
- [ ] fetcher 可以從指定路徑取得 SKILL.md
- [ ] 安裝後正確記錄完整 source URL

**範例**：
```bash
# 兩種格式等效
skillpkg install github:user/repo#docs/skills/my-skill
skillpkg install github:user/repo/docs/skills/my-skill
```

### FR-2: Registry Provider 介面 (P1)

**描述**：定義通用的 Registry 介面，讓不同來源可以插入

**驗收標準**：
- [ ] 定義 `RegistryProvider` 介面
- [ ] 支援 `search()`, `browse()`, `getSkill()` 方法
- [ ] 每個 provider 可獨立啟用/停用
- [ ] 支援優先級排序

**介面定義**：
```typescript
interface RegistryProvider {
  name: string;
  enabled: boolean;
  priority: number;  // 數字越小優先級越高

  search(query: string, options?: SearchOptions): Promise<SearchResult>;
  browse(category?: string, options?: BrowseOptions): Promise<BrowseResult>;
  getSkill(id: string): Promise<SkillInfo | null>;
}
```

### FR-3: 多 Registry 搜尋 (P1)

**描述**：搜尋時合併多個 registry 的結果

**驗收標準**：
- [ ] 預設搜尋所有啟用的 registries
- [ ] 可指定單一 registry 搜尋
- [ ] 結果按優先級和相關度排序
- [ ] 去重（相同 repo 的 skill）

**範例**：
```bash
# 搜尋所有 registries
skillpkg search "git helper"

# 只搜尋特定 registry
skillpkg search "git helper" --registry=skillsmp
skillpkg search "git helper" --registry=github
```

### FR-4: Registry 設定 (P2)

**描述**：用戶可在設定檔中配置 registries

**驗收標準**：
- [ ] 支援在 `skillpkg.json` 或 `~/.skillpkg/config.json` 設定
- [ ] 可啟用/停用個別 registry
- [ ] 可設定 API tokens (如 GitHub token)
- [ ] 可新增自訂 registry URL

**設定範例**：
```json
{
  "registries": {
    "skillsmp": {
      "enabled": true,
      "priority": 1
    },
    "github": {
      "enabled": true,
      "priority": 2,
      "token": "${GITHUB_TOKEN}"
    },
    "custom": {
      "enabled": false,
      "url": "https://my-registry.example.com/api",
      "priority": 3
    }
  }
}
```

## 內建 Registry Providers

### 1. Skills Marketplace Provider
- **ID**: `skillsmp`
- **API**: `https://skillsmp.com/api/skills`
- **特點**: 40K+ 預索引的 skills
- **預設**: 啟用

### 2. GitHub Search Provider
- **ID**: `github`
- **API**: GitHub Search API
- **特點**: 即時搜尋所有公開 repo
- **預設**: 啟用
- **限制**: 需 token 避免 rate limit

### 3. Local Provider
- **ID**: `local`
- **來源**: 已安裝的 skills
- **特點**: 離線可用
- **預設**: 啟用

## 非功能需求

### NFR-1: 可擴展性
- 新增 provider 只需實作介面
- 不需修改核心程式碼

### NFR-2: 效能
- 並行查詢多個 registries
- 單一 registry 回應時間 < 3 秒
- 快取搜尋結果 5 分鐘

### NFR-3: 容錯
- 單一 registry 失敗不影響其他
- 顯示失敗的 registry 名稱
- 總是返回可用的結果

## 優先級

| 需求 | 優先級 | 原因 |
|------|--------|------|
| FR-1 子目錄支援 | P0 | 基礎功能 |
| FR-2 Provider 介面 | P1 | 架構基礎 |
| FR-3 多 Registry 搜尋 | P1 | 核心價值 |
| FR-4 Registry 設定 | P2 | 進階功能 |

## URL 格式規範

### GitHub 子目錄格式

```
# 推薦格式 (明確分隔)
github:user/repo#path/to/skill

# 別名格式 (向後相容)
github:user/repo/path/to/skill

# 完整 URL 格式
https://github.com/user/repo/tree/main/path/to/skill
```

### 解析規則

```
github:user/repo              → repo root
github:user/repo#path         → repo + subpath
github:user/repo/path         → 嘗試: 1) subpath 2) 不同 repo
user/repo                     → 等同 github:user/repo
user/repo#path                → 等同 github:user/repo#path
```
