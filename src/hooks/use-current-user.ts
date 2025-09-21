import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

interface AuthUser {
  id: string
  email: string
  company_id: string | null
  role: string
  full_name: string | null
}

export function useCurrentUser() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const loadUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (authUser) {
          // Get user profile from database
          const { data: profile } = await supabase
            .from('users')
            .select('company_id, full_name')
            .eq('id', authUser.id)
            .single()

          if (profile) {
            setUser({
              id: authUser.id,
              email: authUser.email!,
              company_id: profile.company_id,
              role: 'user',
              full_name: profile.full_name,
            })
          } else {
            setUser({
              id: authUser.id,
              email: authUser.email!,
              company_id: null,
              role: 'user',
              full_name: authUser.user_metadata?.full_name || authUser.email!,
            })
          }
        }
      } catch (error) {
        console.error('Error loading user:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('company_id, full_name')
          .eq('id', session.user.id)
          .single()

        if (profile) {
          setUser({
            id: session.user.id,
            email: session.user.email!,
            company_id: profile.company_id,
            role: 'user',
            full_name: profile.full_name,
          })
        } else {
          setUser({
            id: session.user.id,
            email: session.user.email!,
            company_id: null,
            role: 'user',
            full_name: session.user.user_metadata?.full_name || session.user.email!,
          })
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}