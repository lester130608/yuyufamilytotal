'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Navbar() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const [openMenu, setOpenMenu] = useState<string | null>(null)

  useEffect(() => {
    const checkSession = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const sessionUser = sessionData.session?.user
      setUser(sessionUser)

      if (sessionUser) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('id', sessionUser.id)
          .single()

        setIsAdmin(roleData?.role === 'admin')
      }

      setLoading(false)
    }

    checkSession()
  }, [])

  if (loading || !user) return null

  return (
    <nav className="navbar">
      <ul>
        <li><Link href="/">Inicio</Link></li>

        <li className="has-submenu">
          <button onClick={() => setOpenMenu(openMenu === 'familia' ? null : 'familia')}>
            Familia ▾
          </button>
          {openMenu === 'familia' && (
            <ul className="submenu">
              <li><Link href="/familia/apellidos">Apellidos</Link></li>
              <li><Link href="/familia/generaciones">Generaciones</Link></li>
              <li><Link href="/familia/lugares">Lugares</Link></li>
              <li><Link href="/familia/ciudades">Ciudades</Link></li>
              <li><Link href="/familia/arbol">Árbol Genealógico</Link></li>
            </ul>
          )}
        </li>

        <li><Link href="/fotos">Fotos</Link></li>
        <li><Link href="/mapas">Mapas</Link></li>
        <li><Link href="/documentos">Documentos</Link></li>

        {isAdmin && (
          <li className="has-submenu">
            <button onClick={() => setOpenMenu(openMenu === 'admin' ? null : 'admin')}>
              Admin ▾
            </button>
            {openMenu === 'admin' && (
              <ul className="submenu">
                <li><Link href="/dashboard/persons">Ver Personas</Link></li>
                <li><Link href="/dashboard/persons/new">Crear Persona</Link></li>
              </ul>
            )}
          </li>
        )}

        <li style={{ marginLeft: 'auto' }}>
          <button onClick={async () => {
            await supabase.auth.signOut()
            window.location.href = '/login'
          }}>
            Cerrar sesión
          </button>
        </li>
      </ul>
    </nav>
  )
}