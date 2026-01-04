ALTER TABLE athletes ADD COLUMN birth_year INTEGER;

UPDATE athletes 
SET birth_year = 2025 - age 
WHERE age IS NOT NULL;

-- If age was null, birth_year remains null

ALTER TABLE athletes DROP COLUMN age;
