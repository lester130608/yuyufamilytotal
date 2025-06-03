'use client'

import { useEffect, useState, useRef } from 'react'
import ELK from 'elkjs/lib/elk.bundled.js'
import { supabase } from '@/lib/supabase'
import { FamilyNode } from './FamilyNode'

const defaultPhotoUrl = "https://cdn-icons-png.flaticon.com/512/149/149071.png"
const NODE_SIZE = 160

function calcularAnchoTexto(texto: string, fontSize = 13, fontFamily = 'Arial', padding = 40) {
  if (typeof window === 'undefined') return 160
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return 160
  ctx.font = `bold ${fontSize}px ${fontFamily}`
  const width = ctx.measureText(texto).width
  return width + padding
}

export default function ArbolGenealogicoPage() {
  const [elkGraph, setElkGraph] = useState<any>(null)
  const [persona, setPersona] = useState<any>(null)
  const [personasLista, setPersonasLista] = useState<any[]>([])
  const [galeria, setGaleria] = useState<any[]>([])
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    birth_date: '',
    birth_place: '',
    death_date: '',
    photo_url: ''
  })
  const [fotoPerfil, setFotoPerfil] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [tipoRelacion, setTipoRelacion] = useState<string>('child') // child, parent, spouse

  useEffect(() => {
    const fetchTree = async () => {
      const { data: personas } = await supabase.from('persons').select('*')
      setPersonasLista(personas || [])
      const { data: relaciones } = await supabase.from('relationships').select('*')
      if (!personas || !relaciones) return

      const nodes = personas.map(p => ({
        id: p.id,
        labels: [{ text: `${p.first_name} ${p.last_name}` }],
        width: NODE_SIZE,
        height: NODE_SIZE,
        photo_url: p.photo_url,
      }))

      const parejaSet = new Set()
      relaciones.forEach(r => {
        if (r.relation_type === 'spouse') {
          const key = [r.person_id, r.related_person_id].sort().join('_')
          parejaSet.add(key)
        }
      })
      const parejaNodes = Array.from(parejaSet).map(key => ({
        id: `pareja_${key}`,
        labels: [{ text: '' }],
        width: 20,
        height: 20,
      }))
      nodes.push(...parejaNodes)

      let edges: any[] = []
      const edgeIds = new Set<string>()

      relaciones.forEach(r => {
        if (r.relation_type === 'spouse') {
          const key = [r.person_id, r.related_person_id].sort().join('_')
          const edgeNodo1 = `edge_pareja_nodo_${r.person_id}_${key}`
          const edgeNodo2 = `edge_pareja_nodo_${r.related_person_id}_${key}`
          if (!edgeIds.has(edgeNodo1)) {
            edges.push({ id: edgeNodo1, sources: [r.person_id], targets: [`pareja_${key}`] })
            edgeIds.add(edgeNodo1)
          }
          if (!edgeIds.has(edgeNodo2)) {
            edges.push({ id: edgeNodo2, sources: [r.related_person_id], targets: [`pareja_${key}`] })
            edgeIds.add(edgeNodo2)
          }
        }
      })

      relaciones.forEach(r => {
        if (r.relation_type === 'parent') {
          const padres = relaciones.filter(rel => rel.relation_type === 'parent' && rel.related_person_id === r.related_person_id).map(rel => rel.person_id).sort()
          const parejaKey = padres.join('_')
          if (padres.length === 2 && parejaSet.has(parejaKey)) {
            const edgeParejaHijoId = `edge_pareja_hijo_${parejaKey}_${r.related_person_id}`
            if (!edgeIds.has(edgeParejaHijoId)) {
              edges.push({ id: edgeParejaHijoId, sources: [`pareja_${parejaKey}`], targets: [r.related_person_id] })
              edgeIds.add(edgeParejaHijoId)
            }
          } else {
            const edgeDirectoId = `edge_${r.person_id}_${r.related_person_id}`
            if (!edgeIds.has(edgeDirectoId)) {
              edges.push({ id: edgeDirectoId, sources: [r.person_id], targets: [r.related_person_id] })
              edgeIds.add(edgeDirectoId)
            }
          }
        }
      })

      const elkInput = {
        id: 'root',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'DOWN',
          'elk.spacing.nodeNode': '40',
          'elk.layered.spacing.nodeNodeBetweenLayers': '100',
          'elk.layered.considerModelOrder': 'true',
          'elk.layered.nodePlacement.bk.fixedAlignment': 'CENTER',
        },
        children: nodes,
        edges: edges,
      }

      const elk = new ELK()
      const elkGraph = await elk.layout(elkInput)
      setElkGraph(elkGraph)
    }
    fetchTree()
  }, [])

  // Manejo de galería (opcional, puedes quitar si no usas galería)
  useEffect(() => {
    if (persona && persona.id) {
      supabase.from('fotos_persona')
        .select('*')
        .eq('persona_id', persona.id)
        .then(({ data }) => setGaleria(data || []))
    }
  }, [persona])

  // Manejo de imagen de perfil
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoPerfil(file)
    const filePath = `personas/${Date.now()}_${file.name}`
    const { error } = await supabase.storage
      .from('fotos-personas')
      .upload(filePath, file)
    if (!error) {
      const url = supabase.storage.from('fotos-personas').getPublicUrl(filePath).data.publicUrl
      setFormData({ ...formData, photo_url: url })
    }
  }

  // Guardar persona y relación
  const handleSave = async () => {
    let fotoPerfilUrl = formData.photo_url
    if (fotoPerfil && !fotoPerfilUrl) {
      const filePath = `personas/${Date.now()}_${fotoPerfil.name}`
      const { error } = await supabase.storage
        .from('fotos-personas')
        .upload(filePath, fotoPerfil)
      if (!error) {
        fotoPerfilUrl = supabase.storage.from('fotos-personas').getPublicUrl(filePath).data.publicUrl
      }
    }
    const { data, error } = await supabase.from('persons').insert([{ ...formData, photo_url: fotoPerfilUrl }]).select()
    if (!error && data && data[0]) {
      const nuevaPersonaId = data[0].id
      let relacion = null
      if (tipoRelacion === 'child' && persona) {
        relacion = { person_id: persona.id, related_person_id: nuevaPersonaId, relation_type: 'parent' }
      } else if (tipoRelacion === 'parent' && persona) {
        relacion = { person_id: nuevaPersonaId, related_person_id: persona.id, relation_type: 'parent' }
      } else if (tipoRelacion === 'spouse' && persona) {
        relacion = { person_id: persona.id, related_person_id: nuevaPersonaId, relation_type: 'spouse' }
      }
      if (relacion) {
        await supabase.from('relationships').insert([relacion])
      }
      setShowForm(false)
      setFormData({
        first_name: '',
        last_name: '',
        birth_date: '',
        birth_place: '',
        death_date: '',
        photo_url: ''
      })
      setFotoPerfil(null)
      window.location.reload()
    }
  }

  // Función para subir la foto a Supabase
  const handlePhotoChange = async (file: File) => {
    if (!persona || !file) return
    const fileExt = file.name.split('.').pop()
    const fileName = `${persona.id}.${fileExt}`
    const { error } = await supabase.storage
      .from('fotos-personas')
      .upload(fileName, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('fotos-personas').getPublicUrl(fileName)
      await supabase.from('persons').update({ photo_url: data.publicUrl }).eq('id', persona.id)
      setPersona({ ...persona, photo_url: data.publicUrl })
    }
  }

  return (
    <div style={{ width: '100%', height: '90vh', background: 'transparent', overflow: 'auto' }}>
      <svg width="1200" height={elkGraph ? elkGraph.height + 100 : 800}>
        {elkGraph && (
          <>
            {/* Dibuja las relaciones (edges) */}
            {elkGraph.edges && elkGraph.edges.map((edge: any) => {
              const sourceNode = elkGraph.children.find((n: any) => n.id === edge.sources[0])
              const targetNode = elkGraph.children.find((n: any) => n.id === edge.targets[0])
              if (!sourceNode || !targetNode) return null
              return (
                <line
                  key={edge.id}
                  x1={sourceNode.x + (sourceNode.width || 0) / 2}
                  y1={sourceNode.y + (sourceNode.height || 0) / 2}
                  x2={targetNode.x + (targetNode.width || 0) / 2}
                  y2={targetNode.y + (targetNode.height || 0) / 2}
                  stroke="#999"
                  strokeWidth={2}
                />
              )
            })}
            {/* Dibuja los nodos */}
            {elkGraph.children && elkGraph.children.map((node: any) => (
              <g
                key={node.id}
                transform={`translate(${node.x + (node.width || 0) / 2}, ${node.y + (node.height || 0) / 2})`}
                style={{ cursor: 'pointer' }}
              >
                <foreignObject
                  x={-NODE_SIZE / 2}
                  y={-NODE_SIZE / 2}
                  width={NODE_SIZE}
                  height={NODE_SIZE}
                >
                  <FamilyNode
                    name={node.labels?.[0]?.text || ''}
                    photoUrl={node.photo_url || defaultPhotoUrl}
                    onClick={() => {
                      const nombreCompleto = node.labels?.[0]?.text || ''
                      const personaEncontrada = personasLista.find(
                        p => `${p.first_name} ${p.last_name}` === nombreCompleto
                      )
                      setPersona(personaEncontrada || null)
                    }}
                  />
                </foreignObject>
              </g>
            ))}
          </>
        )}
      </svg>

      {/* Botón flotante para agregar familiar cercano */}
      <button
        style={{
          position: 'fixed',
          bottom: 30,
          right: 30,
          background: '#b71c1c',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          width: 48,
          height: 48,
          fontSize: 28,
          boxShadow: '0 2px 8px #0002',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={() => setShowForm(true)}
        title="Agregar familiar cercano"
      >
        +
      </button>

      {/* Modal de ficha de persona */}
      {persona && (
        <div style={{
          position: 'fixed',
          top: '10%',
          left: '50%',
          transform: 'translate(-50%, 0)',
          background: '#fff',
          border: '2px solid #900',
          borderRadius: 18,
          padding: 40,
          zIndex: 100,
          minWidth: 320,
          minHeight: 220,
          boxShadow: '0 8px 32px #0004',
          maxWidth: 400,
          fontSize: 20
        }}>
          <h2 style={{ fontSize: 24, marginBottom: 18 }}>Ficha de la Persona</h2>
          <FamilyNode
            name={`${persona.first_name} ${persona.last_name}`}
            photoUrl={persona.photo_url}
            onPhotoChange={handlePhotoChange}
          />

          {/* Botón para subir a galería */}
          <div style={{ marginTop: 20 }}>
            <input
              type="file"
              accept="image/*"
              id="galeria-upload"
              style={{ display: 'none' }}
              onChange={async e => {
                const file = e.target.files?.[0]
                if (!file) return
                const filePath = `galeria/${persona.id}_${Date.now()}_${file.name}`
                const { error } = await supabase.storage
                  .from('fotos-personas')
                  .upload(filePath, file)
                if (!error) {
                  const url = supabase.storage.from('fotos-personas').getPublicUrl(filePath).data.publicUrl
                  await supabase.from('fotos_persona').insert([{ persona_id: persona.id, url }])
                  // Refresca galería
                  const { data } = await supabase
                    .from('fotos_persona')
                    .select('*')
                    .eq('persona_id', persona.id)
                  setGaleria(data || [])
                }
              }}
            />
            <button
              style={{
                marginTop: 8,
                background: '#b71c1c',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 18px',
                cursor: 'pointer',
                fontSize: 16,
              }}
              onClick={() => document.getElementById('galeria-upload')?.click()}
            >
              Subir foto a galería
            </button>
          </div>

          {/* Mostrar galería */}
          {galeria.length > 0 && (
            <div style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {galeria.map((foto: any) => (
                <img
                  key={foto.id}
                  src={foto.url}
                  alt="Galería"
                  style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', border: '1px solid #ccc' }}
                />
              ))}
            </div>
          )}

          <p><strong>Fecha de nacimiento:</strong> {persona.birth_date}</p>
          <p><strong>Lugar de nacimiento:</strong> {persona.birth_place}</p>
          {persona.death_date && (
            <p><strong>Fecha de defunción:</strong> {persona.death_date}</p>
          )}

          {/* Botón para agregar familiar */}
          <button
            style={{
              marginTop: 18,
              background: '#b71c1c',
              color: '#fff',
              border: 'none',
              borderRadius: '50%',
              width: 48,
              height: 48,
              fontSize: 28,
              boxShadow: '0 2px 8px #0002',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => setShowForm(true)}
            title="Agregar familiar cercano"
          >
            +
          </button>

          <button onClick={() => setPersona(null)} style={{ fontSize: 18, marginTop: 20 }}>Cerrar</button>
        </div>
      )}

      {/* Formulario para agregar familiar cercano */}
      {showForm && (
        <div style={{
          position: 'fixed',
          top: '15%',
          left: '50%',
          transform: 'translate(-50%, 0)',
          background: '#fff',
          border: '2px solid #900',
          borderRadius: 18,
          padding: 40,
          zIndex: 2000,
          minWidth: 320,
          boxShadow: '0 8px 32px #0004',
          maxWidth: 400,
        }}>
          <h2>Agregar Familiar</h2>
          <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
            <input
              type="text"
              placeholder="Nombre"
              value={formData.first_name}
              onChange={e => setFormData({ ...formData, first_name: e.target.value })}
              style={{ width: '100%', marginBottom: 10, padding: 8 }}
              required
            />
            <input
              type="text"
              placeholder="Apellidos"
              value={formData.last_name}
              onChange={e => setFormData({ ...formData, last_name: e.target.value })}
              style={{ width: '100%', marginBottom: 10, padding: 8 }}
            />
            <input
              type="date"
              placeholder="Fecha de nacimiento"
              value={formData.birth_date}
              onChange={e => setFormData({ ...formData, birth_date: e.target.value })}
              style={{ width: '100%', marginBottom: 10, padding: 8 }}
            />
            <input
              type="text"
              placeholder="Lugar de nacimiento"
              value={formData.birth_place}
              onChange={e => setFormData({ ...formData, birth_place: e.target.value })}
              style={{ width: '100%', marginBottom: 10, padding: 8 }}
            />
            <input
              type="date"
              placeholder="Fecha de defunción"
              value={formData.death_date || ''}
              onChange={e => setFormData({ ...formData, death_date: e.target.value })}
              style={{ width: '100%', marginBottom: 10, padding: 8 }}
            />
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              style={{ marginBottom: 10 }}
              onChange={handleFileChange}
            />
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <label>
                <input
                  type="radio"
                  checked={tipoRelacion === 'child'}
                  onChange={() => setTipoRelacion('child')}
                /> Hijo/a
              </label>
              <label>
                <input
                  type="radio"
                  checked={tipoRelacion === 'parent'}
                  onChange={() => setTipoRelacion('parent')}
                /> Padre/Madre
              </label>
              <label>
                <input
                  type="radio"
                  checked={tipoRelacion === 'spouse'}
                  onChange={() => setTipoRelacion('spouse')}
                /> Cónyuge
              </label>
            </div>
            <button type="submit" style={{ background: '#b71c1c', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 16 }}>
              Guardar
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={{ marginLeft: 10 }}>
              Cancelar
            </button>
          </form>
        </div>
      )}
    </div>
  )
}