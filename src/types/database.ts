export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          logo_url?: string
          plan_type: string
          contact_email?: string
          contact_phone?: string
          address?: string
          postal_code?: string
          prefecture?: string
          city?: string
          is_active: boolean
          subscription_expires_at?: string
          max_users: number
          max_vegetables: number
          settings: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          logo_url?: string
          plan_type?: string
          contact_email?: string
          contact_phone?: string
          address?: string
          postal_code?: string
          prefecture?: string
          city?: string
          is_active?: boolean
          subscription_expires_at?: string
          max_users?: number
          max_vegetables?: number
          settings?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          logo_url?: string
          plan_type?: string
          contact_email?: string
          contact_phone?: string
          address?: string
          postal_code?: string
          prefecture?: string
          city?: string
          is_active?: boolean
          subscription_expires_at?: string
          max_users?: number
          max_vegetables?: number
          settings?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          company_id: string
          email: string
          full_name?: string
          role: string
          is_active: boolean
          last_login_at?: string
          profile_image_url?: string
          phone?: string
          department?: string
          position?: string
          settings: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          company_id: string
          email: string
          full_name?: string
          role?: string
          is_active?: boolean
          last_login_at?: string
          profile_image_url?: string
          phone?: string
          department?: string
          position?: string
          settings?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          email?: string
          full_name?: string
          role?: string
          is_active?: boolean
          last_login_at?: string
          profile_image_url?: string
          phone?: string
          department?: string
          position?: string
          settings?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
      }
      vegetables: {
        Row: {
          id: string
          company_id: string
          variety_id?: string
          name: string
          variety_name?: string
          plot_name?: string
          area_size?: number
          plant_count?: number
          planting_date: string
          expected_harvest_start?: string
          expected_harvest_end?: string
          actual_harvest_start?: string
          actual_harvest_end?: string
          status: string
          notes?: string
          custom_fields: Record<string, any>
          farm_plot_id?: string
          selected_cells_count?: number
          total_cultivation_area_sqm?: number
          created_by?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          variety_id?: string
          name: string
          variety_name?: string
          plot_name?: string
          area_size?: number
          plant_count?: number
          planting_date: string
          expected_harvest_start?: string
          expected_harvest_end?: string
          actual_harvest_start?: string
          actual_harvest_end?: string
          status?: string
          notes?: string
          custom_fields?: Record<string, any>
          farm_plot_id?: string
          selected_cells_count?: number
          total_cultivation_area_sqm?: number
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          variety_id?: string
          name?: string
          variety_name?: string
          plot_name?: string
          area_size?: number
          plant_count?: number
          planting_date?: string
          expected_harvest_start?: string
          expected_harvest_end?: string
          actual_harvest_start?: string
          actual_harvest_end?: string
          status?: string
          notes?: string
          custom_fields?: Record<string, any>
          farm_plot_id?: string
          selected_cells_count?: number
          total_cultivation_area_sqm?: number
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      farm_plots: {
        Row: {
          id: string
          company_id: string
          name: string
          description?: string
          area_hectares?: number
          geometry: unknown // PostGIS geometry type
          geometry_jgd2011?: unknown // PostGIS geometry type
          prefecture?: string
          city?: string
          address?: string
          postal_code?: string
          wagri_plot_id?: string
          wagri_city_code?: string
          wagri_last_updated?: string
          status: string
          is_mesh_generated: boolean
          mesh_size_meters: number
          mesh_generated_at?: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          description?: string
          area_hectares?: number
          geometry: unknown
          geometry_jgd2011?: unknown
          prefecture?: string
          city?: string
          address?: string
          postal_code?: string
          wagri_plot_id?: string
          wagri_city_code?: string
          wagri_last_updated?: string
          status?: string
          is_mesh_generated?: boolean
          mesh_size_meters?: number
          mesh_generated_at?: string
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          description?: string
          area_hectares?: number
          geometry?: unknown
          geometry_jgd2011?: unknown
          prefecture?: string
          city?: string
          address?: string
          postal_code?: string
          wagri_plot_id?: string
          wagri_city_code?: string
          wagri_last_updated?: string
          status?: string
          is_mesh_generated?: boolean
          mesh_size_meters?: number
          mesh_generated_at?: string
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      plot_cells: {
        Row: {
          id: string
          farm_plot_id: string
          cell_index: number
          geometry: unknown // PostGIS geometry type
          center_point: unknown // PostGIS geometry type
          row_index: number
          col_index: number
          area_sqm: number
          is_cultivated: boolean
          soil_quality?: string
          drainage?: string
          slope_degree?: number
          vegetable_count: number
          last_cultivation_date?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          farm_plot_id: string
          cell_index: number
          geometry: unknown
          center_point: unknown
          row_index: number
          col_index: number
          area_sqm?: number
          is_cultivated?: boolean
          soil_quality?: string
          drainage?: string
          slope_degree?: number
          vegetable_count?: number
          last_cultivation_date?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          farm_plot_id?: string
          cell_index?: number
          geometry?: unknown
          center_point?: unknown
          row_index?: number
          col_index?: number
          area_sqm?: number
          is_cultivated?: boolean
          soil_quality?: string
          drainage?: string
          slope_degree?: number
          vegetable_count?: number
          last_cultivation_date?: string
          created_at?: string
          updated_at?: string
        }
      }
      vegetable_cells: {
        Row: {
          id: string
          vegetable_id: string
          plot_cell_id: string
          planting_date: string
          expected_harvest_date?: string
          actual_harvest_date?: string
          plant_count: number
          growth_stage?: string
          health_status: string
          harvest_quantity?: number
          harvest_unit?: string
          harvest_quality?: string
          last_watered_date?: string
          last_fertilized_date?: string
          last_weeded_date?: string
          notes?: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vegetable_id: string
          plot_cell_id: string
          planting_date: string
          expected_harvest_date?: string
          actual_harvest_date?: string
          plant_count?: number
          growth_stage?: string
          health_status?: string
          harvest_quantity?: number
          harvest_unit?: string
          harvest_quality?: string
          last_watered_date?: string
          last_fertilized_date?: string
          last_weeded_date?: string
          notes?: string
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          vegetable_id?: string
          plot_cell_id?: string
          planting_date?: string
          expected_harvest_date?: string
          actual_harvest_date?: string
          plant_count?: number
          growth_stage?: string
          health_status?: string
          harvest_quantity?: number
          harvest_unit?: string
          harvest_quality?: string
          last_watered_date?: string
          last_fertilized_date?: string
          last_weeded_date?: string
          notes?: string
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      address_geocoding_cache: {
        Row: {
          id: string
          query: string
          query_type: string
          latitude?: number
          longitude?: number
          formatted_address?: string
          prefecture?: string
          city?: string
          source: string
          confidence_score?: number
          expires_at?: string
          created_at: string
        }
        Insert: {
          id?: string
          query: string
          query_type: string
          latitude?: number
          longitude?: number
          formatted_address?: string
          prefecture?: string
          city?: string
          source: string
          confidence_score?: number
          expires_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          query?: string
          query_type?: string
          latitude?: number
          longitude?: number
          formatted_address?: string
          prefecture?: string
          city?: string
          source?: string
          confidence_score?: number
          expires_at?: string
          created_at?: string
        }
      }
      harvest_records: {
        Row: {
          id: string
          company_id: string
          vegetable_id: string
          harvest_date: string
          harvest_quantity: number
          harvest_unit: string
          harvest_value?: number
          plot_name?: string
          notes?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          vegetable_id: string
          harvest_date: string
          harvest_quantity: number
          harvest_unit?: string
          harvest_value?: number
          plot_name?: string
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          vegetable_id?: string
          harvest_date?: string
          harvest_quantity?: number
          harvest_unit?: string
          harvest_value?: number
          plot_name?: string
          notes?: string
          created_at?: string
          updated_at?: string
        }
      }
      soil_records: {
        Row: {
          id: string
          company_id: string
          vegetable_id?: string
          plot_name?: string
          analysis_date: string
          pH?: number
          EC?: number
          CEC?: number
          phosphorus?: number
          potassium?: number
          nitrogen?: number
          organic_matter?: number
          calcium?: number
          magnesium?: number
          sulfur?: number
          notes?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          vegetable_id?: string
          plot_name?: string
          analysis_date: string
          pH?: number
          EC?: number
          CEC?: number
          phosphorus?: number
          potassium?: number
          nitrogen?: number
          organic_matter?: number
          calcium?: number
          magnesium?: number
          sulfur?: number
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          vegetable_id?: string
          plot_name?: string
          analysis_date?: string
          pH?: number
          EC?: number
          CEC?: number
          phosphorus?: number
          potassium?: number
          nitrogen?: number
          organic_matter?: number
          calcium?: number
          magnesium?: number
          sulfur?: number
          notes?: string
          created_at?: string
          updated_at?: string
        }
      }
      weather_records: {
        Row: {
          id: string
          company_id: string
          farm_plot_id?: string
          recorded_date: string
          temperature: number
          temperature_min: number
          temperature_max: number
          humidity: number
          humidity_min: number
          humidity_max: number
          precipitation?: number
          wind_speed?: number
          weather_condition?: string
          data_source: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          farm_plot_id?: string
          recorded_date: string
          temperature: number
          temperature_min: number
          temperature_max: number
          humidity: number
          humidity_min: number
          humidity_max: number
          precipitation?: number
          wind_speed?: number
          weather_condition?: string
          data_source: string
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          farm_plot_id?: string
          recorded_date?: string
          temperature?: number
          temperature_min?: number
          temperature_max?: number
          humidity?: number
          humidity_min?: number
          humidity_max?: number
          precipitation?: number
          wind_speed?: number
          weather_condition?: string
          data_source?: string
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// 追加の型定義
export type FarmPlot = Database['public']['Tables']['farm_plots']['Row']
export type PlotCell = Database['public']['Tables']['plot_cells']['Row']
export type VegetableCell = Database['public']['Tables']['vegetable_cells']['Row']
export type WeatherRecord = Database['public']['Tables']['weather_records']['Row']
export type HarvestRecord = Database['public']['Tables']['harvest_records']['Row']
export type SoilRecord = Database['public']['Tables']['soil_records']['Row']

// GeoJSON型定義
export interface GeoJSONFeature {
  type: 'Feature'
  geometry: {
    type: 'Polygon' | 'Point'
    coordinates: number[][] | number[]
  }
  properties: Record<string, any>
}

export interface MeshCell {
  id: string
  row: number
  col: number
  bounds: [number, number, number, number] // [west, south, east, north]
  center: [number, number] // [lng, lat]
  area_square_meters: number
  geometry: {
    type: 'Feature'
    geometry: {
      type: 'Polygon'
      coordinates: number[][][]
    }
    properties?: Record<string, any>
  }
  isSelected: boolean
  isOccupied: boolean
  vegetable_id: string | null
  plant_count: number
  growth_stage: 'planned' | 'planted' | 'growing' | 'harvesting' | 'harvested'
  health_status: 'healthy' | 'warning' | 'poor'
  // 後方互換のため残す（非推奨）
  centerLat?: number
  centerLng?: number
  vegetableInfo?: {
    id: string
    name: string
    varietyName: string
    growthStage: string
  }
}
