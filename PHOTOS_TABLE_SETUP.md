# Photos Table Setup Instructions

## Problem
The photo gallery feature is failing because the `photos` table doesn't exist in the Supabase database. The API endpoints are implemented but can't function without the database table.

## Solution
You need to manually create the photos table in your Supabase dashboard.

## Step 1: Access Supabase SQL Editor
1. Go to your Supabase dashboard: https://app.supabase.com/
2. Select your project (rsofuafiacwygmfkcrrk)
3. Navigate to "SQL Editor" in the left sidebar

## Step 2: Create the Photos Table
Copy and paste the following SQL into the SQL editor and run it:

```sql
-- Create photos table
CREATE TABLE IF NOT EXISTS photos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_log_id uuid REFERENCES operation_logs(id) ON DELETE CASCADE,
    vegetable_id uuid NOT NULL REFERENCES vegetables(id) ON DELETE CASCADE,
    storage_path text NOT NULL,
    original_filename text NOT NULL,
    file_size integer,
    mime_type text NOT NULL,
    width integer,
    height integer,
    taken_at timestamptz NOT NULL DEFAULT now(),
    location_lat decimal(10,6),
    location_lng decimal(10,6),
    description text,
    tags text[] DEFAULT '{}',
    is_primary boolean DEFAULT false,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_photos_vegetable ON photos(vegetable_id);
CREATE INDEX IF NOT EXISTS idx_photos_operation_log ON photos(operation_log_id);  
CREATE INDEX IF NOT EXISTS idx_photos_taken_at ON photos(taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_primary ON photos(is_primary) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_photos_tags ON photos USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at DESC);

-- Enable RLS
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY photos_select_policy ON photos 
    FOR SELECT 
    USING (
        vegetable_id IN (
            SELECT id FROM vegetables 
            WHERE company_id IN (
                SELECT company_id FROM users 
                WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY photos_insert_policy ON photos 
    FOR INSERT 
    WITH CHECK (
        vegetable_id IN (
            SELECT id FROM vegetables 
            WHERE company_id IN (
                SELECT company_id FROM users 
                WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY photos_update_policy ON photos 
    FOR UPDATE 
    USING (
        vegetable_id IN (
            SELECT id FROM vegetables 
            WHERE company_id IN (
                SELECT company_id FROM users 
                WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY photos_delete_policy ON photos 
    FOR DELETE 
    USING (
        vegetable_id IN (
            SELECT id FROM vegetables 
            WHERE company_id IN (
                SELECT company_id FROM users 
                WHERE id = auth.uid()
            )
        )
    );

-- Updated at trigger function (may already exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for photos table
CREATE TRIGGER update_photos_updated_at 
    BEFORE UPDATE ON photos 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

## Step 3: Verify Storage Bucket
The `vegetable-photos` storage bucket already exists, so the storage functionality should work once the table is created.

## Step 4: Test the Photo Gallery
After running the SQL:
1. Navigate to http://localhost:3000/dashboard/photos
2. The page should load without 404/500 errors
3. Try uploading a photo to test the full functionality

## Current Implementation Status
- ✅ Photo storage API endpoint (`/api/photos/storage`) - **COMPLETED**
- ✅ Photo listing API endpoint (`/api/photos`) - **EXISTS** (just needs table)
- ⚠️  Photos database table - **NEEDS MANUAL CREATION**
- ✅ Storage bucket configuration - **COMPLETED**

Once you've run the SQL above, the photo gallery should be fully functional!