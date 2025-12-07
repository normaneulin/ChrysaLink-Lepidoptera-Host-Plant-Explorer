# Points and Badge System Documentation

## Overview

The ChrysaLink Points and Badge System is designed to gamify user engagement by awarding points for contributions and automatically promoting users through badge levels based on accumulated points. Users receive notifications when they unlock achievements or elevate to higher badge levels.

## Badge Levels and Point Thresholds

Users progress through 5 badge levels based on total points accumulated:

| Badge Level | Points Range | Color | Description |
|---|---|---|---|
| **Novice** | 0-99 | Gray | Getting started with the community |
| **Amateur** | 100-249 | Yellow | Contributed consistently |
| **Intermediate** | 250-499 | Green | Recognized contributor |
| **Expert** | 500-999 | Blue | Advanced expertise |
| **Specialist** | 1000+ | Purple | Master contributor |

### Key Facts About Badges:
- Users automatically progress to higher badges as they accumulate points
- A notification is sent when a user elevates to a new badge level
- The badge level is displayed on the user's profile with a visual star icon
- Current points are shown alongside the badge level

## Points System

Points are awarded through the `points_ledger` table for various actions:

### Points Award Reasons:
- `observation_created` - User uploads a new observation (typically 5-10 points)
- `identification_verified` - User's identification suggestion is verified (typically 10-20 points)
- `identification_accepted` - Community accepts user's identification (typically 5-10 points)
- `comment_helpful` - User's comment is marked helpful (typically 2-5 points)
- `bonus_achievement` - User unlocks an achievement (varies by achievement)

### Database Tables:

#### `points_ledger`
Tracks all points transactions for users:

```sql
CREATE TABLE public.points_ledger (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL (fk: auth.users),
  identification_id UUID NULL (fk: identifications),
  observation_id UUID NULL (fk: observations),
  points_amount INTEGER NOT NULL,
  reason VARCHAR(100) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `rating_systems`
Stores user badge level and points statistics:

```sql
CREATE TABLE public.rating_systems (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL (fk: auth.users),
  current_rating INTEGER DEFAULT 0,
  expertise_level VARCHAR(20) DEFAULT 'Novice',
  previous_expertise_level VARCHAR(20) DEFAULT NULL,
  verified_identification_count INTEGER DEFAULT 0,
  points_awarded_total INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `badge_thresholds`
Defines the badge levels and point ranges:

```sql
CREATE TABLE public.badge_thresholds (
  id UUID PRIMARY KEY,
  level VARCHAR(20) UNIQUE NOT NULL,
  min_points INTEGER NOT NULL,
  max_points INTEGER NULL,
  description TEXT,
  color VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Pre-populated data:**
```
Novice: 0-99 (gray)
Amateur: 100-249 (yellow)
Intermediate: 250-499 (green)
Expert: 500-999 (blue)
Specialist: 1000+ (purple)
```

## Achievements System

Users can unlock achievements based on various criteria:

### Achievement Types

Achievements are checked when points are awarded. Each achievement has:
- `name` - Achievement title (e.g., "First Observation")
- `description` - What the achievement represents
- `icon_url` - Icon for displaying the achievement
- `points_reward` - Bonus points awarded when unlocked
- `requirement_type` - Type of requirement to check
- `requirement_value` - Threshold value for that requirement

### Requirement Types

1. **observations_count** - Number of observations uploaded
   - Example: "First Observation" (1 observation = 10 points)
   - Example: "Prolific Observer" (50 observations = 100 points)

2. **identifications_verified** - Number of verified identifications
   - Example: "First Identification" (1 verified = 5 points)
   - Example: "Verified Identifier" (10 verified = 50 points)

3. **species_documented** - Number of distinct species documented
   - Example: "Species Expert" (50 species = 200 points)

4. **rating_threshold** - Total rating points accumulated
   - Example: "Rating Master" (500 points = 100 points)

5. **community_contribution** - Community contribution metric
   - Example: "Community Champion" (100 verified IDs = 300 points)

### Database Tables:

#### `achievements`
Defines available achievements:

```sql
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  icon_url TEXT NULL,
  points_reward INTEGER DEFAULT 0,
  requirement_type VARCHAR(50) NOT NULL,
  requirement_value INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `user_achievements`
Tracks which achievements each user has unlocked:

```sql
CREATE TABLE public.user_achievements (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL (fk: auth.users),
  achievement_id UUID NOT NULL (fk: achievements),
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_achievement UNIQUE (user_id, achievement_id)
);
```

## Notifications System

Users receive notifications for badge elevations and achievement unlocks.

### Database Table: `notifications`

```sql
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL (fk: auth.users),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  related_badge_id UUID NULL (fk: achievements),
  related_achievement_id UUID NULL (fk: achievements),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Notification Types:
- `badge_elevation` - User elevated to new badge level
- `achievement_unlocked` - User unlocked an achievement
- `identification_verified` - User's identification was verified
- `comment_helpful` - User's comment was marked helpful
- `rating_milestone` - User reached a points milestone

### Notification Triggers:
- **Badge Elevation**: Auto-created when user's badge level increases
- **Achievement Unlock**: Auto-created when user meets achievement requirements
- **Manual Creation**: Via API for other notification types

## Database Functions and Triggers

### Function: `check_and_award_achievements(p_user_id UUID)`
Checks all achievement requirements and awards new achievements.

**Purpose**: Evaluates user's current stats against all achievement requirements and creates new achievements and notifications.

**Called by**: `trigger_check_achievements_after_points`

**Returns**: Table with achievement_id, achievement_name, is_new

### Function: `check_and_update_badge_level(p_user_id UUID)`
Checks if user's badge level should be updated based on points.

**Purpose**: Determines current badge level from total points, updates rating_systems if level changed, and creates notification.

**Called by**: `trigger_check_achievements_after_points`

**Returns**: Table with previous_level, new_level, badge_elevated

### Trigger: `after_points_awarded`
Automatically runs when points are added to a user.

**Fires on**: INSERT into points_ledger

**Actions**:
1. Calls `check_and_award_achievements()`
2. Calls `check_and_update_badge_level()`

## Frontend Components

### `ProfilePage.tsx`
Main profile display component. Shows:
- User avatar and basic info
- **Current badge level** with star icon and points display
- Observations, species, and identifications stats
- Achievements section
- Badge level progression table
- How to increase badge level instructions

**New Props**: `accessToken`, `userId`

**New State**:
- `badge` - Current badge info with total points
- `badgeThresholds` - All badge level definitions

**New Functions**:
- `fetchBadge()` - Fetches user's badge and total points
- `fetchBadgeThresholds()` - Fetches all badge definitions

### `BadgeNotificationPopup.tsx`
Floating notification component that appears when user elevates badges.

**Features**:
- Auto-fetches unread notifications every 5 seconds
- Displays badge elevation notifications as animated popups
- Only displays badge elevations (not other notification types)
- Dismisses notification and marks as read on button click
- Fixed position top-right corner
- Gradient background with trophy icon

**Props**: `userId`, `accessToken`

### `AchievementsList.tsx`
Displays all unlocked achievements for a user.

**Features**:
- Shows achievement name, description, and points reward
- Displays unlock date
- Grid layout with 2 columns on desktop
- Loading skeleton states
- Empty state when no achievements

**Props**: `userId`, `accessToken`

## API Endpoints (Client Methods)

All methods in `frontend/src/api/client.ts`:

### `getUserBadge(userId: string): Promise<ApiResponse>`
Fetches badge info and calculates total points.

```typescript
const response = await apiClient.getUserBadge(userId);
// Returns: { expertise_level, current_rating, totalPoints, ... }
```

### `getUserAchievements(userId: string): Promise<ApiResponse>`
Fetches all unlocked achievements with details.

```typescript
const response = await apiClient.getUserAchievements(userId);
// Returns: Array of { id, unlocked_at, achievement: {...} }
```

### `getUnreadNotifications(userId: string): Promise<ApiResponse>`
Fetches unread notifications only.

```typescript
const response = await apiClient.getUnreadNotifications(userId);
// Returns: Array of unread notifications
```

### `markNotificationAsRead(notificationId: string): Promise<ApiResponse>`
Marks a single notification as read.

```typescript
await apiClient.markNotificationAsRead(notificationId);
```

### `getAllNotifications(userId: string, limit: number, offset: number): Promise<ApiResponse>`
Fetches paginated notification history.

```typescript
const response = await apiClient.getAllNotifications(userId, 20, 0);
// Returns: { notifications: [...], total: number }
```

### `getBadgeThresholds(): Promise<ApiResponse>`
Fetches all badge level definitions.

```typescript
const response = await apiClient.getBadgeThresholds();
// Returns: Array of badge threshold objects
```

## Integration Guide

### Adding Points to a User

When an action occurs that should award points:

```typescript
// Insert into points_ledger via Supabase
const { data, error } = await supabase
  .from('points_ledger')
  .insert({
    user_id: userId,
    observation_id: observationId,  // if applicable
    identification_id: identificationId,  // if applicable
    points_amount: 10,
    reason: 'observation_created',
    description: 'Uploaded observation'
  });
```

The trigger will automatically:
1. Check all achievements and award new ones
2. Check if badge level should be updated
3. Create notifications for badges/achievements

### Displaying Badge Info

In any component:

```typescript
const response = await apiClient.getUserBadge(userId);
if (response.success) {
  const { expertise_level, totalPoints } = response.data;
  console.log(`User is ${expertise_level} with ${totalPoints} points`);
}
```

### Displaying Achievements

In any component:

```typescript
const response = await apiClient.getUserAchievements(userId);
if (response.success) {
  const achievements = response.data;
  // Render achievement cards
}
```

### Checking Notifications

```typescript
const response = await apiClient.getUnreadNotifications(userId);
if (response.success) {
  const notifications = response.data;
  // Show notification count or display popups
}
```

## Database Migration

Apply the migration file to your Supabase project:

```bash
# File: backend/supabase/migrations/012_badge_and_notification_system.sql
```

The migration:
1. Creates `notifications` table with indexes
2. Creates `badge_thresholds` table and pre-populates badge data
3. Adds `previous_expertise_level` column to `rating_systems`
4. Creates `check_and_award_achievements()` function
5. Creates `check_and_update_badge_level()` function
6. Creates `trigger_check_achievements_after_points` trigger
7. Creates utility functions for notifications

## User Flow

1. **User performs action** (uploads observation, identification verified, etc.)
2. **Points awarded** → Points inserted into `points_ledger` table
3. **Trigger fires** → `after_points_awarded` runs
4. **Achievements checked** → New achievements may be unlocked
   - Notification created for each new achievement
   - Achievement unlocked notification sent
5. **Badge checked** → User's badge level updated if points crossed threshold
   - If badge elevated: Previous level saved, new level set
   - Notification created with badge upgrade message
6. **Frontend polls** → Notification popup displays badge elevation
7. **User dismisses** → Notification marked as read

## Example Progression

```
User starts: 0 points, Novice badge

Event: Create first observation (5 pts)
→ Points ledger: 5 points total
→ Achievement unlocked: "First Observation" (+10 pts)
→ Points ledger: 15 points total
→ Notification: "Achievement Unlocked: First Observation!"

Event: Get 5 verified identifications (50 pts)
→ Points ledger: 65 points total
→ No badge change (still 0-99 range)

Event: Get 10 more verified identifications (100 pts)
→ Points ledger: 165 points total
→ Badge elevation: Novice → Amateur
→ Notification: "Badge Elevated to Amateur!"
→ ProfilePage shows "Amateur" badge with 165 points
```

## Performance Considerations

- **Indexes**: Notifications, points_ledger, user_achievements all indexed for fast queries
- **Trigger Performance**: Triggers only run on points insert, not on every page load
- **Polling**: Frontend polls every 5 seconds for unread notifications (can be optimized with WebSocket in future)
- **Caching**: Consider caching badge_thresholds since they rarely change

## Future Enhancements

1. **Streaks**: Add streak tracking (consecutive days contributing)
2. **Leaderboards**: Query top users by points/badges
3. **Badges for special categories**: Lepidoptera specialist, Plant expert, etc.
4. **Point decay**: Reduce points for inactive users
5. **WebSocket notifications**: Real-time badge popups instead of polling
6. **Badges for seasonal events**: Limited-time achievements
7. **Challenge badges**: Group achievements (e.g., "Document all butterflies in region X")

