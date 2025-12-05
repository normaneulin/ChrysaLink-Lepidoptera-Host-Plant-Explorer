Relationship thresholds and environment configuration

This function contains logic to classify lepidoptera–plant relationships into multiple tiers using environment-configurable thresholds.

Environment variables

- `RELATIONSHIP_PREFERRED_THRESHOLD` (integer, default: `3`)
  - Example: `3` means a relationship becomes `preferred_host` when its `verified_count >= 3`.
- `RELATIONSHIP_ALTERNATE_THRESHOLD` (integer, default: `2`)
  - Example: `2` means a relationship becomes `alternate_host` when `verified_count >= 2` (but less than preferred threshold).
- `RELATIONSHIP_OCCASIONAL_THRESHOLD` (integer, default: `1`)
  - Example: `1` means a relationship becomes `occasional_host` when `verified_count >= 1` (but less than alternate threshold).
- `RELATIONSHIP_OBSERVATION_THRESHOLD` (integer, default: `5`)
  - If a relationship has no verified votes but `observation_count >= RELATIONSHIP_OBSERVATION_THRESHOLD`, it is considered a plain `host_plant` relationship.

Rule set (applied in priority order)

1. If `verified_count >= RELATIONSHIP_PREFERRED_THRESHOLD` → `preferred_host`.
2. Else if `verified_count >= RELATIONSHIP_ALTERNATE_THRESHOLD` → `alternate_host`.
3. Else if `verified_count >= RELATIONSHIP_OCCASIONAL_THRESHOLD` → `occasional_host`.
4. Else if `observation_count >= RELATIONSHIP_OBSERVATION_THRESHOLD` → `host_plant`.
5. Otherwise default → `host_plant`.

Notes and recommendations

- Thresholds are normalized in the code so that `preferred >= alternate >= occasional`. If you set inconsistent values, the function will coerce them to maintain that ordering.
- The verification thresholds are based on `verified_count` (community votes on identifications) and are the strongest signal. `observation_count` acts as a weaker fallback signal when verified votes are absent.
- For production with high concurrency, consider implementing DB-side atomic upserts (e.g. `INSERT ... ON CONFLICT ... DO UPDATE`) or a stored procedure to avoid race conditions when multiple processes update relationship counts concurrently.

Relationship model change

- This deployment uses a per-observation relationship model: each created observation inserts a corresponding `relationships` row that includes `observation_id`. That row is therefore dependent on the observation and will be removed automatically when the observation is deleted if you create the DB foreign key with `ON DELETE CASCADE` (see migration included in `supabase/migrations`).
- Because relationships are now tied to `observation_id`, aggregate counters like `observation_count` may be redundant; we keep them for compatibility but they default to `1` for per-observation rows.

How to set these env vars

- In Supabase (Dashboard): Project Settings → API / Environment Variables — add the keys and integer values.
- Using `supabase` CLI (example for a project):

  supabase secrets set RELATIONSHIP_PREFERRED_THRESHOLD=3 \
    RELATIONSHIP_ALTERNATE_THRESHOLD=2 \
    RELATIONSHIP_OCCASIONAL_THRESHOLD=1 \
    RELATIONSHIP_OBSERVATION_THRESHOLD=5

- Locally (PowerShell):

  $env:RELATIONSHIP_PREFERRED_THRESHOLD = '3'
  $env:RELATIONSHIP_ALTERNATE_THRESHOLD = '2'
  $env:RELATIONSHIP_OCCASIONAL_THRESHOLD = '1'
  $env:RELATIONSHIP_OBSERVATION_THRESHOLD = '5'

Example (concise)

Set environment variable `RELATIONSHIP_PREFERRED_THRESHOLD` (integer). Example:

3 (default) means a relationship becomes preferred_host when its verified_count >= 3.

If you'd like, I can also add a small migration SQL or a periodic recompute job to retroactively recalculate `relationship_type` for existing rows.