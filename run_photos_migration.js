const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runPhotosMigration() {
  try {
    console.log('🔧 Starting photos table migration...');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'supabase/migrations/032_ensure_photos_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Executing migration SQL...');
    
    // Execute the migration SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_command: migrationSQL
    });

    if (error) {
      // Try direct SQL execution if RPC fails
      console.log('🔄 RPC failed, trying direct SQL execution...');
      
      // Split SQL by semicolon and execute each statement
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.trim()) {
          console.log('📝 Executing:', statement.substring(0, 100) + '...');
          const { error: stmtError } = await supabase
            .from('_dummy_table_that_doesnt_exist_')
            .select('*');
          
          // This is a workaround - we'll try to execute via raw SQL
          const { error: rawError } = await supabase.rpc('exec', {
            sql: statement
          });

          if (rawError) {
            console.log('⚠️ Statement execution result:', rawError);
          }
        }
      }
    }

    // Test if photos table exists now
    console.log('🔍 Testing photos table existence...');
    const { data: testData, error: testError } = await supabase
      .from('photos')
      .select('count')
      .limit(1);

    if (testError) {
      console.error('❌ Photos table still not accessible:', testError.message);
      
      // Let's check what tables exist
      console.log('📋 Checking existing tables...');
      const { data: tables, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');

      if (tables) {
        console.log('📋 Existing tables:', tables.map(t => t.table_name));
      } else {
        console.error('❌ Could not fetch table list:', tablesError?.message);
      }
    } else {
      console.log('✅ Photos table is accessible!');
    }

    // Also check if the storage bucket exists
    console.log('🪣 Checking vegetable-photos storage bucket...');
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets();

    if (buckets) {
      const photoBucket = buckets.find(b => b.id === 'vegetable-photos');
      if (photoBucket) {
        console.log('✅ vegetable-photos bucket exists');
      } else {
        console.log('⚠️ vegetable-photos bucket not found. Available buckets:', 
          buckets.map(b => b.id));
        
        // Try to create the bucket
        console.log('🔧 Creating vegetable-photos bucket...');
        const { data: newBucket, error: createError } = await supabase
          .storage
          .createBucket('vegetable-photos', {
            public: true,
            fileSizeLimit: 52428800, // 50MB
            allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
          });

        if (createError) {
          console.error('❌ Failed to create bucket:', createError.message);
        } else {
          console.log('✅ vegetable-photos bucket created successfully');
        }
      }
    } else {
      console.error('❌ Could not list buckets:', bucketsError?.message);
    }

    console.log('🎉 Migration process completed!');

  } catch (error) {
    console.error('💥 Migration error:', error);
  }
}

// Run the migration
runPhotosMigration();