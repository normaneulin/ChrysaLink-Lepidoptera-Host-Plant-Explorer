# Supabase Functions Documentation

This document outlines all PostgreSQL functions and triggers in the ChrysaLink Supabase database.

---

## 1. `award_points()`

**Purpose:** Awards points to a user, updates their rating system, and determines expertise level.

| Property | Value |
|----------|-------|
| **Full Name** | `public.award_points()` |
| **Type** | Stored Procedure / Function |
| **Language** | PL/pgSQL |
| **Arguments** | `p_user_id UUID`, `p_points INT`, `p_reason VARCHAR`, `p_identification_id UUID` (optional), `p_observation_id UUID` (optional) |
| **Return Type** | TABLE (v_new_rating INT, v_new_expertise_level VARCHAR) |
| **Security** | SECURITY DEFINER |
| **Execution Context** | Executed by application or triggers |

**Description:** 
- Inserts a record into `points_ledger`
- Calculates cumulative rating from all points
- Determines expertise level based on rating thresholds
- Updates the `rating_systems` table

**Expertise Level Mapping:**
- < 100 points: Novice
- 100-299 points: Amateur
- 300-699 points: Intermediate
- 700-1499 points: Expert
- ≥ 1500 points: Specialist

---

## 2. `check_achievements()`

**Purpose:** Checks which achievements a user is eligible to unlock based on their activity.

| Property | Value |
|----------|-------|
| **Full Name** | `public.check_achievements()` |
| **Type** | Stored Function |
| **Language** | PL/pgSQL |
| **Arguments** | `p_user_id UUID` |
| **Return Type** | TABLE (id UUID, name VARCHAR, points_reward INT) |
| **Security** | SECURITY DEFINER |
| **Execution Context** | Called by `auto_unlock_achievements` trigger |

**Description:**
Calculates user statistics and returns eligible achievements:
- `observations_count` - Total observations created
- `identifications_verified` - Total verified identifications by user
- `species_documented` - Unique species identified
- `rating_threshold` - Total points earned

Only returns achievements that:
1. User hasn't already unlocked
2. Meet the requirement threshold

---

## 3. `current_user_id()`

**Purpose:** Returns the ID of the currently authenticated user.

| Property | Value |
|----------|-------|
| **Full Name** | `public.current_user_id()` |
| **Type** | Stored Function |
| **Language** | PL/pgSQL |
| **Arguments** | None |
| **Return Type** | UUID |
| **Security** | SECURITY DEFINER |
| **Execution Context** | Called from frontend/application |

**Description:**
Simple wrapper around `auth.uid()` for easier access to current user's ID. Can be used in SELECT statements and policies.

---

## 4. `handle_new_user()` - TRIGGER FUNCTION

**Purpose:** Automatically creates a user profile when a new user registers.

| Property | Value |
|----------|-------|
| **Full Name** | `public.handle_new_user()` |
| **Type** | Trigger Function |
| **Language** | PL/pgSQL |
| **Arguments** | TRIGGER context (NEW record from auth.users) |
| **Return Type** | TRIGGER (RETURNS trigger) |
| **Security** | SECURITY DEFINER |
| **Triggered By** | `AFTER INSERT ON auth.users` |

**Associated Trigger:**
```sql
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
```

**Definition:**
```sql
BEGIN
  INSERT INTO public.profiles (id, username, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email
  );
  RETURN new;
END;
```

**Description:**
- Automatically inserts a row into `profiles` table when a new auth user is created
- Sets `username` from user metadata or derives from email
- Sets `email` from auth.users table
- Leaves `name` as NULL (user edits in profile later)

**⚠️ Note:** This trigger conflicts with frontend profile creation in `auth-service.ts`. Consider disabling if frontend handles profile creation.

---

## 5. `auto_unlock_achievements()` - TRIGGER FUNCTION

**Purpose:** Automatically unlocks achievements when user meets requirements.

| Property | Value |
|----------|-------|
| **Full Name** | `public.auto_unlock_achievements()` |
| **Type** | Trigger Function |
| **Language** | PL/pgSQL |
| **Arguments** | TRIGGER context (NEW record) |
| **Return Type** | TRIGGER (RETURNS trigger) |
| **Security** | SECURITY DEFINER |
| **Triggered By** | On user activity updates |

**Definition:**
```sql
DECLARE
  v_achievement RECORD;
BEGIN
  FOR v_achievement IN 
    SELECT * FROM check_achievements(NEW.user_id)
  LOOP
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (NEW.user_id, v_achievement.achievement_id)
    ON CONFLICT DO NOTHING;

    -- Award bonus points for achievement
    PERFORM award_points(
      NEW.user_id,
      v_achievement.points_reward,
      'bonus_achievement',
      NULL,
      NULL
    );
  END LOOP;
  RETURN NEW;
END;
```

**Description:**
- Iterates through all unlockable achievements via `check_achievements()`
- Inserts achievement unlock record
- Awards bonus points to user
- Uses `ON CONFLICT DO NOTHING` to prevent duplicate unlocks

---

## 6. `update_observation_counts_on_verification()` - TRIGGER FUNCTION

**Purpose:** Updates user profile statistics when an identification is verified.

| Property | Value |
|----------|-------|
| **Full Name** | `public.update_observation_counts_on_verification()` |
| **Type** | Trigger Function |
| **Language** | PL/pgSQL |
| **Arguments** | TRIGGER context (NEW, OLD records from identifications) |
| **Return Type** | TRIGGER (RETURNS trigger) |
| **Security** | SECURITY DEFINER |
| **Triggered By** | `AFTER UPDATE ON identifications` |

**Associated Trigger:**
```sql
CREATE TRIGGER trigger_update_counts_on_verification
AFTER UPDATE ON identifications
FOR EACH ROW
EXECUTE FUNCTION public.update_observation_counts_on_verification();
```

**Definition:**
```sql
BEGIN
  IF NEW.is_verified AND NOT OLD.is_verified THEN
    -- Update profile statistics
    UPDATE profiles
    SET 
      validated_identifications = validated_identifications + 1,
      validated_species = (SELECT COUNT(DISTINCT species) FROM identifications WHERE user_id = NEW.verified_by_user_id AND is_verified = true)
    WHERE id = NEW.verified_by_user_id;
    
    -- Update rating system verified count
    UPDATE rating_systems
    SET verified_identification_count = verified_identification_count + 1
    WHERE user_id = NEW.verified_by_user_id;
  END IF;
  RETURN NEW;
END;
```

**Description:**
When an identification transitions from unverified to verified:
- Increments `validated_identifications` count in user's profile
- Updates `validated_species` count (distinct species verified by user)
- Increments `verified_identification_count` in rating_systems table

**Condition:** Only executes if `NEW.is_verified = TRUE` AND `OLD.is_verified = FALSE`

---

## 7. `update_updated_at_column()` - TRIGGER FUNCTION

**Purpose:** Automatically updates the `updated_at` timestamp on record modifications.

| Property | Value |
|----------|-------|
| **Full Name** | `public.update_updated_at_column()` |
| **Type** | Trigger Function |
| **Language** | PL/pgSQL |
| **Arguments** | TRIGGER context (NEW record) |
| **Return Type** | TRIGGER (RETURNS trigger) |
| **Security** | Standard |
| **Triggered By** | `BEFORE UPDATE` on multiple tables |

**Associated Triggers:**
```sql
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
CREATE TRIGGER update_rating_systems_updated_at BEFORE UPDATE ON rating_systems
CREATE TRIGGER update_observations_updated_at BEFORE UPDATE ON observations
CREATE TRIGGER update_identifications_updated_at BEFORE UPDATE ON identifications
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
CREATE TRIGGER update_relationships_updated_at BEFORE UPDATE ON relationships
```

**Definition:**
```sql
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
```

**Description:**
Simple utility function used by multiple tables to automatically set `updated_at = CURRENT_TIMESTAMP` whenever a record is modified.

---

## Trigger Execution Flow

```
User Registration
  ↓
[on_auth_user_created trigger fires]
  ↓
handle_new_user() creates profile
  ↓
[Application creates identification]
  ↓
[on_identification_verified trigger fires]
  ↓
update_observation_counts_on_verification()
  ↓
[If achievement unlocked, auto_unlock_achievements fires]
  ↓
check_achievements() & award_points()
```

---

## Security Notes

- **SECURITY DEFINER functions** execute with the privileges of the function owner (postgres user)
- Use with caution - ensure proper Row Level Security (RLS) policies are in place
- Standard functions use caller's privileges
- All trigger functions have implicit access to NEW/OLD records

---

## Maintenance Recommendations

1. Monitor trigger performance on high-volume tables (identifications, observations)
2. Index frequently queried columns in achievement checks
3. Consider archiving old points_ledger records for users with large transaction histories
4. Review RLS policies to ensure triggers respect data privacy
5. **CRITICAL:** Review `handle_new_user()` trigger - it may conflict with frontend profile creation
