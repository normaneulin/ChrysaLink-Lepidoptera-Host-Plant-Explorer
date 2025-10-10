# Supabase (DEPRECATED copy)

This directory is a deprecated, duplicate copy of the repository's canonical `supabase/` folder.

To avoid divergence and editor/TypeScript confusion, the authoritative Supabase functions, migrations, and helper scripts live at the repository root in `../supabase/`.

Any edits or deployments should be performed from the root `supabase/` folder. This copy remains only to avoid accidental breakage during migration and can be removed.

See README in the root `supabase/` for deployment instructions.

Supabase schema and deployment for Lepidoptera Host-Plant Explorer

This folder contains a SQL schema and guidance to create the database tables and wireup environment variables for the client and serverless functions.

Files
...
Supabase schema and deployment for Lepidoptera Host-Plant Explorer

This folder contains a SQL schema and guidance to create the database tables and wireup environment variables for the client and serverless functions.

Files
- schema.sql - SQL DDL to create profiles, observations, comments, identifications, notifications.

Quick setup (Supabase project)
1. Create a Supabase project at https://app.supabase.com/
2. Two ways to apply the schema from this repo:

Option A — Supabase CLI (recommended)
- Install the Supabase CLI: https://supabase.com/docs/guides/cli
- In VS Code terminal (PowerShell):

```powershell
# Login once
supabase login

# Link this folder to your Supabase project (use your project ref)
supabase link --project-ref <PROJECT_REF>

# Run the migration SQL file
supabase db remote commit --file .\supabase\migrations\001_init.sql
```

Option B — Direct Postgres `psql` (useful if you have DB credentials)
- In Supabase dashboard go to Settings -> Database and get the connection string (host, port, database, user, password).
- In VS Code terminal (PowerShell) set environment variables and run:

```powershell
$env:PGHOST = 'db.<project>.supabase.co'
$env:PGUSER = 'postgres'
$env:PGPASSWORD = '<your-db-password>'
$env:PGDATABASE = 'postgres'
$env:PGPORT = '5432'

psql -h $env:PGHOST -U $env:PGUSER -d $env:PGDATABASE -f .\supabase\migrations\001_init.sql
```

Auth & profiles
- Supabase provides an `auth.users` table. The `profiles` table references `auth.users(id)` so that when a user signs up through Supabase Auth, you should create a matching `profiles` row.

Create a profile on signup (example JavaScript using @supabase/supabase-js):

```js
const { data: { user }, error } = await supabase.auth.signUp({ email, password });
if (user) {
  await supabase.from('profiles').insert([{ id: user.id, email, name }]);
}
```

Environment variables used by the app (client and functions)
- VITE_SUPABASE_URL - your Supabase project URL (example: https://<project>.supabase.co)
- VITE_SUPABASE_ANON_KEY - your public anon key (for the browser client)

For serverless functions (the Deno functions under `src/supabase/functions/server`), set these in the functions environment:
- SUPABASE_URL - same as above
- SUPABASE_ANON_KEY - anon key (if functions need to act as client for some flows)
- SUPABASE_SERVICE_ROLE_KEY - service role key (keep secret; used for admin operations inside functions)

Deployment
- After running the SQL, either:
  - Use Supabase Dashboard to manage Auth and run SQL
  - Use the Supabase CLI to push migrations
  - Deploy your updated serverless functions (if you're using Supabase Functions). See Supabase docs for deploying functions written in Deno.

Security notes
- Never expose the service role key to the browser. Use it only in serverless functions or server-side code.
- Protect write/delete endpoints so only the owner can update their resources (the serverless functions in `src/supabase/functions/server` implement these checks).

If you want, I can:
- Generate a small migration file compatible with the Supabase CLI (SQL file organized into migrations).
- Add example signup logic in `src/utils/supabase` to auto-create profiles on signup.
- Help deploy the functions to Supabase (CLI commands or dashboard steps).

Function deployment helper
--------------------------
I added `supabase/deploy-functions.ps1` which will copy your function source into `supabase/functions/make-server-b55216b3` and print the exact Supabase CLI commands to deploy. It does not run the CLI commands automatically to avoid accidental deploys.

To use the helper:

```powershell
# From the repo root
.\supabase\deploy-functions.ps1
```

After copying, run the printed commands to deploy, for example:

```powershell
supabase login
supabase link --project-ref <PROJECT_REF>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="{SERVICE_ROLE_KEY}"
supabase secrets set SUPABASE_URL="https://{PROJECT}.supabase.co"
supabase secrets set SUPABASE_ANON_KEY="{ANON_KEY}"
supabase functions deploy make-server-b55216b3 --project-ref <PROJECT_REF>
```

If you want me to run the deploy commands in your VS Code terminal, say the word and I will (I will not run them unless you confirm and Supabase CLI is available in your environment).
