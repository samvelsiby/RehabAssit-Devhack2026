# Database Schema

This document outlines the database schema for RehabAssist, including the new custom exercise configurations.

## Core Tables

### users
Stores user authentication and profile information.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('client', 'physio')),
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### exercises
Base exercise definitions.

```sql
CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  phase INTEGER NOT NULL DEFAULT 1,
  target_muscle_groups TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### custom_exercise_configs (NEW)
Physiotherapist-created custom exercise configurations.

```sql
CREATE TABLE custom_exercise_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_type TEXT NOT NULL CHECK (exercise_type IN ('squat', 'heel_raise', 'hamstring_curl')),
  name TEXT NOT NULL,
  description TEXT,
  thresholds JSONB NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  adaptations TEXT[],
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_custom_exercise_configs_created_by ON custom_exercise_configs(created_by);
CREATE INDEX idx_custom_exercise_configs_exercise_type ON custom_exercise_configs(exercise_type);
CREATE INDEX idx_custom_exercise_configs_active ON custom_exercise_configs(is_active);
```

### physio_clients
Links physiotherapists with their patients.

```sql
CREATE TABLE physio_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  physio_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  consultation_code TEXT,
  UNIQUE(physio_id, client_id)
);
```

### assigned_exercises
Exercise assignments from physio to patient.

```sql
CREATE TABLE assigned_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  physio_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT REFERENCES exercises(id),
  custom_config_id UUID REFERENCES custom_exercise_configs(id), -- NEW: Link to custom config
  sets INTEGER NOT NULL DEFAULT 3,
  reps INTEGER NOT NULL DEFAULT 10,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Add index for custom config lookups
CREATE INDEX idx_assigned_exercises_custom_config ON assigned_exercises(custom_config_id);
```

### session_logs
Records of completed exercise sessions.

```sql
CREATE TABLE session_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_exercise_id UUID NOT NULL REFERENCES assigned_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  correct_reps INTEGER NOT NULL DEFAULT 0,
  incorrect_reps INTEGER NOT NULL DEFAULT 0,
  total_reps INTEGER GENERATED ALWAYS AS (correct_reps + incorrect_reps) STORED,
  average_form_score DECIMAL(5,2),
  form_feedback TEXT[],
  custom_thresholds_used JSONB, -- NEW: Store which custom thresholds were active
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for custom threshold analysis
CREATE INDEX idx_session_logs_custom_thresholds ON session_logs USING GIN (custom_thresholds_used);
```

## Custom Exercise Configuration Schema

The `thresholds` JSONB field in `custom_exercise_configs` stores exercise-specific parameters:

### Squat Configuration
```json
{
  "squat": {
    "minDepthAngle": 80,
    "maxDepthAngle": 110, 
    "torsoLeanMax": 30,
    "kneeTrackingMax": 15,
    "speedMin": 1.0,
    "speedMax": 3.0
  }
}
```

### Heel Raise Configuration
```json
{
  "heel_raise": {
    "minHeelLift": 3,
    "maxHeelLift": 8,
    "balanceThreshold": 10,
    "holdTimeMin": 0.5,
    "speedControl": 1.5
  }
}
```

### Hamstring Curl Configuration
```json
{
  "hamstring_curl": {
    "minFlexionAngle": 45,
    "maxFlexionAngle": 90,
    "hipStabilityMax": 15,
    "controlledSpeed": 2.0,
    "rangeOfMotion": 80
  }
}
```

## Row Level Security (RLS) Policies

### custom_exercise_configs
```sql
-- Enable RLS
ALTER TABLE custom_exercise_configs ENABLE ROW LEVEL SECURITY;

-- Physios can view/edit their own configurations
CREATE POLICY "physio_own_configs" ON custom_exercise_configs
  FOR ALL USING (created_by = auth.uid());

-- Clients can view configs assigned to them
CREATE POLICY "client_assigned_configs" ON custom_exercise_configs
  FOR SELECT USING (
    id IN (
      SELECT ae.custom_config_id 
      FROM assigned_exercises ae 
      WHERE ae.client_id = auth.uid() AND ae.custom_config_id IS NOT NULL
    )
  );
```

### assigned_exercises (Updated)
```sql
-- Add policy for custom configs
CREATE POLICY "assignments_with_custom_configs" ON assigned_exercises
  FOR ALL USING (
    client_id = auth.uid() OR 
    physio_id = auth.uid()
  );
```

## Migration Scripts

### Add Custom Config Support
```sql
-- Add custom_config_id to assigned_exercises
ALTER TABLE assigned_exercises 
ADD COLUMN custom_config_id UUID REFERENCES custom_exercise_configs(id);

-- Add index
CREATE INDEX idx_assigned_exercises_custom_config ON assigned_exercises(custom_config_id);

-- Add custom thresholds tracking to session_logs
ALTER TABLE session_logs 
ADD COLUMN custom_thresholds_used JSONB;

-- Add index for threshold analysis
CREATE INDEX idx_session_logs_custom_thresholds ON session_logs USING GIN (custom_thresholds_used);
```

## Example Queries

### Get Custom Configs for a Physio
```sql
SELECT * FROM custom_exercise_configs 
WHERE created_by = $1 
AND is_active = true 
ORDER BY updated_at DESC;
```

### Assign Custom Exercise to Patient
```sql
INSERT INTO assigned_exercises (
  client_id, physio_id, custom_config_id, sets, reps
) VALUES (
  $1, $2, $3, $4, $5
);
```

### Track Session with Custom Thresholds
```sql
INSERT INTO session_logs (
  client_id, assigned_exercise_id, set_number, 
  correct_reps, incorrect_reps, average_form_score,
  custom_thresholds_used
) VALUES (
  $1, $2, $3, $4, $5, $6, $7
);
```

### Analytics: Custom Config Effectiveness
```sql
-- Compare performance between standard and custom configs
SELECT 
  ae.custom_config_id IS NOT NULL as uses_custom,
  AVG(sl.average_form_score) as avg_form_score,
  AVG(sl.correct_reps::float / sl.total_reps) as completion_rate
FROM session_logs sl
JOIN assigned_exercises ae ON sl.assigned_exercise_id = ae.id
WHERE sl.completed_at >= NOW() - INTERVAL '30 days'
GROUP BY (ae.custom_config_id IS NOT NULL);
```