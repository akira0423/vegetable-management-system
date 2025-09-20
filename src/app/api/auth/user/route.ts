import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    
    const user = await getCurrentUser()
    
    
    
    if (!user) {
      
      return NextResponse.json({
        success: false,
        error: 'Not authenticated'
      }, { status: 401 })
    }

    const response = {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        company_id: user.company_id,
        full_name: user.full_name,
        role: user.role
      }
    }
    
    
    return NextResponse.json(response)

  } catch (error) {
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}