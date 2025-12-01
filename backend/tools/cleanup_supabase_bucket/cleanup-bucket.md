# Supabase Storage Bucket Cleanup

This tool removes images from your Supabase storage bucket that are not connected to any observation in your database.

## Usage Instructions

1. **Install dependencies:**
   ```bash
   npm install @supabase/supabase-js
   ```

2. **Configure your Supabase credentials:**
   - Open `cleanup-bucket.js`.
   - Replace `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` with your project values.

3. **Run the cleanup script:**
   ```bash
   node cleanup-bucket.js
   ```

## What it does
- Iterates through all user and observation folders in your `observation-images` bucket.
- Checks if each observation exists in your database.
- Deletes all images for observations that no longer exist.

## When to use
- After running manual SQL deletes (e.g., `DELETE FROM observations;`).
- Periodically, to keep your storage bucket clean.

## Notes
- This script only deletes images for observations that do not exist in the database.
- It does not delete user folders or other unrelated files.
- Make sure you use your **service role key** for full access.

---

**Contact your developer or admin if you need help with credentials or running the script.**
