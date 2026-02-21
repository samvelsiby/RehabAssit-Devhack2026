-- =============================================================
-- RehabAssist – MediaPipe Exercise Setup Migration (v2)
-- Fixes: no ON CONFLICT – uses IF NOT EXISTS pattern instead
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================================

-- ─── Step 1: Remove non-MediaPipe exercises ────────────────────────────────
-- Deactivate assignments referencing exercises we don't want
UPDATE public.assigned_exercises
SET active = false
WHERE exercise_id NOT IN (
  SELECT id FROM public.exercises
  WHERE name IN ('Squat Analysis', 'Standing Hamstring Curl', 'Heel Raise')
);

-- Delete old exercise rows (those NOT in our 3)
DELETE FROM public.exercises
WHERE name NOT IN ('Squat Analysis', 'Standing Hamstring Curl', 'Heel Raise');

-- ─── Step 2: Insert the 3 MediaPipe exercises (safe, no ON CONFLICT) ────────
INSERT INTO public.exercises (name, description, phase)
SELECT 'Squat Analysis',
       'Real-time squat form analysis with MediaPipe pose detection',
       1
WHERE NOT EXISTS (
  SELECT 1 FROM public.exercises WHERE name = 'Squat Analysis'
);

INSERT INTO public.exercises (name, description, phase)
SELECT 'Standing Hamstring Curl',
       'Standing hamstring curl with form analysis via MediaPipe',
       2
WHERE NOT EXISTS (
  SELECT 1 FROM public.exercises WHERE name = 'Standing Hamstring Curl'
);

INSERT INTO public.exercises (name, description, phase)
SELECT 'Heel Raise',
       'Calf raise exercise with height and balance analysis',
       1
WHERE NOT EXISTS (
  SELECT 1 FROM public.exercises WHERE name = 'Heel Raise'
);

-- ─── Step 3: Verify – should show exactly 3 rows ──────────────────────────
SELECT id, name, phase FROM public.exercises ORDER BY phase, name;

-- ─── Step 4: Check active assignments ─────────────────────────────────────
SELECT
  ae.id          AS assignment_id,
  u.email        AS client_email,
  e.name         AS exercise_name,
  ae.sets,
  ae.reps,
  ae.active
FROM public.assigned_exercises ae
JOIN public.exercises e ON e.id = ae.exercise_id
JOIN public.users u     ON u.id = ae.client_id
WHERE ae.active = true
ORDER BY ae.assigned_at DESC;
