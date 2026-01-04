---
name: test-helper
version: 1.0.0
description: 測試輔助，提供測試策略、覆蓋率建議與測試撰寫指引
author: miles990
tags:
  - testing
  - unit-test
  - coverage
  - quality
interface:
  input:
    - name: target
      type: string
      description: "要測試的目標（檔案、模組、功能）"
      required: true
    - name: test_type
      type: string
      description: "測試類型：unit, integration, e2e"
      required: false
      default: "unit"
    - name: context
      type: object
      description: "額外上下文（如框架、現有測試）"
      required: false
  output:
    - name: test_plan
      type: object
      description: "測試計劃"
    - name: test_cases
      type: array
      description: "建議的測試案例"
    - name: next_action
      type: string
      description: "建議的下一步"
triggers:
  - pattern: "撰寫測試"
    description: "需要撰寫測試時"
  - pattern: "功能完成"
    description: "功能實作完成後"
  - pattern: "覆蓋率不足"
    description: "測試覆蓋率低於標準時"
---

# Test Helper

> 分析程式碼 → 設計測試策略 → 產出測試案例

## 核心理念

```
┌─────────────────────────────────────────────────────────────────┐
│  測試不是事後想到才做，而是開發流程的一部分                     │
│                                                                 │
│  本 Skill 職責：                                                │
│  • 分析程式碼，識別需要測試的點                                 │
│  • 設計測試策略                                                 │
│  • 產出測試案例建議                                             │
│  • 評估測試覆蓋率                                               │
└─────────────────────────────────────────────────────────────────┘
```

## 測試策略

### 測試金字塔

```
                    ┌───────┐
                    │  E2E  │  少量，驗證完整流程
                    ├───────┤
                ┌───┤ 整合  ├───┐  中量，驗證模組協作
                │   ├───────┤   │
            ┌───┴───┤ 單元  ├───┴───┐  大量，驗證個別函式
            └───────┴───────┴───────┘
```

### 測試類型

| 類型 | 說明 | 覆蓋目標 |
|------|------|----------|
| `unit` | 單元測試 | 個別函式、方法 |
| `integration` | 整合測試 | 模組間協作 |
| `e2e` | 端對端測試 | 完整用戶流程 |

## 測試設計流程

### Step 1: 分析目標程式碼

```markdown
檢查：
1. 有哪些公開函式/方法？
2. 有哪些輸入/輸出？
3. 有哪些邊界條件？
4. 有哪些錯誤情況？
```

### Step 2: 設計測試案例

```yaml
test_cases:
  - name: "正常流程"
    description: "驗證基本功能"
    input: "正常輸入"
    expected: "預期輸出"

  - name: "邊界條件"
    description: "驗證極限情況"
    input: "邊界值"
    expected: "正確處理"

  - name: "錯誤處理"
    description: "驗證錯誤情況"
    input: "無效輸入"
    expected: "適當的錯誤訊息"
```

### Step 3: 輸出測試計劃

```yaml
test_plan:
  target: "src/api/user.js"
  framework: "jest"
  strategy: "unit"

  test_cases:
    - name: "should create user with valid data"
      type: "happy_path"
      priority: "high"

    - name: "should reject invalid email"
      type: "validation"
      priority: "high"

    - name: "should handle database error"
      type: "error_handling"
      priority: "medium"

  coverage_target:
    statements: 80
    branches: 75
    functions: 90
    lines: 80
```

## 測試案例模板

### Jest 範例

```javascript
describe('UserService', () => {
  describe('createUser', () => {
    // Happy path
    it('should create user with valid data', async () => {
      const userData = { name: 'John', email: 'john@example.com' };
      const result = await userService.createUser(userData);
      expect(result.id).toBeDefined();
      expect(result.name).toBe('John');
    });

    // Validation
    it('should reject invalid email', async () => {
      const userData = { name: 'John', email: 'invalid' };
      await expect(userService.createUser(userData))
        .rejects.toThrow('Invalid email');
    });

    // Edge case
    it('should handle empty name', async () => {
      const userData = { name: '', email: 'john@example.com' };
      await expect(userService.createUser(userData))
        .rejects.toThrow('Name is required');
    });
  });
});
```

## 最小範例

```markdown
用戶：幫這個函式寫測試
AI：

1. 分析函式：calculateTotal(items)
2. 識別測試點：
   - 正常計算
   - 空陣列
   - 負數價格
   - 大量項目

3. 輸出：

測試計劃：
┌─────────────────────────────────────────────────────┐
│  📋 測試案例                                        │
│                                                     │
│  ✅ Happy Path:                                     │
│     • 計算多個項目的總和                            │
│     • 計算單一項目                                  │
│                                                     │
│  🔲 Edge Cases:                                     │
│     • 空陣列應返回 0                                │
│     • 含折扣的項目                                  │
│                                                     │
│  ❌ Error Cases:                                    │
│     • 負數價格應拋出錯誤                            │
│     • 無效項目格式                                  │
│                                                     │
│  覆蓋率目標：80% statements                         │
└─────────────────────────────────────────────────────┘
```

## 與其他 Skill 的協作

```
┌─────────────────────────────────────────────────────────────────┐
│  在 PDCA 循環中的位置                                           │
│                                                                 │
│  [實作功能] → [test-helper] → [執行測試] → [code-reviewer]     │
│                   ↓                            ↓                │
│            產出測試案例                    審查程式碼            │
│                                                                 │
│  測試失敗 → [debug-helper] → 修正 → 重新測試                   │
└─────────────────────────────────────────────────────────────────┘
```

## 設計原則

1. **測試優先思維** - 功能完成就該有測試
2. **全面覆蓋** - 正常、邊界、錯誤都要測
3. **可維護** - 測試程式碼也要好維護
4. **快速執行** - 單元測試要快
5. **獨立性** - 測試之間不互相依賴

## 限制與邊界

- 這是「設計測試」不是「自動生成完美測試」
- 複雜邏輯需要人工判斷測試策略
- 整合測試和 E2E 測試需要環境配置
- 測試品質依賴對需求的理解
