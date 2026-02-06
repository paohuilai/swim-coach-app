
-- ==============================================================================
-- 20260129_template_system_refactor.sql
-- 1. Refactor training_plan_templates table (add likes, favorites)
-- 2. Create interaction tables: template_likes, template_favorites
-- 3. Set up RLS policies for public access and interaction
-- ==============================================================================

-- 1. Refactor training_plan_templates table
-- Ensure the table exists and has necessary columns
CREATE TABLE IF NOT EXISTS training_plan_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id text NOT NULL, -- Creator ID
  title text NOT NULL,
  content text,
  target_groups text[],
  type text DEFAULT 'user', -- 'user' or 'system'
  likes_count integer DEFAULT 0,
  favorites_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE training_plan_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view all templates (Public Library)
DROP POLICY IF EXISTS "Public view all templates" ON training_plan_templates;
CREATE POLICY "Public view all templates" ON training_plan_templates
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Coaches can create templates (linked to their ID)
DROP POLICY IF EXISTS "Coaches create own templates" ON training_plan_templates;
CREATE POLICY "Coaches create own templates" ON training_plan_templates
    FOR INSERT
    TO authenticated
    WITH CHECK (coach_id = auth.uid()::text);

-- Policy: Coaches can update/delete ONLY their own templates
DROP POLICY IF EXISTS "Coaches manage own templates" ON training_plan_templates;
CREATE POLICY "Coaches manage own templates" ON training_plan_templates
    FOR UPDATE
    TO authenticated
    USING (coach_id = auth.uid()::text);

DROP POLICY IF EXISTS "Coaches delete own templates" ON training_plan_templates;
CREATE POLICY "Coaches delete own templates" ON training_plan_templates
    FOR DELETE
    TO authenticated
    USING (coach_id = auth.uid()::text);


-- 2. Create Likes Table (template_likes)
CREATE TABLE IF NOT EXISTS template_likes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id uuid REFERENCES training_plan_templates(id) ON DELETE CASCADE,
    coach_id text NOT NULL, -- Who liked it
    created_at timestamptz DEFAULT now(),
    UNIQUE(template_id, coach_id) -- Prevent duplicate likes
);

ALTER TABLE template_likes ENABLE ROW LEVEL SECURITY;

-- Policy: View all likes (needed for counting?) - actually UI just needs count, but safe to allow view
CREATE POLICY "Public view likes" ON template_likes FOR SELECT TO authenticated USING (true);

-- Policy: Insert like (authenticated users)
CREATE POLICY "User can like" ON template_likes FOR INSERT TO authenticated 
WITH CHECK (coach_id = auth.uid()::text);

-- Policy: Delete like (unlike)
CREATE POLICY "User can unlike" ON template_likes FOR DELETE TO authenticated 
USING (coach_id = auth.uid()::text);


-- 3. Create Favorites Table (template_favorites)
CREATE TABLE IF NOT EXISTS template_favorites (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id uuid REFERENCES training_plan_templates(id) ON DELETE CASCADE,
    coach_id text NOT NULL, -- Who favorited it
    created_at timestamptz DEFAULT now(),
    UNIQUE(template_id, coach_id)
);

ALTER TABLE template_favorites ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view THEIR OWN favorites (Privacy)
-- But wait, if we want to show "Who favorited this", we might need public view.
-- For now, let's keep favorites private to the user, or at least visible to managers?
-- Let's allow users to see their own favorites list.
CREATE POLICY "User view own favorites" ON template_favorites FOR SELECT TO authenticated 
USING (coach_id = auth.uid()::text);

-- Policy: Insert favorite
CREATE POLICY "User can favorite" ON template_favorites FOR INSERT TO authenticated 
WITH CHECK (coach_id = auth.uid()::text);

-- Policy: Delete favorite
CREATE POLICY "User can unfavorite" ON template_favorites FOR DELETE TO authenticated 
USING (coach_id = auth.uid()::text);

-- 4. Triggers for Counts (Optional but recommended for performance)
-- Function to update likes_count
CREATE OR REPLACE FUNCTION update_template_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE training_plan_templates SET likes_count = likes_count + 1 WHERE id = NEW.template_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE training_plan_templates SET likes_count = likes_count - 1 WHERE id = OLD.template_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for likes
DROP TRIGGER IF EXISTS trigger_template_likes_count ON template_likes;
CREATE TRIGGER trigger_template_likes_count
AFTER INSERT OR DELETE ON template_likes
FOR EACH ROW EXECUTE FUNCTION update_template_likes_count();

-- Function to update favorites_count
CREATE OR REPLACE FUNCTION update_template_favorites_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE training_plan_templates SET favorites_count = favorites_count + 1 WHERE id = NEW.template_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE training_plan_templates SET favorites_count = favorites_count - 1 WHERE id = OLD.template_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for favorites
DROP TRIGGER IF EXISTS trigger_template_favorites_count ON template_favorites;
CREATE TRIGGER trigger_template_favorites_count
AFTER INSERT OR DELETE ON template_favorites
FOR EACH ROW EXECUTE FUNCTION update_template_favorites_count();
