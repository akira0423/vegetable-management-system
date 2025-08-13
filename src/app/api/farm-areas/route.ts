import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const FarmAreaSchema = z.object({
  name: z.string().min(1, 'Farm area name is required'),
  description: z.string().optional(),
  geometry: z.object({
    type: z.literal('Feature'),
    geometry: z.object({
      type: z.literal('Polygon'),
      coordinates: z.array(z.array(z.array(z.number().min(2).max(2))))
    }),
    properties: z.record(z.any()).optional()
  }),
  mesh_size_meters: z.number().min(1).max(50).default(5),
  prefecture: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional()
})

// GET - Fetch all farm areas for the authenticated user's company
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch farm areas with stats
    const { data: farmAreas, error } = await supabase
      .from('farm_area_stats')
      .select(`
        id,
        name,
        description,
        area_hectares,
        area_square_meters,
        estimated_cell_count,
        assigned_cells_count,
        active_cells_count,
        harvested_cells_count,
        unique_vegetables_count,
        total_harvest_kg,
        utilization_percentage
      `)
      .order('name')

    if (error) {
      console.error('Farm areas fetch error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch farm areas' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: farmAreas || [],
      total: farmAreas?.length || 0
    })

  } catch (error) {
    console.error('Farm areas API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new farm area
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's company (with fallback for development)
    let companyId: string
    
    const { data: userCompany, error: companyError } = await supabase
      .from('user_company_roles')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    if (companyError || !userCompany) {
      console.warn('User company not found, using fallback for development')
      
      // Fallback: Get or create a default company
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('id')
        .limit(1)
      
      if (companiesError || !companies || companies.length === 0) {
        // Create a default company for development
        const { data: newCompany, error: createError } = await supabase
          .from('companies')
          .insert({
            name: 'Default Company',
            plan_type: 'basic',
            is_active: true,
            max_users: 10,
            max_vegetables: 100,
            settings: {}
          })
          .select('id')
          .single()
        
        if (createError || !newCompany) {
          return NextResponse.json(
            { success: false, error: 'Failed to create default company' },
            { status: 500 }
          )
        }
        
        companyId = newCompany.id
        
        // Create user-company relationship
        await supabase
          .from('user_company_roles')
          .insert({
            user_id: user.id,
            company_id: companyId,
            role: 'admin'
          })
      } else {
        companyId = companies[0].id
        
        // Create user-company relationship if it doesn't exist
        await supabase
          .from('user_company_roles')
          .insert({
            user_id: user.id,
            company_id: companyId,
            role: 'member'
          })
      }
    } else {
      companyId = userCompany.company_id
    }

    const requestData = await request.json()
    
    // Validate input data
    const validationResult = FarmAreaSchema.safeParse(requestData)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid input data',
          details: validationResult.error.errors
        },
        { status: 400 }
      )
    }

    const farmAreaData = validationResult.data
    
    // Convert GeoJSON Feature to PostGIS geometry format
    const geometryWKT = `POLYGON((${farmAreaData.geometry.geometry.coordinates[0]
      .map(coord => `${coord[0]} ${coord[1]}`)
      .join(', ')}))`

    // Insert farm area into database
    const { data: newFarmArea, error: insertError } = await supabase
      .from('farm_areas')
      .insert({
        company_id: companyId,
        name: farmAreaData.name,
        description: farmAreaData.description || '',
        geometry: `ST_GeomFromText('${geometryWKT}', 4326)`,
        mesh_size_meters: farmAreaData.mesh_size_meters,
        prefecture: farmAreaData.prefecture,
        city: farmAreaData.city,
        address: farmAreaData.address,
        tags: farmAreaData.tags || [],
        notes: farmAreaData.notes,
        created_by: user.id
      })
      .select()
      .single()

    if (insertError) {
      console.error('Farm area insert error:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create farm area' },
        { status: 500 }
      )
    }

    console.log('✅ Farm area created:', newFarmArea.name)

    return NextResponse.json({
      success: true,
      data: newFarmArea,
      message: 'Farm area created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Farm area creation error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}