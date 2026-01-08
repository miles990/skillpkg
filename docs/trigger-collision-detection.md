# Trigger Collision Detection

> 當多個 skills 匹配相同關鍵詞時，如何智能路由

## 問題背景

當用戶輸入「設計一個 API」時，可能匹配到：
- `api-design` (software skill) - 因為包含 "API"
- `marketing` (domain skill) - 因為 "API" 也可能指 partner API 行銷
- `ui-ux-design` (domain skill) - 因為 "設計" 關鍵詞

這時需要**智能路由**來決定載入哪些 skills。

## 解決方案：Context-Aware Priority

### 1. Trigger 權重配置

每個 skill 的 triggers 可以配置：

```yaml
# api-design/SKILL.md
triggers:
  keywords:
    primary: [API, api-design, RESTful, GraphQL, endpoint]  # 權重 1.0
    secondary: [設計, 介面, 規範]  # 權重 0.6
  context_boost: [開發, 技術, 程式, backend, 後端]  # 共現時 +0.3
  context_penalty: [行銷, 推廣, partner, 合作]  # 共現時 -0.3
  priority: high  # 基礎優先級
```

### 2. 評分計算

```
最終分數 = 基礎分數 + context_boost - context_penalty

基礎分數計算：
- primary keyword 匹配: +1.0 × 匹配數
- secondary keyword 匹配: +0.6 × 匹配數

context 調整：
- context_boost 關鍵詞共現: +0.3 × 匹配數
- context_penalty 關鍵詞共現: -0.3 × 匹配數

priority 權重：
- high: ×1.2
- medium: ×1.0 (default)
- low: ×0.8
```

### 3. 路由決策範例

**輸入**: "設計一個支付 API"

**關鍵詞提取**: [設計, 支付, API]

**候選評分**:

| Skill | 基礎分 | Boost | Penalty | Priority | 最終分 |
|-------|--------|-------|---------|----------|--------|
| api-design | 1.6 (API=1.0, 設計=0.6) | 0 | 0 | high×1.2 | **1.92** |
| e-commerce | 0.6 (支付) | 0 | 0 | medium×1.0 | 0.6 |
| marketing | 0.6 (API) | 0 | -0.3 (設計→技術傾向) | medium×1.0 | 0.3 |

**決策**: 載入 `api-design` (1.92) + `e-commerce` (0.6)，跳過 `marketing` (0.3)

## 碰撞類型與處理

### Type A: 明確碰撞

多個 skills 的 primary keywords 相同。

**偵測**:
```bash
skillpkg analyze --check-collisions
```

**輸出**:
```
⚠️ Collision detected:
   Keyword "API" is primary in:
   - api-design (software)
   - marketing (domain) - context_penalty: [開發, 技術]

   Recommendation:
   - Add context_penalty to marketing: [開發, 技術, REST]
   - Or lower marketing priority for "API"
```

**解決**: 透過 context_penalty 區分

### Type B: 隱含碰撞

不同 skills 的 keywords 語意相近。

**範例**:
- `frontend` 有 "網頁開發"
- `backend` 有 "網站後端"

兩者都可能匹配 "網站"。

**解決**: 確保 context_boost/penalty 能區分

### Type C: 跨類型碰撞

Domain skill 和 Software skill 共用關鍵詞。

**範例**:
- `game-design` (domain) 有 "遊戲"
- `game-development` (software) 也有 "遊戲"

**解決**: 這是預期的！兩者都應該被載入，透過 dependencies 連結。

## 配置最佳實踐

### DO ✅

```yaml
# 明確的 primary keywords
triggers:
  keywords:
    primary: [量化交易, quant, 回測, backtest]  # 專屬關鍵詞
    secondary: [股票, 交易]  # 較通用的
  context_boost: [Python, 資料分析, 演算法]  # 技術語境
  context_penalty: [新聞, 趨勢, 投資建議]  # 非技術語境
```

### DON'T ❌

```yaml
# 過於通用的 primary keywords
triggers:
  keywords:
    primary: [設計, 開發, 系統]  # 太通用，會碰撞
    secondary: []
  # 缺少 context 調整
```

## 診斷命令

### 檢查所有碰撞

```bash
skillpkg analyze --check-collisions --all

# 輸出:
# 📊 Trigger Collision Report
#
# 🔴 High Severity (same primary keyword):
#    - "API": api-design, marketing
#    - "設計": ui-ux-design, game-design, api-design
#
# 🟡 Medium Severity (overlapping secondary):
#    - "開發": frontend, backend, game-development
#
# 🟢 Expected (domain-software pairs):
#    - "遊戲": game-design ↔ game-development ✓
```

### 模擬匹配

```bash
skillpkg match "設計一個支付 API" --verbose

# 輸出:
# 🎯 Matching: "設計一個支付 API"
#
# Keywords extracted: [設計, 支付, API]
#
# Candidates:
#   1. api-design      score=1.92 ⭐ (primary: API, secondary: 設計)
#   2. e-commerce      score=0.60   (secondary: 支付)
#   3. marketing       score=0.30   (primary: API, penalty: 設計→技術)
#
# Selected: api-design, e-commerce
```

## 實作細節

### MatchingEngine 介面

```typescript
interface MatchResult {
  skill: string;
  score: number;
  breakdown: {
    primaryMatches: string[];
    secondaryMatches: string[];
    boostMatches: string[];
    penaltyMatches: string[];
    priorityMultiplier: number;
  };
}

interface CollisionReport {
  severity: 'high' | 'medium' | 'low';
  keyword: string;
  skills: string[];
  recommendation: string;
}

class MatchingEngine {
  match(goal: string): MatchResult[];
  checkCollisions(): CollisionReport[];
  simulate(goal: string): void;
}
```

### 整合 recommend_skills MCP tool

```typescript
// recommend_skills 使用 MatchingEngine
const results = matchingEngine.match(goal);

// 過濾低分 skills
const threshold = 0.5;
const selected = results.filter(r => r.score >= threshold);

// 返回時標示分數來源
return {
  skills: selected.map(s => ({
    name: s.skill,
    confidence: s.score,
    reason: formatReason(s.breakdown)
  }))
};
```

## 與 Phase 1 整合

Phase 1 已為所有 62 個 skills 定義了 triggers：

```yaml
triggers:
  keywords:
    primary: [...]
    secondary: [...]
  context_boost: [...]
  context_penalty: [...]
  priority: high/medium/low
```

Phase 2.2 新增的是**碰撞偵測與智能路由**的文件化與分析工具。

## 下一步

1. 在 skillpkg CLI 新增 `analyze --check-collisions` 命令
2. 在 recommend_skills MCP tool 使用 MatchingEngine
3. 建立碰撞報告的自動化檢查（CI/CD 整合）
