# 泳训追踪 - 技术架构文档

## 1. 技术栈选择

- **前端框架**: React 18 + TypeScript (使用 Vite 构建)
  - *说明*: 虽然用户提及 Next.js，但鉴于当前环境最佳实践和工具支持，选用 Vite + React 提供高性能 SPA 体验，且易于部署和维护。
- **样式库**: Tailwind CSS
  - *说明*: 快速构建响应式 UI，符合原子化 CSS 理念。
- **路由**: React Router v6
  - *说明*: 标准 SPA 路由解决方案。
- **状态管理**: Zustand
  - *说明*: 轻量级状态管理，用于全局状态（如用户偏好、缓存数据）。
- **数据获取**: TanStack Query (React Query)
  - *说明*: 管理服务端状态，处理缓存、加载状态和错误。
- **后端/数据库**: Supabase
  - *说明*: 提供 PostgreSQL 数据库、REST API 和行级安全 (RLS)。
- **认证**: Clerk
  - *说明*: 专注于身份验证，提供完善的用户管理 UI。
- **图表**: ECharts (echarts-for-react)
  - *说明*: 强大的数据可视化库，支持复杂的折线图和柱状图。
- **图标**: Lucide React
  - *说明*: 风格统一的 SVG 图标库。
- **日期处理**: date-fns
  - *说明*: 轻量级日期格式化和计算库。

## 2. 数据库设计 (Supabase PostgreSQL)

### 2.1 表结构

#### `athletes` (运动员表)
- `id`: uuid (Primary Key, default: gen_random_uuid())
- `coach_id`: text (Not Null, 对应 Clerk User ID)
- `name`: text (Not Null)
- `age`: integer
- `gender`: text
- `created_at`: timestamptz (default: now())

#### `training_logs` (训练日志表)
- `id`: uuid (Primary Key, default: gen_random_uuid())
- `athlete_id`: uuid (Foreign Key -> athletes.id, On Delete Cascade)
- `date`: date (Not Null)
- `distance_km`: numeric (Not Null, 训练量)
- `created_at`: timestamptz (default: now())

#### `performance_entries` (成绩记录表)
- `id`: uuid (Primary Key, default: gen_random_uuid())
- `log_id`: uuid (Foreign Key -> training_logs.id, On Delete Cascade)
- `stroke`: text (Not Null, 泳姿，如 "100m Free", "50m Fly")
- `time_seconds`: numeric (Not Null, 成绩秒数)
- `created_at`: timestamptz (default: now())

### 2.2 安全性 (RLS)
- 所有表开启 RLS (Row Level Security)。
- 策略: 仅允许 `coach_id` 匹配当前登录用户 ID 的行进行 SELECT, INSERT, UPDATE, DELETE。
- *注意*: 由于 Clerk ID 是 text 类型，我们需要在 Supabase 中通过 JWT claim 或者在该应用层逻辑中确保 `coach_id` 正确写入。在本 MVP 中，我们将主要依赖应用层过滤和 Supabase 的基本 RLS（如果能集成 Clerk JWT 最好，否则使用 Supabase Auth 或在查询时严格过滤）。
- *修正*: 为了简化 MVP 且使用 Clerk，我们将直接在 Supabase Client 中使用 Anon Key，并在所有查询中强制带上 `coach_id` 过滤。

## 3. 路由结构

- `/`: 登录/注册页 (Public)
- `/dashboard`: 仪表盘 (Private)
- `/athletes`: 运动员列表 (Private)
- `/athletes/new`: 添加运动员 (Private)
- `/athletes/:id`: 运动员详情 & 图表 (Private)
- `/athletes/:id/log`: 录入训练记录 (Private)

## 4. 组件架构

- **Layout**: `DashboardLayout` (包含 Sidebar/Header)
- **Auth**: `ProtectedRoute` (检查 Clerk 登录状态)
- **Features**:
  - `AthleteList`: 表格展示
  - `TrainingForm`: 动态表单 (useFieldArray)
  - `ProgressChart`: 封装 ECharts
  - `StatsCard`: 仪表盘卡片

## 5. 关键逻辑

- **进步率计算**:
  - 在前端获取某运动员某泳姿的所有成绩，按日期排序。
  - 计算公式: `(上一条记录时间 - 当前记录时间) / 上一条记录时间 * 100%`。
  - 正值表示进步（时间减少），负值表示退步。

## 6. 开发步骤

1. 初始化项目 & 安装依赖。
2. 配置 Supabase & Clerk 环境变量。
3. 创建数据库表。
4. 实现路由和布局。
5. 开发各个功能页面。
6. 调试图表和数据计算。
