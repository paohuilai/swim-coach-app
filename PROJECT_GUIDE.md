# 项目启动与预览操作指南开发文档

**版本号**: v1.1.0  
**更新日期**: 2026-01-13  
**适用对象**: 开发人员、测试人员、项目维护者

---

## 1. 项目启动预览流程

### 1.1 本地开发环境准备

在启动项目之前，请确保本地已安装 [Node.js](https://nodejs.org/) (推荐 v18+)。

#### 1.1.1 环境变量配置
在项目根目录下创建一个 `.env` 文件（参考 `.env.example`，如有），并配置以下必要变量：

```env
# Clerk 身份验证配置
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Supabase 数据库配置
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> **注意**: 请向项目管理员索取有效的测试环境 Key。

#### 1.1.2 依赖安装
使用 npm 安装项目依赖：

```bash
npm install
```

#### 1.1.3 启动开发服务器
运行以下命令启动本地开发环境：

```bash
npm run dev
```

启动成功后，控制台将显示访问地址，通常为：
- **本地访问**: http://localhost:5173

---

## 2. 首次运行新功能操作规范

本次更新包含数据库结构的重大变更，首次运行前**必须**执行数据库迁移脚本。

### 2.1 SQL 迁移脚本说明

脚本存放位置：`supabase/migrations/`

| 顺序 | 文件名 | 说明 |
| :--- | :--- | :--- |
| 1 | `20240523000000_init_schema.sql` | 初始化基础 Schema (如未初始化需执行) |
| 2 | `20240523000014_add_coaches_table.sql` | 添加基础教练表结构 (如未初始化需执行) |
| 3 | **`20260113000000_feature_update.sql`** | **本次核心更新**：添加角色、训练计划、积分赛表 |

### 2.2 执行流程

由于本项目未集成 Supabase CLI 自动迁移，需手动在 Supabase Dashboard 执行：

1.  **登录 Supabase 后台**: 进入对应项目的 Dashboard。
2.  **进入 SQL 编辑器**: 点击左侧菜单栏的 "SQL Editor"。
3.  **新建查询**: 点击 "New query"。
4.  **复制脚本内容**: 打开本地 `supabase/migrations/20260113000000_feature_update.sql` 文件，复制所有内容。
5.  **执行脚本**: 将内容粘贴到 SQL 编辑器中，点击右下角 "Run"。

### 2.3 验证执行结果
执行完成后，进入 "Table Editor"，检查是否出现以下新表/字段：
-   `training_plans` (新表)
-   `competition_scores` (新表)
-   `coaches` 表中新增 `role`, `venue` 字段

---

## 3. 开发文档结构

### 3.1 系统架构图
```mermaid
graph TD
    User[用户 (浏览器)] --> Frontend[React + Vite 前端]
    Frontend --> Auth[Clerk 身份认证]
    Frontend --> DB[Supabase (PostgreSQL)]
    Frontend --> Storage[Supabase Storage (多媒体)]
```

### 3.2 功能模块说明
-   **认证模块**: 基于 Clerk 实现注册、登录、登出。
-   **用户权限**: 
    -   `Admin` (总管): 全局管理、角色分配、积分赛发布。
    -   `Manager` (馆长): 场馆管理。
    -   `Coach` (教练): 运动员管理、训练计划制定。
-   **运动员管理**: 分组展示、详细档案、成绩录入、状态跟踪。
-   **训练计划**: 日历化管理、多媒体附件、层级查询。
-   **排行榜**: 测试成绩排名、积分赛公示。

### 3.3 API 接口文档
本项目使用 Supabase Client SDK 直接与数据库交互，无传统 REST API 后端。
主要交互逻辑位于 `src/pages/` 下各组件的 `useEffect` 或事件处理函数中。
核心数据表：`athletes`, `training_logs`, `coaches`, `training_plans`, `competition_scores`。

### 3.4 部署指南
推荐使用 Vercel 或 Netlify 进行前端托管：
1.  连接 GitHub 仓库。
2.  配置 Build Settings:
    -   Build Command: `npm run build`
    -   Output Directory: `dist`
3.  配置 Environment Variables (同本地 `.env`)。

---

## 4. 使用预览说明文档

### 4.1 预览环境
-   **访问地址**: http://localhost:5173 (本地)
-   **测试账号**:
    -   本项目开放注册，您可以直接在登录页点击 "Sign Up" 注册新账号。
    -   注册后默认角色为 `coach` (教练)。
    -   如需测试管理员功能，请在 Supabase `coaches` 表中手动将对应用户的 `role` 字段修改为 `admin`。

### 4.2 核心功能操作流程

#### 流程一：发布训练计划
1.  登录后点击导航栏 "训练计划"。
2.  在 "记录当天计划" 标签页，填写日期、标题、内容。
3.  选择适用年龄组（可点击 "+" 新增）。
4.  点击 "保存计划"。
5.  切换到 "查询往期计划" 查看结果。

#### 4.3 常见问题 (FAQ)
-   **Q: 为什么我看不到“权限管理”菜单？**
    -   A: 该菜单仅对 `admin` 角色开放。请联系管理员修改您的权限，或在数据库手动修改。
-   **Q: 运动员列表为空？**
    -   A: 请点击右上角 "添加运动员" 录入数据。
-   **Q: 报错 "Missing Supabase environment variables"？**
    -   A: 请检查 `.env` 文件是否存在且配置正确，修改后需重启开发服务器。

#### 4.4 反馈渠道
-   **Bug 反馈**: 请在 GitHub Issues 中提交。
-   **技术支持**: 联系开发团队负责人。

---

## 5. 版本控制说明

-   **当前版本**: v1.1.0
-   **代码分支**: `main` (或 `feature/upgrade-20260113`)

### 更新历史记录
| 版本 | 日期 | 更新内容 | 对应 Commit |
| :--- | :--- | :--- | :--- |
| v1.0.0 | 2024-05-23 | 初始版本上线 | `init` |
| v1.1.0 | 2026-01-13 | 增加角色权限、训练计划、积分赛模块，重构运动员管理 | `latest` |

---
*文档生成于 2026-01-13，由 AI 辅助生成。*
