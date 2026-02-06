-- 1. 临时禁用RLS，确保调试顺利
ALTER TABLE manager_tasks DISABLE ROW LEVEL SECURITY;

-- 2. 修正策略 (使用正确的英文角色名 'manager' 和 'admin')
-- 清理旧策略
DROP POLICY IF EXISTS "Allow managers to insert tasks" ON manager_tasks;
DROP POLICY IF EXISTS "Allow managers to view their tasks" ON manager_tasks;
DROP POLICY IF EXISTS "Allow admins to view all tasks" ON manager_tasks;
DROP POLICY IF EXISTS "Managers can insert tasks for their venue" ON manager_tasks;
DROP POLICY IF EXISTS "Managers can view tasks for their venue" ON manager_tasks;
DROP POLICY IF EXISTS "Admins can view all tasks" ON manager_tasks;
DROP POLICY IF EXISTS "Venue access policy" ON manager_tasks;
DROP POLICY IF EXISTS "Admins can manage all tasks" ON manager_tasks;

-- 3. 创建最终正确的策略
-- 插入策略：仅允许角色为 'manager' 且场馆匹配的用户
CREATE POLICY "Allow managers to insert tasks" ON manager_tasks
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM coaches
    WHERE id = auth.uid()::text
    AND role = 'manager' -- 注意：数据库中存储的是 'manager' 而不是 '馆长'
    AND venue = manager_tasks.venue
  )
);

-- 查看策略：馆长/教练看本场馆，总管看所有
CREATE POLICY "Allow viewing tasks" ON manager_tasks
FOR SELECT TO authenticated
USING (
  -- 总管 (admin) 可以看所有
  (EXISTS (
    SELECT 1 FROM coaches
    WHERE id = auth.uid()::text
    AND role = 'admin'
  ))
  OR
  -- 馆长 (manager) 或 教练 (coach) 只能看自己场馆的
  (EXISTS (
    SELECT 1 FROM coaches
    WHERE id = auth.uid()::text
    AND (role = 'manager' OR role = 'coach')
    AND venue = manager_tasks.venue
  ))
);

-- 总管管理策略：允许 'admin' 进行所有操作
CREATE POLICY "Allow admins to manage all" ON manager_tasks
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid()::text AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid()::text AND role = 'admin')
);

-- 4. 重新启用 RLS
ALTER TABLE manager_tasks ENABLE ROW LEVEL SECURITY;

-- 5. (可选) 插入一条测试数据来验证 (需要替换具体的 ID)
-- INSERT INTO manager_tasks (title, venue, deadline, type, created_by)
-- VALUES ('Trae自动验证任务', '您的场馆名称', '2026-03-01', 'plan_upload', '您的UUID');
