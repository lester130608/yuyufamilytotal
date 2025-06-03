'use client'

import { useEffect, useState, useRef } from 'react'
import ELK from 'elkjs/lib/elk.bundled.js'
import { supabase } from '@/lib/supabase'
import { FamilyNode } from './FamilyNode'
import {
  getDefaultElkLayoutOptions,
  createPairNode,
  addSpouseEdges,
  addParentChildEdge
} from './utils/elkLayoutHelpers'
import { useRouter } from 'next/navigation'

const defaultPhotoUrl = "https://cdn-icons-png.flaticon.com/512/149/149071.png"
const NODE_SIZE = 160
const PARENT_SIBLING_SPACING = NODE_SIZE // Usa el mismo valor para ambos

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
  const router = useRouter()

  useEffect(() => {
    const session = supabase.auth.getSession()
    session.then(({ data }) => {
      if (!data.session) {
        router.replace('/login')
      }
    })
  }, [router])

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
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement>(null)
  const isPanning = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const [padresOpciones, setPadresOpciones] = useState<any[]>([])
  const [padreSeleccionado, setPadreSeleccionado] = useState<string | null>(null)

  const [editMode, setEditMode] = useState(false)
  const [editFormData, setEditFormData] = useState<any>({})

  // Handlers para zoom y pan
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const scale = e.deltaY < 0 ? 1.1 : 0.9
    setZoom(z => Math.max(0.1, Math.min(3, z * scale)))
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    isPanning.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning.current) return
    setOffset(off => ({
      x: off.x + (e.clientX - lastPos.current.x),
      y: off.y + (e.clientY - lastPos.current.y)
    }))
    lastPos.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseUp = () => {
    isPanning.current = false
  }

  useEffect(() => {
    const fetchTree = async () => {
      const { data: personas } = await supabase.from('persons').select('*')
      const { data: relaciones } = await supabase.from('relationships').select('*')
      if (!personas || !relaciones) return

      setPersonasLista(personas)

      // 1. Crear nodos de personas
      let nodes: any[] = personas.map(p => ({
        id: p.id,
        labels: [{ text: `${p.first_name} ${p.last_name}` }],
        width: NODE_SIZE,
        height: NODE_SIZE,
        photo_url: p.photo_url,
      }))

      // 2. Crear contenedores para parejas (esposos)
      const coupleContainers: any[] = []
      const spouseEdgeIds = new Set<string>()
      relaciones.forEach(r => {
        if (r.relation_type === 'spouse') {
          const key = [r.person_id, r.related_person_id].sort()
          const parejaId = `pareja_${key.join('_')}`
          const person1 = nodes.find(n => n.id === key[0])
          const person2 = nodes.find(n => n.id === key[1])

          // 1. Ajusta el contenedor de parejas:
          if (person1 && person2) {
            coupleContainers.push({
              id: parejaId,
              children: [
                { ...person1, layoutOptions: { 'elk.position': '(0, 0)' } },
                { ...person2, layoutOptions: { 'elk.position': `(${PARENT_SIBLING_SPACING}, 0)` } },
              ],
              layoutOptions: {
                'elk.algorithm': 'layered',
                'elk.direction': 'RIGHT',
                'elk.spacing.nodeNode': `${PARENT_SIBLING_SPACING}`, // Uniformidad entre padres
                'elk.layered.layerConstraint': 'FIRST'
              },
            })

            nodes = nodes.filter(n => n.id !== person1.id && n.id !== person2.id)
          }
        }
      })
      nodes.push(...coupleContainers)

      // 3. Crear edges padre-hijo
      let edges: any[] = []
      const edgeIds = new Set<string>()
      relaciones.forEach(r => {
        if (r.relation_type === 'parent') {
          const padres = relaciones
            .filter(rel => rel.relation_type === 'parent' && rel.related_person_id === r.related_person_id)
            .map(rel => rel.person_id)
            .sort()

          if (padres.length === 2) {
            const parejaKey = padres.join('_')
            const parejaId = `pareja_${parejaKey}`
            if (nodes.some(n => n.id === parejaId)) {
              const edgeId = `edge_${parejaId}_to_${r.related_person_id}`
              if (!edgeIds.has(edgeId)) {
                edges.push({
                  id: edgeId,
                  sources: [parejaId],
                  targets: [r.related_person_id],
                  layoutOptions: { 'elk.layered.priority': 'HIGH' },
                })
                edgeIds.add(edgeId)
              }
              return
            }
          }
          // Si no hay pareja, conecta padre/madre directo
          const edgeId = `edge_${r.person_id}_to_${r.related_person_id}`
          if (!edgeIds.has(edgeId)) {
            edges.push({
              id: edgeId,
              sources: [r.person_id],
              targets: [r.related_person_id],
              layoutOptions: { 'elk.layered.priority': 'HIGH' },
            })
            edgeIds.add(edgeId)
          }
        }
      })

      // 4. Agregar edges de tipo spouse (visual)
      relaciones.forEach(r => {
        if (r.relation_type === 'spouse') {
          const key = [r.person_id, r.related_person_id].sort()
          const edgeId = `spouse_edge_${key.join('_')}`
          if (!spouseEdgeIds.has(edgeId)) {
            edges.push({
              id: edgeId,
              sources: [key[0]],
              targets: [key[1]],
              layoutOptions: { 'priority': 'LOW' }
            })
            spouseEdgeIds.add(edgeId)
          }
        }
      })

      // 5. Configurar layout ELK
      const elkInput = {
        id: 'root',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'DOWN',
          'elk.edgeRouting': 'ORTHOGONAL',
          'elk.layered.layering.strategy': 'LONGEST_PATH',
          'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
          'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
          'elk.layered.nodePlacement.bk.edgeStraightening': 'IMPROVE_STRAIGHTNESS',
          'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
          'elk.layered.spacing.edgeNodeBetweenLayers': '80',
          'elk.layered.spacing.nodeNodeBetweenLayers': '120',
          'elk.layered.spacing.nodeNode': `${PARENT_SIBLING_SPACING}`, // Uniformidad entre hermanos
          'elk.layered.spacing.alignment': 'CENTER',
          'elk.spacing.nodeNode': `${PARENT_SIBLING_SPACING}`,
          'elk.spacing.edgeNode': '60',
          'elk.spacing.edgeEdge': '40',
          'elk.layered.considerModelOrder': 'true',
          'elk.layered.crossingMinimization.semiInteractive': 'true'
        },
        children: nodes,
        edges: edges
      }

      const elk = new ELK()
      const elkGraph = await elk.layout(elkInput)
      setElkGraph(elkGraph)
    }

    fetchTree()
  }, [])

  // Manejo de galería (tabla correcta)
  useEffect(() => {
    if (persona && persona.id) {
      supabase.from('person_photos')
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

  // Subida de foto a galería (en el modal de ficha de persona)
  const handleGalleryUpload = async (file: File) => {
    if (!persona || !file) return
    const filePath = `galeria/${persona.id}_${Date.now()}_${file.name}`
    const { error } = await supabase.storage
      .from('fotos-personas')
      .upload(filePath, file)
    if (!error) {
      const url = supabase.storage.from('fotos-personas').getPublicUrl(filePath).data.publicUrl
      await supabase.from('person_photos').insert([{ persona_id: persona.id, url }])
      const { data } = await supabase
        .from('person_photos')
        .select('*')
        .eq('persona_id', persona.id)
      setGaleria(data || [])
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

    let familyCodeToUse = null
    let rootCodeToUse = null
    if (persona && persona.family_code) {
      familyCodeToUse = persona.family_code
      rootCodeToUse = persona.root_code || persona.family_code
    } else if (persona && persona.id) {
      familyCodeToUse = persona.id
      rootCodeToUse = persona.id
    }

    const cleanFormData = Object.fromEntries(
      Object.entries({
        ...formData,
        photo_url: fotoPerfilUrl,
        family_code: familyCodeToUse,
        root_code: rootCodeToUse
      }).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    )

    const { data, error } = await supabase.from('persons').insert([cleanFormData]).select()
    if (error || !data || !data[0]) return

    const nuevaPersonaId = data[0].id
    let relacionesToInsert: any[] = []

    if (tipoRelacion === 'child' && persona) {
      relacionesToInsert.push({
        person_id: persona.id,
        related_person_id: nuevaPersonaId,
        relation_type: 'parent'
      })

      const { data: relacionesSpouse } = await supabase
        .from('relationships')
        .select('*')
        .or(`and(person_id.eq.${persona.id}, relation_type.eq.spouse),and(related_person_id.eq.${persona.id}, relation_type.eq.spouse)`)

      if (relacionesSpouse && relacionesSpouse.length > 0) {
        const spouseId = relacionesSpouse[0].person_id === persona.id
          ? relacionesSpouse[0].related_person_id
          : relacionesSpouse[0].person_id

        relacionesToInsert.push({
          person_id: spouseId,
          related_person_id: nuevaPersonaId,
          relation_type: 'parent'
        })
      }
    } else if (tipoRelacion === 'parent' && persona) {
      relacionesToInsert.push({
        person_id: nuevaPersonaId,
        related_person_id: persona.id,
        relation_type: 'parent'
      })
    } else if (tipoRelacion === 'spouse' && persona) {
      relacionesToInsert.push({
        person_id: persona.id,
        related_person_id: nuevaPersonaId,
        relation_type: 'spouse'
      })
    }

    if (tipoRelacion === 'hermano') {
      const raw = sessionStorage.getItem('hermano_padres')
      if (raw) {
        const padresIds = JSON.parse(raw)
        const relacionesHermano = padresIds.map((padreId: string) => ({
          person_id: padreId,
          related_person_id: nuevaPersonaId,
          relation_type: 'parent'
        }))
        relacionesToInsert.push(...relacionesHermano)
        sessionStorage.removeItem('hermano_padres')
      }
    }

    if (relacionesToInsert.length > 0) {
      await supabase.from('relationships').insert(relacionesToInsert)
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
      <div style={{ marginBottom: 8 }}>
        <button onClick={() => setOffset({ x: offset.x - 100, y: offset.y })}>← Izquierda</button>
        <button onClick={() => setOffset({ x: offset.x + 100, y: offset.y })}>Derecha →</button>
      </div>
      <div
        ref={svgRef}
        style={{
          width: '100%',
          height: '90vh',
          overflow: 'scroll',
          background: 'transparent',
          cursor: isPanning.current ? 'grabbing' : 'grab',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          width={3000}
          height={3000}
          style={{ transform: `scale(${zoom})`, transformOrigin: '0 0' }}
        >
          <g transform={`translate(${offset.x},${offset.y})`}>
            {elkGraph && (
              <>
                {elkGraph.edges && elkGraph.edges.map((edge: any) => {
                  if (edge.sources[0].startsWith('pareja_')) {
                    const parejaId = edge.sources[0]
                    const parejaNode = elkGraph.children.find((n: any) => n.id === parejaId)
                    const hijo = elkGraph.children.find((n: any) => n.id === edge.targets[0])

                    if (!parejaNode || !parejaNode.children || !hijo) return null

                    const padre1 = parejaNode.children[0]
                    const padre2 = parejaNode.children[1]

                    const xPadre1 = padre1.x + (padre1.width || 0) / 2
                    const yPadre1 = padre1.y + (padre1.height || 0) / 2
                    const xPadre2 = padre2.x + (padre2.width || 0) / 2
                    const yPadre2 = padre2.y + (padre2.height || 0) / 2

                    const xMid = (xPadre1 + xPadre2) / 2
                    const yMid = (yPadre1 + yPadre2) / 2

                    const xHijo = hijo.x + (hijo.width || 0) / 2
                    const yHijo = hijo.y + (hijo.height || 0) / 2

                    return (
                      <>
                        <line
                          key={`${edge.id}_horizontal`}
                          x1={xPadre1}
                          y1={yPadre1}
                          x2={xPadre2}
                          y2={yPadre2}
                          stroke="#999"
                          strokeWidth={2}
                        />
                        <line
                          key={`${edge.id}_vertical`}
                          x1={xMid}
                          y1={yMid}
                          x2={xMid}
                          y2={yHijo}
                          stroke="#999"
                          strokeWidth={2}
                        />
                        <line
                          key={`${edge.id}_horizontal_to_child`}
                          x1={xMid}
                          y1={yHijo}
                          x2={xHijo}
                          y2={yHijo}
                          stroke="#999"
                          strokeWidth={2}
                        />
                      </>
                    )
                  }

                  const sourceNode = elkGraph.children.find((n: any) => n.id === edge.sources[0])
                  const targetNode = elkGraph.children.find((n: any) => n.id === edge.targets[0])
                  if (!sourceNode || !targetNode || !sourceNode.x || !targetNode.x) return null

                  const xSource = sourceNode.x + (sourceNode.width || 0) / 2
                  const ySource = sourceNode.y + (sourceNode.height || 0) / 2
                  const xTarget = targetNode.x + (targetNode.width || 0) / 2
                  const yTarget = targetNode.y + (targetNode.height || 0) / 2

                  return (
                    <>
                      <line
                        key={`${edge.id}_vertical`}
                        x1={xSource}
                        y1={ySource}
                        x2={xSource}
                        y2={yTarget}
                        stroke="#999"
                        strokeWidth={2}
                      />
                      <line
                        key={`${edge.id}_horizontal`}
                        x1={xSource}
                        y1={yTarget}
                        x2={xTarget}
                        y2={yTarget}
                        stroke="#999"
                        strokeWidth={2}
                      />
                    </>
                  )
                })}
                {elkGraph.children && elkGraph.children.flatMap((node: any) => {
                  if (node.id.startsWith('pareja_') && node.children) {
                    return node.children.map((child: any) => (
                      <g
                        key={child.id}
                        transform={`translate(${child.x + (child.width || 0) / 2}, ${child.y + (child.height || 0) / 2})`}
                        style={{ cursor: 'pointer' }}
                      >
                        <foreignObject
                          x={-NODE_SIZE / 2}
                          y={-NODE_SIZE / 2}
                          width={NODE_SIZE}
                          height={NODE_SIZE}
                        >
                          <FamilyNode
                            name={child.labels?.[0]?.text || ''}
                            photoUrl={child.photo_url || defaultPhotoUrl}
                            onClick={() => {
                              const nombreCompleto = child.labels?.[0]?.text || ''
                              const personaEncontrada = personasLista.find(
                                p => `${p.first_name} ${p.last_name}` === nombreCompleto
                              )
                              setPersona(personaEncontrada || null)
                            }}
                          />
                        </foreignObject>
                      </g>
                    ))
                  }
                  if (node.id.startsWith('junction_')) return null
                  return (
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
                  )
                })}
              </>
            )}
          </g>
        </svg>
      </div>
      {persona && (
        <div style={{
          position: 'fixed',
          top: '10%',
          left: '50%',
          transform: 'translate(-50%, 0)',
          background: '#fff',
          border: '2px solid #900',
          borderRadius: 18,
          padding: 30,
          zIndex: 100,
          minWidth: 360,
          maxWidth: 420,
          boxShadow: '0 8px 32px #0004',
          fontSize: 18
        }}>
          <h2 style={{ fontSize: 24, marginBottom: 20 }}>Ficha de {persona.first_name} {persona.last_name}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <img
              src={persona.photo_url || defaultPhotoUrl}
              alt="Perfil"
              style={{ width: 80, height: 80, borderRadius: '50%', border: '2px solid #444', objectFit: 'cover' }}
            />
            <button
              onClick={() => document.getElementById('foto-cambiar')?.click()}
              style={{ padding: '6px 12px', borderRadius: 6, background: '#1976d2', color: 'white', border: 'none', cursor: 'pointer' }}
            >
              Cambiar foto
            </button>
            <input
              type="file"
              accept="image/*"
              id="foto-cambiar"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handlePhotoChange(file)
              }}
            />
          </div>
          <p><strong>Fecha de nacimiento:</strong> {persona.birth_date}</p>
          <p><strong>Lugar de nacimiento:</strong> {persona.birth_place}</p>
          {persona.death_date && <p><strong>Fecha de fallecimiento:</strong> {persona.death_date}</p>}
          {persona.death_place && <p><strong>Lugar de fallecimiento:</strong> {persona.death_place}</p>}
          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 18, marginBottom: 8 }}>Galería de fotos:</h3>
            <button
              onClick={() => document.getElementById('galeria-upload')?.click()}
              style={{ marginBottom: 12, background: 'transparent', color: '#1976d2', border: 'none', cursor: 'pointer', fontSize: 16 }}
            >
              + Agregar foto
            </button>
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
                  await supabase.from('person_photos').insert([{ persona_id: persona.id, url }])
                  const { data } = await supabase.from('person_photos').select('*').eq('persona_id', persona.id)
                  setGaleria(data || [])
                }
              }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {galeria.map((foto: any) => (
                <img
                  key={foto.id}
                  src={foto.url}
                  alt="Galería"
                  style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', border: '1px solid #ccc' }}
                />
              ))}
            </div>
          </div>
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => setShowForm(true)}
              title="Agregar familiar"
              style={{ background: '#b71c1c', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer' }}
            >
              + Agregar familiar
            </button>
            <button onClick={() => setPersona(null)} style={{ fontSize: 16, background: 'transparent', border: 'none', color: '#555' }}>
              Cerrar
            </button>
          </div>
        </div>
      )}
      {showForm && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#fff',
          padding: 32,
          borderRadius: 8,
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
          zIndex: 1000,
          width: 600,
        }}>
          <h2>Agregar Persona</h2>
          <div style={{ marginBottom: 16 }}>
            <label>
              Nombre:
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 4, border: '1px solid #ccc' }}
              />
            </label>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>
              Apellido:
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 4, border: '1px solid #ccc' }}
              />
            </label>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>
              Fecha de nacimiento:
              <input
                type="text"
                value={formData.birth_date}
                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 4, border: '1px solid #ccc' }}
              />
            </label>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>
              Lugar de nacimiento:
              <input
                type="text"
                value={formData.birth_place}
                onChange={(e) => setFormData({ ...formData, birth_place: e.target.value })}
                style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 4, border: '1px solid #ccc' }}
              />
            </label>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>
              Fecha de fallecimiento:
              <input
                type="text"
                value={formData.death_date}
                onChange={(e) => setFormData({ ...formData, death_date: e.target.value })}
                style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 4, border: '1px solid #ccc' }}
              />
            </label>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>
              Foto:
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                ref={fileInputRef}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#0070f3',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Subir foto
              </button>
            </label>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>
              Relación con {persona ? `${persona.first_name} ${persona.last_name}` : 'la persona seleccionada'}:
              <select
                value={tipoRelacion}
                onChange={(e) => setTipoRelacion(e.target.value)}
                style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 4, border: '1px solid #ccc' }}
              >
                <option value="child">Hijo/a</option>
                <option value="parent">Padre/madre</option>
                <option value="spouse">Cónyuge</option>
                <option value="hermano">Hermano/a</option>
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowForm(false)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#ccc',
                color: '#333',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                marginRight: 8,
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '8px 16px',
                backgroundColor: '#0070f3',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ForeignObject({ children }: { children: React.ReactNode }) {
  return (
    <foreignObject width="100%" height="100%">
      {children}
    </foreignObject>
  )
}