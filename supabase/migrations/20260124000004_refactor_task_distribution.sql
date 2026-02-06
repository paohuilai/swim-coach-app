-- 1. 重构任务分发机制：使用 SECURITY DEFINER 绕过 RLS 限制
-- 这解决了 Manager 无法为其他 Coach 插入 task_submissions 的问题
CREATE OR REPLACE FUNCTION assign_task_to_coaches()
RETURNS TRIGGER 
SECURITY DEFINER -- 关键：以超级用户权限执行，忽略 RLS
SET search_path = public -- 安全最佳实践
AS $$
BEGIN
  INSERT INTO task_submissions (task_id, coach_id, status)
  SELECT NEW.id, id, 'pending'
  FROM coaches
  WHERE venue = NEW.venue AND (role = 'coach' OR role = 'manager');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 重置 task_submissions 表的 RLS 策略
ALTER TABLE task_submissions DISABLE ROW LEVEL SECURITY;

-- 清理旧策略
DROP POLICY IF EXISTS "View Submissions Policy" ON task_submissions;
DROP POLICY IF EXISTS "Coach Submit Policy" ON task_submissions;
DROP POLICY IF EXISTS "Managers can view venue submissions" ON task_submissions;
DROP POLICY IF EXISTS "Admins can view all submissions" ON task_submissions;

-- 3. 创建全新的访问策略
-- 策略 A: 查看权限
CREATE POLICY "View Submissions" ON task_submissions
FOR SELECT TO authenticated
USING (
  -- 1. 总管看所有
  (EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid()::text AND role = 'admin'))
  OR
  -- 2. 教练看自己的
  (coach_id = auth.uid()::text)
  OR
  -- 3. 馆长看自己场馆任务的所有提交记录
  (EXISTS (
    SELECT 1 FROM manager_tasks 
    WHERE id = task_submissions.task_id 
    AND venue = (SELECT venue FROM coaches WHERE id = auth.uid()::text)
  ))
);

-- 策略 B: 更新权限 (提交任务)
CREATE POLICY "Coach Update Submission" ON task_submissions
FOR UPDATE TO authenticated
USING (
  coach_id = auth.uid()::text -- 只能更新自己的
)
WITH CHECK (
  coach_id = auth.uid()::text
);

-- 策略 C: 插入权限 (虽然主要靠触发器，但保留管理员手动插入能力)
CREATE POLICY "Admin Insert Submission" ON task_submissions
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid()::text AND role = 'admin')
);

-- 4. 重新启用 RLS
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;
