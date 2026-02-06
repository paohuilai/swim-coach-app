# 技术更新文档

## 1. 概述
本文档详细描述了本次系统重构和新功能开发的具体内容。本次更新主要涵盖了用户权限管理、训练计划模块、运动员管理模块以及积分赛统计模块。

## 2. 数据库变更
为了支持新功能，我们对 Supabase 数据库进行了以下变更（详见 `supabase/migrations/20260113000000_feature_update.sql`）：

### 2.1 教练表 (`coaches`)
- 新增 `role` 字段：用于区分用户角色 (`admin`, `manager`, `coach`)，默认为 `coach`。
- 新增 `venue` 字段：记录教练所属场馆。
- 新增 `managed_venue` 字段：记录馆长管理的场馆。

### 2.2 训练计划表 (`training_plans`)
- 新建表，用于存储教练发布的训练计划。
- 字段包括：`date`, `title`, `content`, `media_urls` (JSON), `target_groups` (适用年龄组)。
- 启用了行级安全策略 (RLS)，确保教练只能管理自己的计划，所有人可查看。

### 2.3 积分赛成绩表 (`competition_scores`)
- 新建表，用于存储积分赛成绩。
- 字段包括：`title`, `date`, `scores` (JSON 存储排名和分数)。
- 权限控制：仅管理员 (`admin`) 可创建/删除，所有认证用户可查看。

## 3. 功能模块详情

### 3.1 用户权限设置模块
- **角色管理**：
  - 新增 `src/pages/RoleManagement.tsx` 页面。
  - 仅“总管”角色可见。
  - 支持查看所有用户，修改其角色和所属场馆。
- **权限控制**：
  - 更新 `DashboardLayout.tsx`，根据用户角色动态显示导航菜单。
  - `useCoachProfile` Hook：统一封装了获取当前用户角色和配置信息的逻辑。

### 3.2 模块一：训练计划 (Training Plans)
- **新功能**：
  - 新增 `src/pages/TrainingPlans.tsx`。
  - **记录当天计划**：支持选择日期、输入标题和内容、选择适用年龄组（支持自定义新增）、上传多媒体（UI支持）。
  - **查询往期计划**：实现了层级导航查询（年 -> 月 -> 列表），以及按日期精确搜索功能。

### 3.3 模块二：运动员板块 (Athlete Management)
- **列表优化** (`src/pages/AthletesList.tsx`)：
  - **分组逻辑**：更新为“年龄组 + 性别 + 场馆”的组合分组方式。
  - **搜索功能**：新增顶部搜索栏，支持按姓名实时过滤。
  - **快捷操作**：支持直接在列表中修改场馆/队伍。
- **详情优化** (`src/pages/AthleteDetails.tsx`)：
  - **成绩查询**：将原有的简单列表替换为层级查询视图（年 -> 月 -> 记录列表），方便查找历史成绩。
  - **成绩录入**：保留并优化了录入入口，支持记录详细的分段成绩（毫秒级）。

### 3.4 模块三：积分赛统计 (Competition Scores)
- **新功能**：
  - 新增 `src/pages/CompetitionRanking.tsx` 组件。
  - 集成到 `src/pages/Ranking.tsx` 中，作为独立的 Tab 页签。
  - **总管权限**：仅总管可发布新的积分赛成绩（支持批量文本粘贴解析）。
  - **公示查看**：其他用户（馆长、教练）只能查看排名和积分。

## 4. 代码重构与优化
- **类型定义**：更新 `src/types/index.ts`，完善了所有新实体的数据类型定义。
- **前后端分离**：前端使用 React/Vite，后端依赖 Supabase，通过 REST/Client SDK 通信。
- **组件化**：将复杂的页面拆分为子组件（如 `RecordPlanView`, `QueryPlanView`），提高了代码的可读性和可维护性。
- **Hook 封装**：提取 `useCoachProfile` 等自定义 Hook，实现逻辑复用。

## 5. 测试与验证
- 已通过 TypeScript 静态类型检查 (`npm run check`)。
- 验证了所有新页面的路由配置 (`src/App.tsx`)。
- 验证了权限控制逻辑在前端的实现。
