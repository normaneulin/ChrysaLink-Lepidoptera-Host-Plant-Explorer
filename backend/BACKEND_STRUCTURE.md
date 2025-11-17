# ChrysaLink Backend Architecture & Folder Structure

## Overview

The ChrysaLink backend uses **Supabase** as its primary Backend-as-a-Service (BaaS) platform, with the following architecture:

- **Database**: PostgreSQL (managed by Supabase)
- **Edge Functions**: Deno runtime (serverless functions for business logic)
- **Authentication**: Supabase Auth (JWT-based)
- **Real-time**: Supabase Realtime (WebSocket)
- **Storage**: Supabase Storage (file uploads)
- **KV Store**: Supabase Vector/KV store (caching & persistence fallback)

---

## Backend Folder Structure

```
backend/
├── supabase/                              # Supabase project configuration & implementation
│   ├── migrations/                        # PostgreSQL schema migrations
│   │   ├── 001_init.sql                  # Initial schema setup
│   │   ├── 002_taxonomy_divisions.sql    # Taxonomy tables
│   │   ├── 003_lepidoptera_plant_taxonomy.sql
│   │   ├── 004_core_entities.sql         # Users, observations, profiles
│   │   ├── 005_points_and_achievements.sql
│   │   └── 006_fix_schema_inconsistencies.sql
│   │
│   ├── functions/                         # Edge Functions (Deno serverless)
│   │   └── make-server-b55216b3/         # Main API server
│   │       ├── src/
│   │       │   ├── config/                # Configuration (env, Supabase client)
│   │       │   ├── controllers/           # Route handlers & business logic
│   │       │   ├── middleware/            # Auth, validation, error handling
│   │       │   ├── services/              # Database & external API calls
│   │       │   ├── types/                 # TypeScript interfaces
│   │       │   ├── utils/                 # Helper functions
│   │       │   └── index.ts               # Hono server entry point
│   │       ├── deno.json                  # Deno configuration & dependencies
│   │       └── deno.lock                  # Dependency lock file
│   │
│   ├── schemas/                           # Generated TypeScript types from DB schema
│   │   ├── database.types.ts              # Auto-generated DB type definitions
│   │   └── api.types.ts                   # API request/response types
│   │
│   ├── seed/                              # Database seeding scripts
│   │   ├── seed.ts                        # Main seed function
│   │   ├── species.json                   # Lepidoptera species taxonomy
│   │   └── plants.json                    # Host plants taxonomy
│   │
│   ├── EDGE_FUNCTIONS_GUIDE.md            # Documentation for edge functions
│   └── README.md                          # Supabase-specific setup guide
│
├── config/                                # Global backend configuration
│   ├── .env.example                       # Environment variables template
│   ├── .env.development                   # Dev environment secrets
│   └── .env.production                    # Production environment secrets
│
├── docs/                                  # Backend documentation
│   ├── API.md                             # API endpoints reference
│   ├── ARCHITECTURE.md                    # System design & data flow
│   ├── DEPLOYMENT.md                      # Deployment instructions
│   └── DATABASE.md                        # Database schema documentation
│
└── BACKEND_STRUCTURE.md                   # This file
```

---

## Folder-by-Folder Breakdown

### 📂 **`backend/supabase/`** - Supabase Configuration Root
**Purpose**: Central location for all Supabase-specific configuration and implementation.

**Key Files**:
- `EDGE_FUNCTIONS_GUIDE.md` - How to write & deploy edge functions
- `README.md` - Supabase setup, authentication, and deployment steps

**When to modify**: When updating database schema, deploying new edge functions, or changing Supabase configuration.

---

### 📂 **`backend/supabase/migrations/`** ⭐ Already Exists
**Purpose**: PostgreSQL database schema versioning and migration scripts.

**Files**:
- `001_init.sql` - Initial schema setup (core tables)
- `002_taxonomy_divisions.sql` - Taxonomy structure
- `003_lepidoptera_plant_taxonomy.sql` - Lepidoptera & plant data
- `004_core_entities.sql` - User profiles, observations, identifications
- `005_points_and_achievements.sql` - Gamification system
- `006_fix_schema_inconsistencies.sql` - Schema corrections

**How to use**:
1. Write new migrations for schema changes
2. Name them sequentially: `007_feature_name.sql`
3. Deploy with: `supabase migration up`

**Example new migration**:
```sql
-- 007_add_notification_preferences.sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  email_on_identification BOOLEAN DEFAULT TRUE,
  email_on_comment BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### 📂 **`backend/supabase/functions/make-server-b55216b3/`** - Edge Functions Entry Point
**Purpose**: Root directory for your main API server (Deno + Hono).

**Structure**:
- `index.tsx` - Hono server entry point (main router)
- `deno.json` - Deno configuration, imports, dependencies
- `src/` - Source code (controllers, services, middleware, etc.)

**When to modify**: When adding new API routes, changing middleware stack, or updating dependencies.

---

### 📂 **`src/config/`** - Configuration Management
**Purpose**: Centralized configuration for Supabase client, environment variables, and API settings.

**Expected Files**:
```
src/config/
├── supabase.ts              # Supabase client initialization
├── environment.ts           # Environment variable validation
├── api.config.ts            # API-wide settings (timeouts, limits)
└── constants.ts             # Application constants
```

**Example - `supabase.ts`**:
```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export const supabase = createClient(supabaseUrl, supabaseKey);
```

**When to modify**: When adding new environment variables, changing Supabase configuration, or updating API constants.

---

### 📂 **`src/controllers/`** - Route Handlers & Business Logic
**Purpose**: HTTP request handlers organized by feature. Each controller handles a specific domain (auth, observations, users).

**Expected Files**:
```
src/controllers/
├── auth.controller.ts           # signup, login, logout, password reset
├── observation.controller.ts    # upload, list, get, delete observations
├── identification.controller.ts # submit identifications, verify, award points
├── user.controller.ts           # user profile, stats, preferences
├── notification.controller.ts   # send notifications, get notifications
└── index.ts                      # Export all controllers
```

**Example - `auth.controller.ts`**:
```typescript
import { Context } from "https://esm.sh/hono";
import { AuthService } from "../services/auth.service.ts";

export const signup = async (c: Context) => {
  const { email, password, fullName } = await c.req.json();
  
  try {
    const user = await AuthService.signup(email, password, fullName);
    return c.json(user, 201);
  } catch (error) {
    return c.json({ error: error.message }, 400);
  }
};

export const login = async (c: Context) => {
  const { email, password } = await c.req.json();
  const { user, session } = await AuthService.login(email, password);
  return c.json({ user, session });
};
```

**When to modify**: When adding new API endpoints or changing request/response handling.

---

### 📂 **`src/middleware/`** - Cross-Cutting Concerns
**Purpose**: Middleware for authentication, validation, error handling, logging, and CORS.

**Expected Files**:
```
src/middleware/
├── auth.middleware.ts           # JWT verification, user context
├── error.middleware.ts          # Global error handling
├── validation.middleware.ts      # Request body/query validation
├── logging.middleware.ts         # Request/response logging
├── cors.middleware.ts            # CORS configuration
└── index.ts                      # Middleware stack
```

**Example - `auth.middleware.ts`**:
```typescript
import { Context, Next } from "https://esm.sh/hono";
import { jwtVerify } from "https://esm.sh/jose";

export const authMiddleware = async (c: Context, next: Next) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const verified = await jwtVerify(token, new TextEncoder().encode(Deno.env.get("JWT_SECRET")!));
    c.set("user", verified.payload);
    await next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
};
```

**When to modify**: When updating authentication, adding validation rules, or changing error handling.

---

### 📂 **`src/services/`** - Business Logic & Data Access
**Purpose**: Service layer for database operations, external API calls, and business logic. Keeps controllers clean.

**Expected Files**:
```
src/services/
├── auth.service.ts              # User signup, login, JWT generation
├── observation.service.ts       # CRUD operations for observations
├── identification.service.ts    # Process identifications, award points
├── user.service.ts              # Profile, statistics, preferences
├── image.service.ts             # Image upload, ML recognition API
├── notification.service.ts      # Send emails, in-app notifications
├── kv-store.service.ts          # KV store caching operations
└── index.ts                      # Export all services
```

**Example - `observation.service.ts`**:
```typescript
import { supabase } from "../config/supabase.ts";

export const ObservationService = {
  async createObservation(userId: string, data: CreateObservationDTO) {
    const { data: observation, error } = await supabase
      .from("observations")
      .insert([{ user_id: userId, ...data }])
      .select();
    
    if (error) throw error;
    return observation[0];
  },

  async getObservationsByUser(userId: string) {
    const { data, error } = await supabase
      .from("observations")
      .select("*")
      .eq("user_id", userId);
    
    if (error) throw error;
    return data;
  }
};
```

**When to modify**: When implementing business logic, adding database queries, or integrating external APIs.

---

### 📂 **`src/types/`** - TypeScript Type Definitions
**Purpose**: Centralized TypeScript interfaces for request/response bodies, database entities, and API contracts.

**Expected Files**:
```
src/types/
├── index.ts                     # Export all types
├── observation.types.ts         # Observation DTO, request/response types
├── user.types.ts                # User profile, authentication types
├── identification.types.ts      # Identification suggestion types
├── api-response.types.ts        # Standard API response wrapper
└── common.types.ts              # Shared types (pagination, filters)
```

**Example - `observation.types.ts`**:
```typescript
export interface CreateObservationDTO {
  lepidoptera_id: string;
  host_plant_id: string;
  latitude: number;
  longitude: number;
  observation_date: string;
  photos: string[]; // file paths
  notes?: string;
}

export interface ObservationResponse {
  id: string;
  user_id: string;
  lepidoptera_id: string;
  host_plant_id: string;
  latitude: number;
  longitude: number;
  observation_date: string;
  photos: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

**When to modify**: When adding new API endpoints or changing data structures.

---

### 📂 **`src/utils/`** - Helper Functions & Utilities
**Purpose**: Reusable utility functions, validators, formatters, and common operations.

**Expected Files**:
```
src/utils/
├── validators.ts                # Email, GPS, date validation
├── formatters.ts                # Data formatting, response building
├── error-handler.ts             # Custom error classes, error responses
├── uuid.ts                       # UUID generation utilities
├── logger.ts                     # Logging utility
└── constants.ts                 # Shared constants
```

**Example - `validators.ts`**:
```typescript
export const validateGPS = (lat: number, lng: number): boolean => {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

export const validateEmail = (email: string): boolean => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

export const validateObservationDate = (date: string): boolean => {
  const parsed = new Date(date);
  return !isNaN(parsed.getTime()) && parsed <= new Date();
};
```

**When to modify**: When adding new validation rules, data transformations, or helper functions.

---

### 📂 **`backend/supabase/schemas/`** - Generated TypeScript Types
**Purpose**: Auto-generated TypeScript type definitions from your PostgreSQL schema. Ensures type safety across the backend.

**Expected Files**:
- `database.types.ts` - Auto-generated from Supabase schema (DO NOT EDIT manually)
- `api.types.ts` - Custom API types (manually maintained)

**How to generate**:
```bash
supabase gen types typescript --project-id <your-project-id> > schemas/database.types.ts
```

**Example usage in services**:
```typescript
import { Database } from "../schemas/database.types.ts";

type Observation = Database["public"]["Tables"]["observations"]["Row"];
type InsertObservation = Database["public"]["Tables"]["observations"]["Insert"];
```

**When to modify**: After running new migrations (regenerate database.types.ts).

---

### 📂 **`backend/supabase/seed/`** - Database Seeding
**Purpose**: Scripts to populate initial test data (species taxonomy, host plants, sample observations).

**Expected Files**:
```
seed/
├── seed.ts                      # Main seeding script
├── species.json                 # Lepidoptera species data
├── plants.json                  # Host plant taxonomy
└── observations.json            # Sample observations
```

**Example - `seed.ts`**:
```typescript
import { supabase } from "../functions/make-server-b55216b3/src/config/supabase.ts";
import species from "./species.json" assert { type: "json" };
import plants from "./plants.json" assert { type: "json" };

export async function seedDatabase() {
  console.log("Seeding Lepidoptera taxonomy...");
  const { error: speciesError } = await supabase
    .from("lepidoptera_taxonomy")
    .insert(species);
  
  if (speciesError) throw speciesError;
  
  console.log("Seeding host plants...");
  const { error: plantsError } = await supabase
    .from("plant_taxonomy")
    .insert(plants);
  
  if (plantsError) throw plantsError;
  
  console.log("✅ Database seeded successfully!");
}

if (import.meta.main) {
  await seedDatabase();
}
```

**When to modify**: When adding initial data, creating test datasets, or updating taxonomy.

---

### 📂 **`backend/config/`** - Global Configuration
**Purpose**: Environment variables, secrets, and global backend settings.

**Expected Files**:
```
config/
├── .env.example                 # Template (commit to repo)
├── .env.development             # Dev secrets (DO NOT COMMIT)
├── .env.production              # Prod secrets (DO NOT COMMIT)
└── .gitignore                   # Ignore .env files
```

**Example - `.env.example`**:
```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# JWT Configuration
JWT_SECRET=your-jwt-secret
JWT_EXPIRY=7d

# Image Recognition API
ML_MODEL_API_URL=https://api.example.com/recognize
ML_MODEL_API_KEY=your-api-key

# Email Service
SENDGRID_API_KEY=your-sendgrid-key

# Environment
NODE_ENV=development
LOG_LEVEL=debug
```

**When to modify**: When adding new environment variables or changing secrets.

---

### 📂 **`backend/docs/`** - Documentation
**Purpose**: Comprehensive backend documentation for developers.

**Expected Files**:
```
docs/
├── API.md                       # API endpoint reference (methods, params, responses)
├── ARCHITECTURE.md              # System design, data flow diagrams
├── DEPLOYMENT.md                # Deployment steps (Supabase, edge functions, CI/CD)
├── DATABASE.md                  # Database schema, relationships, migrations
└── TROUBLESHOOTING.md           # Common issues & solutions
```

**When to modify**: When adding new features, updating API endpoints, or improving documentation.

---

## Quick Reference: Where to Add Code

| Task | Folder | File |
|------|--------|------|
| Add new API endpoint | `src/controllers/` | Create/edit controller file |
| Implement business logic | `src/services/` | Create/edit service file |
| Add authentication check | `src/middleware/` | Update `auth.middleware.ts` |
| Add TypeScript interface | `src/types/` | Create type definition file |
| Add utility function | `src/utils/` | Create utility file |
| Add validation rule | `src/utils/validators.ts` | Add validation function |
| Update database schema | `supabase/migrations/` | Create new SQL migration |
| Seed test data | `supabase/seed/` | Update seed files/scripts |
| Configure environment | `backend/config/` | Update `.env` files |

---

## Supabase Project Structure Integration

Your Supabase project has **2 main components**:

### 1. **Database Layer** (`supabase/migrations/`)
- Manages PostgreSQL schema (tables, relationships, policies)
- Version-controlled migrations
- RLS (Row Level Security) policies

### 2. **Edge Functions Layer** (`supabase/functions/make-server-b55216b3/`)
- Deno-based serverless functions
- Handles API requests, business logic
- Connects to database via Supabase client

**How they interact**:
```
Frontend (React/TypeScript)
    ↓ (HTTP requests)
Edge Function (make-server-b55216b3)
    ├── Controllers (route handling)
    ├── Middleware (auth, validation)
    ├── Services (business logic)
    └── Supabase Client (database queries)
         ↓
PostgreSQL (migrations define schema)
```

---

## Next Steps

1. **Create starter files** in each folder (examples provided above)
2. **Implement edge functions** for your 5 planned endpoints:
   - `POST /auth/signup` → `auth.controller.ts`
   - `POST /observations` → `observation.controller.ts`
   - `POST /identifications` → `identification.controller.ts`
   - `POST /notifications` → `notification.controller.ts`
   - `POST /image-recognition` → `image.controller.ts`
3. **Set up deno.json** with required dependencies
4. **Create environment configuration** in `backend/config/`
5. **Write documentation** in `backend/docs/`

---

## References

- [Supabase Documentation](https://supabase.com/docs)
- [Deno Manual](https://deno.land/manual)
- [Hono Web Framework](https://hono.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
