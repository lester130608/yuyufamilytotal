'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export default function NuevaPersonaPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const relacionarCon = searchParams.get('relacionar_con')
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    birth_date: '',
    death_date: '',
    birth_place: '',
    photo_url: ''
  })
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mensaje, setMensaje] = useState('')
  const [relacion, setRelacion] = useState<'padre' | 'madre' | 'hijo' | 'hermano' | 'esposo'>('hijo')
  const [personaBaseId, setPersonaBaseId] = useState<string>(relacionarCon || '')
  const [segundoPadreId, setSegundoPadreId] = useState<string>('') // Nuevo estado
  const [personas, setPersonas] = useState<any[]>([])

  useEffect(() => {
    supabase.from('persons').select('*').then(({ data }) => {
      setPersonas(data || [])
    })
    if (relacionarCon) setPersonaBaseId(relacionarCon)
  }, [relacionarCon])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const filePath = `personas/${Date.now()}_${file.name}`
    const { error } = await supabase.storage
      .from('fotos-personas')
      .upload(filePath, file)
    if (!error) {
      const url = supabase.storage.from('fotos-personas').getPublicUrl(filePath).data.publicUrl
      setFormData({ ...formData, photo_url: url })
    }
  }

  const handleSave = async () => {
    setLoading(true)
    setMensaje('')
    try {
      if (!personaBaseId) {
        setMensaje('Debes seleccionar la persona con la que se relaciona')
        setLoading(false)
        return
      }

      const datosPersona = {
        ...formData,
        birth_date: formData.birth_date || null,
        death_date: formData.death_date || null,
      }

      const { data: nuevaPersona, error: errorPersona } = await supabase
        .from('persons')
        .insert([datosPersona])
        .select()
        .single()

      if (errorPersona || !nuevaPersona) {
        setMensaje('Error al guardar persona: ' + (errorPersona?.message || ''))
        setLoading(false)
        return
      }

      // Lógica de relaciones
      let relaciones = []
      if (relacion === 'hijo') {
        relaciones.push({ person_id: personaBaseId, related_person_id: nuevaPersona.id, relation_type: 'child' })
        if (segundoPadreId && segundoPadreId !== personaBaseId) {
          relaciones.push({ person_id: segundoPadreId, related_person_id: nuevaPersona.id, relation_type: 'child' })
        }
      } else if (relacion === 'padre' || relacion === 'madre') {
        relaciones.push({ person_id: nuevaPersona.id, related_person_id: personaBaseId, relation_type: 'child' })
      } else if (relacion === 'esposo') {
        relaciones.push(
          { person_id: personaBaseId, related_person_id: nuevaPersona.id, relation_type: 'spouse' },
          { person_id: nuevaPersona.id, related_person_id: personaBaseId, relation_type: 'spouse' }
        )
      }
      if (relaciones.length > 0) {
        const { error: errorRelacion } = await supabase.from('relationships').insert(relaciones)
        if (errorRelacion) {
          setMensaje('Error al guardar relación: ' + errorRelacion.message)
          setLoading(false)
          return
        }
      }
      setMensaje('Persona y relación guardadas correctamente')
      setFormData({
        first_name: '',
        last_name: '',
        birth_date: '',
        death_date: '',
        birth_place: '',
        photo_url: ''
      })
      setSegundoPadreId('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      setTimeout(() => {
        router.push('/familia/arbol')
      }, 1200)
    } catch (err: any) {
      setMensaje('Error inesperado: ' + (err.message || err))
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: 400, margin: '40px auto', background: '#fff', borderRadius: 10, padding: 32 }}>
      <h2>Adicionar familiar</h2>
      <label>Tipo de relación:</label>
      <select value={relacion} onChange={e => setRelacion(e.target.value as any)} style={{ width: '100%', margin: '8px 0' }}>
        <option value="hijo">Hijo/a</option>
        <option value="padre">Padre</option>
        <option value="madre">Madre</option>
        <option value="hermano">Hermano/a</option>
        <option value="esposo">Esposo/a</option>
      </select>
      {/* Selector de segundo padre/madre solo si es hijo */}
      {relacion === 'hijo' && (
        <div style={{ margin: '8px 0' }}>
          <label>Segundo padre/madre (opcional):</label>
          <select
            value={segundoPadreId}
            onChange={e => setSegundoPadreId(e.target.value)}
            style={{ width: '100%', marginTop: 4 }}
          >
            <option value="">Selecciona...</option>
            {personas
              .filter(p => p.id !== personaBaseId)
              .map(p => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
          </select>
        </div>
      )}
      <input placeholder="Nombre" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} style={{ width: '100%', margin: '8px 0' }} />
      <input placeholder="Apellidos" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} style={{ width: '100%', margin: '8px 0' }} />
      <input placeholder="Fecha de nacimiento" type="date" value={formData.birth_date} onChange={e => setFormData({ ...formData, birth_date: e.target.value })} style={{ width: '100%', margin: '8px 0' }} />
      <input placeholder="Fecha de defunción" type="date" value={formData.death_date} onChange={e => setFormData({ ...formData, death_date: e.target.value })} style={{ width: '100%', margin: '8px 0' }} />
      <input placeholder="Lugar de nacimiento" value={formData.birth_place} onChange={e => setFormData({ ...formData, birth_place: e.target.value })} style={{ width: '100%', margin: '8px 0' }} />
      <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ margin: '8px 0' }} />
      {formData.photo_url && (
        <img
          src={formData.photo_url}
          alt="Foto"
          width={120}
          style={{ borderRadius: 8, margin: '8px 0' }}
        />
      )}
      <button onClick={handleSave} disabled={loading} style={{ marginTop: 16, padding: '8px 16px', fontWeight: 'bold', borderRadius: 6, background: '#cc0000', color: '#fff', border: 'none' }}>
        {loading ? 'Guardando...' : 'Guardar'}
      </button>
      <button
        onClick={() => router.push('/familia/arbol')}
        style={{ marginTop: 16, marginLeft: 8, padding: '8px 16px', borderRadius: 6, background: '#888', color: '#fff', border: 'none' }}
      >
        Volver al árbol
      </button>
      {mensaje && <div style={{ marginTop: 16, color: mensaje.includes('Error') ? 'red' : 'green' }}>{mensaje}</div>}
    </div>
  )
}