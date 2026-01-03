# Skill Directory Support - 需求規格

## 背景

目前 skillpkg 只下載 SKILL.md 檔案。許多 skills 包含額外資源：
- `scripts/` - 可執行腳本
- `resources/` - 參考文件、範本
- `templates/` - 程式碼範本
- `examples/` - 範例檔案

## 目標

支援下載完整 skill 目錄，包含所有子檔案和子目錄。

## 功能需求

### F1: 目錄列舉
- 從 GitHub API 取得 skill 目錄的完整檔案清單
- 支援巢狀目錄結構

### F2: 批次下載
- 下載 SKILL.md + 所有額外檔案
- 保持目錄結構

### F3: 儲存擴展
- StoreManager 支援儲存額外檔案
- 保持現有 SKILL.md 解析邏輯

### F4: 同步擴展
- Syncer 複製完整目錄（非只有 SKILL.md）
- 保持現有同步邏輯

## 非功能需求

- 向後相容：只有 SKILL.md 的 skills 繼續正常運作
- 效能：並行下載檔案
- 錯誤處理：單一檔案失敗不影響整體安裝

## 驗收標準

```bash
# 安裝含 scripts 的 skill
skillpkg install github:user/repo#skill-with-scripts

# 驗證目錄結構
ls .skillpkg/skills/skill-name/
# → SKILL.md
# → scripts/
# → resources/

# 同步後驗證
skillpkg sync
ls .claude/skills/skill-name/
# → SKILL.md
# → scripts/
# → resources/
```
