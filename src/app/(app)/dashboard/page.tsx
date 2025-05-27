'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkRole = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user
      if (!user) return router.push('/login')

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (roleData?.role !== 'admin') {
        return router.push('/')
      }

      setIsAdmin(true)
    }

    checkRole()
  }, [])

  if (!isAdmin) return null

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Panel de Administración</h1>
      <p>Bienvenido. Desde aquí puedes gestionar el árbol genealógico.</p>
    </main>
  )
}