// マイグレーションの直接適用
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rsofuafiacwygmfkcrrk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzb2Z1YWZpYWN3eWdtZmtjcnJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY5MzIyOSwiZXhwIjoyMDcwMjY5MjI5fQ.CGVm-_sIw8_-zkFBRxBm9V2MNPidd98X4dMrur-FQMw'; // service role key

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    console.log('Applying migration: make created_by nullable...');
    
    // created_byをnull許可に変更
    const { data, error } = await supabase.rpc('exec', {
      query: `
        ALTER TABLE operation_logs 
        ALTER COLUMN created_by DROP NOT NULL;
        
        COMMENT ON COLUMN operation_logs.created_by IS 'ユーザーID（テスト用にnull許可、本番では認証必須）';
      `
    });

    if (error) {
      console.error('Error applying migration:', error);
      
      // 代替方法：個別に実行
      console.log('Trying alternative approach...');
      
      const { error: alterError } = await supabase.sql`
        ALTER TABLE operation_logs 
        ALTER COLUMN created_by DROP NOT NULL
      `;
      
      if (alterError) {
        console.error('Alternative approach also failed:', alterError);
      } else {
        console.log('Migration applied successfully via alternative method!');
      }
      
    } else {
      console.log('Migration applied successfully!');
      console.log('Result:', data);
    }
    
  } catch (error) {
    console.error('Network error:', error);
  }
}

applyMigration();