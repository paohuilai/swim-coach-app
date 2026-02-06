
-- ==============================================================================
-- 20260203_drop_insights_module.sql
-- 彻底删除训练心得模块相关的所有数据库表和对象
-- ==============================================================================

-- 1. Drop Tables (Cascade will remove dependent triggers, policies, and foreign keys)
DROP TABLE IF EXISTS insight_comments CASCADE;
DROP TABLE IF EXISTS insight_likes CASCADE;
DROP TABLE IF EXISTS insight_media CASCADE;
DROP TABLE IF EXISTS training_insights CASCADE; -- Or 'insights' if that was the table name, checking previous context it was training_insights

-- 2. Drop any related Functions or Triggers if they were specific to these tables
-- (Usually CASCADE handles triggers on the table, but if there are global functions, drop them here)
-- Example: DROP FUNCTION IF EXISTS update_insight_likes_count;

-- 3. Note on Storage:
-- Files in the 'insights' bucket cannot be deleted via SQL.
-- Please manually empty and delete the 'insights' bucket in the Supabase Storage dashboard.
