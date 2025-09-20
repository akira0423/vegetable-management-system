import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const UpdateFarmAreaSchema = z.object({
  name: z.string().min(1, 'Farm area name is required').optional(),
  description: z.string().optional(),
  geometry: z.object({
    type: z.literal('Feature'),
    geometry: z.object({
      type: z.literal('Polygon'),
      coordinates: z.array(z.array(z.array(z.number().min(2).max(2))))
    }),
    properties: z.record(z.any()).optional()
  }).optional(),
  mesh_size_meters: z.number().min(1).max(50).optional(),
  prefecture: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  is_locked: z.boolean().optional()
})

// GET - Fetch a specific farm area with full details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const farmAreaId = params.id

    // Fetch farm area with geometry
    const { data: farmArea, error } = await supabase
      .from('farm_areas')
      .select(`
        id,
        name,
        description,
        geometry,
        area_hectares,
        area_square_meters,
        mesh_size_meters,
        estimated_cell_count,
        center_latitude,
        center_longitude,
        prefecture,
        city,
        address,
        status,
        is_locked,
        drawing_style,
        notes,
        tags,
        created_by,
        created_at,
        updated_at
      `)
      .eq('id', farmAreaId)
      .single()

    if (error) {
      
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Farm area not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { success: false, error: 'Failed to fetch farm area' },
        { status: 500 }
      )
    }

    // Convert PostGIS geometry to GeoJSON
    const { data: geoJsonData, error: geoError } = await supabase
      .rpc('st_asgeojson_farm_area', { farm_area_id: farmAreaId })

    let geoJsonFeature = null
    if (!geoError && geoJsonData) {
      try {
        geoJsonFeature = JSON.parse(geoJsonData)
      } catch (parseError) {
        
      }
    }

    // Get cell assignments count
    const { data: cellStats, error: cellError } = await supabase
      .from('cell_assignments')
      .select('id, growth_stage, harvest_quantity')
      .eq('farm_area_id', farmAreaId)

    const cellStatistics = {
      total_assigned: cellStats?.length || 0,
      active_cells: cellStats?.filter(c => c.growth_stage !== 'planned').length || 0,
      harvested_cells: cellStats?.filter(c => c.growth_stage === 'harvested').length || 0,
      total_harvest: cellStats?.reduce((sum, c) => sum + (c.harvest_quantity || 0), 0) || 0
    }

    return NextResponse.json({
      success: true,
      data: {
        ...farmArea,
        geometry: geoJsonFeature,
        cell_statistics: cellStatistics
      }
    })

  } catch (error) {
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update a farm area
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const farmAreaId = params.id
    const requestData = await request.json()
    
    // Validate input data
    const validationResult = UpdateFarmAreaSchema.safeParse(requestData)
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

    const updateData = validationResult.data
    
    // Prepare update object
    const updateObject: any = {}
    
    if (updateData.name !== undefined) updateObject.name = updateData.name
    if (updateData.description !== undefined) updateObject.description = updateData.description
    if (updateData.mesh_size_meters !== undefined) updateObject.mesh_size_meters = updateData.mesh_size_meters
    if (updateData.prefecture !== undefined) updateObject.prefecture = updateData.prefecture
    if (updateData.city !== undefined) updateObject.city = updateData.city
    if (updateData.address !== undefined) updateObject.address = updateData.address
    if (updateData.tags !== undefined) updateObject.tags = updateData.tags
    if (updateData.notes !== undefined) updateObject.notes = updateData.notes
    if (updateData.status !== undefined) updateObject.status = updateData.status
    if (updateData.is_locked !== undefined) updateObject.is_locked = updateData.is_locked

    // Handle geometry update
    if (updateData.geometry) {
      const geometryWKT = `POLYGON((${updateData.geometry.geometry.coordinates[0]
        .map(coord => `${coord[0]} ${coord[1]}`)
        .join(', ')}))`
      updateObject.geometry = `ST_GeomFromText('${geometryWKT}', 4326)`
    }

    // Update farm area
    const { data: updatedFarmArea, error: updateError } = await supabase
      .from('farm_areas')
      .update(updateObject)
      .eq('id', farmAreaId)
      .select()
      .single()

    if (updateError) {
      
      if (updateError.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Farm area not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { success: false, error: 'Failed to update farm area' },
        { status: 500 }
      )
    }

    

    return NextResponse.json({
      success: true,
      data: updatedFarmArea,
      message: 'Farm area updated successfully'
    })

  } catch (error) {
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a farm area
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const farmAreaId = params.id

    // Check if farm area exists and get its name for logging
    const { data: farmArea, error: fetchError } = await supabase
      .from('farm_areas')
      .select('name, is_locked')
      .eq('id', farmAreaId)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Farm area not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { success: false, error: 'Failed to fetch farm area' },
        { status: 500 }
      )
    }

    // Check if farm area is locked
    if (farmArea.is_locked) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete locked farm area' },
        { status: 400 }
      )
    }

    // Delete farm area (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from('farm_areas')
      .delete()
      .eq('id', farmAreaId)

    if (deleteError) {
      
      return NextResponse.json(
        { success: false, error: 'Failed to delete farm area' },
        { status: 500 }
      )
    }

    

    return NextResponse.json({
      success: true,
      message: 'Farm area deleted successfully'
    })

  } catch (error) {
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}