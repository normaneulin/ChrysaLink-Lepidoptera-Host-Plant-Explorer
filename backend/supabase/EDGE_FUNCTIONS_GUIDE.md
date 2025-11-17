# Supabase Edge Functions: Complete Guide

## What Are Supabase Edge Functions?

Supabase Edge Functions are **serverless functions** that run on Deno Edge Runtime, deployed globally at the edge (similar to AWS Lambda, Google Cloud Functions, or Cloudflare Workers).

### Key Characteristics:

| Aspect | Details |
|--------|---------|
| **Runtime** | Deno (TypeScript/JavaScript) |
| **Deployment** | Automatic, globally distributed |
| **Trigger** | HTTP POST requests from frontend |
| **Response** | JSON, text, or binary data |
| **Database Access** | Direct PostgreSQL connection via Supabase client |
| **Auth** | Built-in JWT verification from Supabase Auth |
| **Pricing** | Pay-per-invocation (included in free tier) |
| **Performance** | Cold start ~100-200ms, warm ~10-50ms |
| **Language** | TypeScript or JavaScript (Deno) |

---

## Why Use Edge Functions Instead of Traditional Backend?

| Traditional Backend | Edge Functions |
|-------------------|-----------------|
| Manage servers | Automatic scaling |
| Deploy infrastructure | Deploy code only |
| Always running (cost) | Pay per request |
| Latency from one region | Global edge distribution |
| Complex setup | Ready in minutes |

---

## ChrysaLink Needs 7+ Edge Functions

For the ChrysaLink system, you need these core Edge Functions:

### 1. **`signup`** - User Registration
- **Trigger:** Frontend form submission
- **Input:** email, password, name, bio
- **Process:**
  - Create user in `auth.users`
  - Create profile in `public.profiles`
  - Create rating_system in `public.rating_systems`
  - Send verification email
- **Output:** User ID, profile data
- **Errors:** Email exists, weak password, validation errors

### 2. **`login`** - User Authentication
- **Trigger:** Login form submission
- **Input:** email, password
- **Process:**
  - Verify credentials (handled by Supabase Auth)
  - Return JWT session token
- **Output:** Session token, user data
- **Note:** Mostly handled by Supabase Auth client, minimal Edge Function needed

### 3. **`upload-observation`** - Create New Observation
- **Trigger:** Observation form submission with image
- **Input:** 
  - image file (multipart/form-data)
  - lepidoptera_id (uuid)
  - plant_id (uuid)
  - location (string)
  - latitude, longitude (numbers)
  - observation_date (date)
  - notes (optional string)
  - is_public (boolean)
- **Process:**
  - Validate user is authenticated
  - Upload image to Supabase Storage
  - Create observation record
  - Trigger image recognition AI (optional)
  - Award points to user
- **Output:** Observation ID, image URL
- **Errors:** Not authenticated, invalid coordinates, image too large

### 4. **`verify-identification`** - Expert Verification
- **Trigger:** Expert user confirms identification
- **Input:**
  - identification_id (uuid)
  - approved (boolean)
  - notes (optional string)
- **Process:**
  - Verify user has Expert+ rating
  - Update identification.is_verified
  - Award points to identification creator
  - Trigger notification
  - Update relationships observation_count
  - Check for achievement unlocks
- **Output:** Updated identification data
- **Errors:** Insufficient expertise, already verified

### 5. **`award-points`** - Point System
- **Trigger:** Various actions (verifications, comments, etc.)
- **Input:**
  - user_id (uuid)
  - points_amount (integer)
  - reason (string: 'identification_verified', 'observation_created', etc.)
  - identification_id or observation_id (optional)
- **Process:**
  - Add entry to points_ledger
  - Update rating_systems.points_awarded_total
  - Update expertise_level if threshold met
  - Check achievement unlock conditions
- **Output:** New point total, updated expertise level
- **Error Handling:** Validation, user exists

### 6. **`send-notification`** - Alert System
- **Trigger:** When events occur (comment, identification, verification)
- **Input:**
  - user_id (uuid)
  - type (string: 'new_comment', 'identification_verified', etc.)
  - observation_id, identification_id, comment_id (optional uuids)
  - message (string)
- **Process:**
  - Create notification record
  - Send push notification (optional, via external service)
  - Send email notification (optional)
- **Output:** Notification ID
- **Error Handling:** User exists, valid notification type

### 7. **`image-recognition`** - AI Species Identification
- **Trigger:** After observation upload (automatic)
- **Input:**
  - image_url (string)
  - image_storage_path (string)
  - observation_id (uuid)
- **Process:**
  - Call AI/ML service (TensorFlow, Google Cloud Vision, or custom model)
  - Detect butterfly species
  - Return top 5 matches with confidence scores
  - Create auto_suggested identification records
- **Output:** Array of suggested species with confidence
- **Errors:** Image invalid, API down, no species detected

### 8. **`search-observations`** (Bonus) - Advanced Search
- **Trigger:** Map filter or search bar
- **Input:**
  - query (string)
  - filters: { lepidoptera_id, plant_id, location, date_range, user_id }
- **Process:**
  - Query observations with RLS (respects public/private)
  - Apply filters
  - Return paginated results
  - Include relationship data
- **Output:** Array of observation objects with metadata
- **Error Handling:** Invalid pagination, invalid filters

---

## File Structure for Edge Functions

```
backend/
├── supabase/
│   ├── functions/
│   │   ├── signup/
│   │   │   ├── index.ts          # Main function code
│   │   │   └── types.ts          # TypeScript interfaces
│   │   ├── upload-observation/
│   │   │   ├── index.ts
│   │   │   ├── types.ts
│   │   │   └── validate.ts       # Validation logic
│   │   ├── verify-identification/
│   │   │   ├── index.ts
│   │   │   ├── types.ts
│   │   │   └── services.ts       # Helper functions
│   │   ├── award-points/
│   │   │   ├── index.ts
│   │   │   └── types.ts
│   │   ├── send-notification/
│   │   │   ├── index.ts
│   │   │   └── types.ts
│   │   ├── image-recognition/
│   │   │   ├── index.ts
│   │   │   ├── types.ts
│   │   │   └── ml-service.ts     # AI/ML integration
│   │   ├── search-observations/
│   │   │   ├── index.ts
│   │   │   └── types.ts
│   │   ├── shared/
│   │   │   ├── types.ts          # Shared types for all functions
│   │   │   ├── auth.ts           # JWT verification helpers
│   │   │   ├── db.ts             # Database client utilities
│   │   │   ├── errors.ts         # Custom error classes
│   │   │   └── validators.ts     # Reusable validation
│   │   └── deno.json             # Deno config with dependencies
│   ├── migrations/
│   └── ...
```

---

## How Edge Functions Are Called

### From Frontend (React):

```typescript
// src/services/api.ts
const response = await fetch(
  'https://YOUR_PROJECT.supabase.co/functions/v1/signup',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      email: 'user@example.com',
      password: 'secure_password',
      name: 'John Doe',
      bio: 'Butterfly enthusiast',
    }),
  }
);

const data = await response.json();
if (!response.ok) {
  throw new Error(data.error);
}
```

### From Another Edge Function:

```typescript
// Within an Edge Function
const response = await fetch(
  `${Deno.env.get('SUPABASE_URL')}/functions/v1/award-points`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({
      user_id: userId,
      points_amount: 50,
      reason: 'identification_verified',
    }),
  }
);
```

---

## Basic Edge Function Structure

Every Edge Function follows this pattern:

```typescript
// functions/example/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const { data: body, error: parseError } = await req.json()
    if (parseError) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: corsHeaders }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      )
    }

    // TODO: Your business logic here

    return new Response(
      JSON.stringify({ success: true, data: {} }),
      { status: 200, headers: corsHeaders }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
```

---

## Key Differences from Traditional Backend

| Aspect | Traditional API | Edge Function |
|--------|-----------------|---------------|
| **Startup** | Always running | Start on request |
| **Dependencies** | npm/yarn | Deno (npm via esm.sh) |
| **Environment** | Many libraries | Restricted, uses Deno stdlib |
| **Database** | Connection pooling | Direct connection per request |
| **File Storage** | Server filesystem | Supabase Storage only |
| **Debugging** | Local debugger | Supabase Logs or local testing |

---

## Advantages for ChrysaLink

1. **No Server Management** - Supabase handles scaling
2. **Zero Cold Costs** - Pay only when functions execute
3. **Global Distribution** - Requests served from nearest edge location
4. **Built-in Auth** - JWT verification out of the box
5. **Database Integration** - Direct PostgreSQL access
6. **Simple Deployment** - No Docker, no CI/CD needed
7. **TypeScript Support** - Full type safety with Deno

---

## Next Steps

1. Create the 7 Edge Functions listed above
2. Each function gets its own directory with `index.ts`
3. Create shared utilities (auth, db, errors, validators)
4. Test locally using Supabase CLI (or without it using manual POST requests)
5. Deploy automatically to Supabase
6. Connect React frontend to call these functions

---

## When NOT to Use Edge Functions

- **Long-running tasks** (> 10 minutes) → Use scheduled functions or job queue
- **Large file processing** (> 100MB) → Process on client or dedicated server
- **Complex state management** → Use backend service
- **Heavy computations** → Use dedicated compute service

For ChrysaLink, all 7 functions fit perfectly in the Edge Function model (fast requests, database operations, notifications).

