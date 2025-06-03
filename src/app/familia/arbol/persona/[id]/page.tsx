'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function FichaPersonaPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [persona, setPersona] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mensaje, setMensaje] = useState('')
  const [fotos, setFotos] = useState<any[]>([])
  const [mostrarGaleria, setMostrarGaleria] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [fotoGrande, setFotoGrande] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('persons').select('*').eq('id', id).single().then(({ data }) => {
      setPersona(data)
    })
    cargarFotos()
  }, [id])

  const cargarFotos = async () => {
    const { data } = await supabase.from('person_photos').select('*').eq('person_id', id)
    setFotos(data || [])
  }

  const handleSubirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendo(true)
    const filePath = `personas/${Date.now()}_${file.name}`
    console.log('ID:', id)
    console.log('Subiendo archivo:', file)
    console.log('Subiendo a storage...')
    const { error: uploadError } = await supabase.storage.from('fotos-personas').upload(filePath, file)
    console.log('Upload error:', uploadError)
    if (!uploadError) {
      const url = supabase.storage.from('fotos-personas').getPublicUrl(filePath).data.publicUrl
      console.log('URL:', url)
      const { error: insertError } = await supabase.from('person_photos').insert({ person_id: id, url })
      console.log('Insert error:', insertError)
      if (insertError) {
        setMensaje('Error al guardar en galería: ' + insertError.message)
        console.error('Insert error:', insertError)
      } else {
        setMensaje('Foto subida')
        await cargarFotos()
      }
    } else {
      setMensaje('Error al subir la foto: ' + uploadError.message)
      console.error('Upload error:', uploadError)
    }
    setSubiendo(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (!persona) return <div>Cargando...</div>

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', background: '#fff', borderRadius: 10, padding: 32 }}>
      <h2>{persona.first_name} {persona.last_name}</h2>
      <p><b>Fecha de nacimiento:</b> {persona.birth_date || 'Desconocida'}</p>
      {persona.death_date && (
        <p><b>Fecha de defunción:</b> {persona.death_date}</p>
      )}
      <p><b>Lugar de nacimiento:</b> {persona.birth_place || 'Desconocido'}</p>
      {/* Muestra la última foto subida como principal */}
      {fotos.length > 0 && (
        <img
          src={fotos[fotos.length - 1].url}
          alt="Foto"
          width={120}
          style={{ borderRadius: 8, margin: '8px 0' }}
        />
      )}
      <div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleSubirFoto}
          style={{ marginTop: 8 }}
          disabled={subiendo}
        />
        {mensaje && <div style={{ marginTop: 8, color: mensaje.includes('Error') ? 'red' : 'green' }}>{mensaje}</div>}
      </div>
      <button
        onClick={() => setMostrarGaleria(true)}
        style={{ marginTop: 8, marginBottom: 8, padding: '6px 12px', borderRadius: 6, background: '#888', color: '#fff', border: 'none' }}
      >
        Ver galería
      </button>
      {mostrarGaleria && (
        <div style={{ background: '#000a', position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 10, maxWidth: 600 }}>
            <h3>Galería de {persona.first_name}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {fotos.length === 0 && <div>No hay fotos.</div>}
              {fotos.map(foto => (
                <img
                  key={foto.id}
                  src={foto.url}
                  alt="Foto"
                  width={120}
                  style={{ borderRadius: 8, cursor: 'pointer' }}
                  onClick={() => setFotoGrande(foto.url)}
                />
              ))}
            </div>
            <button onClick={() => setMostrarGaleria(false)} style={{ marginTop: 16 }}>Cerrar</button>
          </div>
          {/* Modal para mostrar la foto grande */}
          {fotoGrande && (
            <div
              style={{
                position: 'fixed',
                top: 0, left: 0, width: '100vw', height: '100vh',
                background: 'rgba(0,0,0,0.85)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 100
              }}
              onClick={() => setFotoGrande(null)}
            >
              <img
                src={fotoGrande}
                alt="Foto grande"
                style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 0 24px #000' }}
              />
            </div>
          )}
        </div>
      )}
      {/* Botón para adicionar familiar */}
      <Link href={`/familia/arbol/nueva-persona?relacionar_con=${persona.id}`}>
        <button style={{ marginTop: 16, padding: '8px 16px', fontWeight: 'bold', borderRadius: 6, background: '#cc0000', color: '#fff', border: 'none' }}>
          Adicionar familiar
        </button>
      </Link>
      <button onClick={() => router.back()} style={{ marginTop: 16, marginLeft: 8 }}>Volver al árbol</button>
    </div>
  )
}