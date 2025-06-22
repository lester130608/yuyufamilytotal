'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
    } else {
      router.push('/familia/arbol')
    }
  }

  return (
    <div className="login-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <form className="login-container" onSubmit={handleLogin} style={{ background: 'white', padding: 32, borderRadius: 8, boxShadow: '0 4px 16px #0001', minWidth: 320 }}>
        <h1>Iniciar sesión</h1>
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: '100%', marginBottom: 16, padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: '100%', marginBottom: 16, padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
        />
        <button type="submit" style={{ width: '100%', padding: 10, borderRadius: 4, border: 'none', background: '#0070f3', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
          Entrar
        </button>
        {error && <p style={{ color: 'red', marginTop: 16 }}>{error}</p>}
      </form>
    </div>
  )
}