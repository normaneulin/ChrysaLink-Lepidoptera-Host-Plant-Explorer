const { createClient } = require('@supabase/supabase-js');

// Replace with your Supabase project details
const SUPABASE_URL = 'https://vaqxhxcwtwhnewkoaafn.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhcXhoeGN3dHdobmV3a29hYWZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzA0OTYyMywiZXhwIjoyMDcyNjI1NjIzfQ.2nO5hED1amSBw8LHMrPLgAyzYz1nWaSQ1O6oAlSfJkE';
const BUCKET = 'observation-images';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // List all user folders in the bucket
  const { data: userFolders } = await supabase.storage.from(BUCKET).list('', { limit: 1000 });
  for (const userFolder of userFolders) {
    if (userFolder.name) {
      // List all observation folders for each user
      const { data: obsFolders } = await supabase.storage.from(BUCKET).list(userFolder.name, { limit: 1000 });
      for (const obsFolder of obsFolders) {
        if (obsFolder.name) {
          // List all files in each observation folder
          const folderPath = `${userFolder.name}/${obsFolder.name}`;
          const { data: files } = await supabase.storage.from(BUCKET).list(folderPath, { limit: 1000 });
          // Check if observation exists in DB
          const { data: obs } = await supabase.from('observations').select('id').eq('id', obsFolder.name).single();
          if (!obs) {
            // Delete all files in this folder
            const filePaths = files.map(f => `${folderPath}/${f.name}`);
            if (filePaths.length > 0) {
              await supabase.storage.from(BUCKET).remove(filePaths);
              console.log(`Deleted orphaned images for observation: ${obsFolder.name}`);
            }
          }
        }
      }
    }
  }
  console.log('Cleanup complete.');
}

main();
