'use client'

import React, { useEffect, useState, useRef } from 'react'
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
const PARENT_SIBLING_SPACING = NODE_SIZE

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

  // Estado para saber si el usuario está autenticado (admin)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsAdmin(!!data.session)
    })
  }, [])

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
  const [tipoRelacion, setTipoRelacion] = useState<string>('child')
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement>(null)
  const isPanning = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const [padresOpciones, setPadresOpciones] = useState<any[]>([])
  const [padreSeleccionado, setPadreSeleccionado] = useState<string | null>(null)

  const [editMode, setEditMode] = useState(false)
  const [editFormData, setEditFormData] = useState<any>({})

  const [wizardStep, setWizardStep] = useState(1)
  const [padresParaHermano, setPadresParaHermano] = useState<string[]>([])

  const [relaciones, setRelaciones] = useState<any[]>([])

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
      setRelaciones(relaciones) // <-- agrega esto

      // Al construir los nodos para ELK:
      // 1. Crear nodos de pareja (solo si hay hijos en común)
      const nodes: any[] = personas.map(p => ({
        id: p.id,
        labels: [{ text: `${p.first_name} ${p.last_name}` }],
        width: NODE_SIZE,
        height: NODE_SIZE,
        photo_url: p.photo_url,
        type: 'person'
      }))

      const edges: any[] = []
      const edgeIds = new Set<string>()
      const parejaSet = new Set<string>()

      relaciones.forEach(r => {
        if (r.relation_type === 'parent') {
          // Buscar ambos padres de cada hijo
          const padres = relaciones
            .filter(rel => rel.relation_type === 'parent' && rel.related_person_id === r.related_person_id)
            .map(rel => rel.person_id)
            .sort()
          if (padres.length === 2) {
            const [fatherId, motherId] = padres
            const pairId = `pareja_${fatherId}_${motherId}`
            parejaSet.add(pairId)

            // 2. Agregar nodo de pareja invisible
            if (!nodes.some(n => n.id === pairId)) {
              nodes.push({
                id: pairId,
                width: 1,
                height: 1,
                layoutOptions: { 'elk.invisible': true }
              })
            }

            // 3. Conectar ambos padres al nodo de pareja
            if (!edgeIds.has(`edge-${fatherId}-${pairId}`)) {
              edges.push({
                id: `edge-${fatherId}-${pairId}`,
                sources: [fatherId],
                targets: [pairId]
              })
              edgeIds.add(`edge-${fatherId}-${pairId}`)
            }
            if (!edgeIds.has(`edge-${motherId}-${pairId}`)) {
              edges.push({
                id: `edge-${motherId}-${pairId}`,
                sources: [motherId],
                targets: [pairId]
              })
              edgeIds.add(`edge-${motherId}-${pairId}`)
            }

            // 4. Conectar cada hijo al nodo de pareja
            if (!edgeIds.has(`edge-${pairId}-${r.related_person_id}`)) {
              edges.push({
                id: `edge-${pairId}-${r.related_person_id}`,
                sources: [pairId],
                targets: [r.related_person_id]
              })
              edgeIds.add(`edge-${pairId}-${r.related_person_id}`)
            }
            return
          }
          // Si solo hay un padre/madre, conectar directo
          const edgeId = `edge-${r.person_id}-${r.related_person_id}`
          if (!edgeIds.has(edgeId)) {
            edges.push({
              id: edgeId,
              sources: [r.person_id],
              targets: [r.related_person_id]
            })
            edgeIds.add(edgeId)
          }
        }
      })

      // 7. OPCIONAL: Debug de edges inválidos
      edges.forEach(edge => {
        if (!nodes.some(n => n.id === edge.sources[0]) || !nodes.some(n => n.id === edge.targets[0])) {
          console.warn("Invalid edge detected:", edge)
        }
      })

      const elk = new ELK()
      const elkGraph = await elk.layout({
        id: 'root',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'DOWN',
          'elk.edgeRouting': 'ORTHOGONAL',
          'elk.spacing.nodeNode': '100',
          'elk.layered.spacing.nodeNodeBetweenLayers': '120',
          'elk.layered.nodePlacement.bk.fixedAlignment': 'CENTER',
        },
        children: nodes,
        edges,
      })

      setElkGraph(elkGraph)
    }

    fetchTree()
  }, [])

  useEffect(() => {
    if (persona && persona.id) {
      supabase.from('person_photos')
        .select('*')
        .eq('person_id', persona.id) // <-- aquí el campo debe ser 'person_id'
        .then(({ data }) => setGaleria(data || []))
    }
  }, [persona])

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
      // Relación bidireccional de pareja
      relacionesToInsert.push(
        {
          person_id: persona.id,
          related_person_id: nuevaPersonaId,
          relation_type: 'spouse'
        },
        {
          person_id: nuevaPersonaId,
          related_person_id: persona.id,
          relation_type: 'spouse'
        }
      )
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

  const handleNext = () => {
    if (tipoRelacion === 'hermano') {
      // Al pasar a paso 2, busca los padres de la persona seleccionada
      if (persona) {
        const padresIds = personasLista
          .filter(p =>
            relaciones.some(
              r =>
                r.relation_type === 'parent' &&
                r.related_person_id === persona.id &&
                r.person_id === p.id
            )
          )
          .map(p => p.id)
        setPadresParaHermano(padresIds)
      }
      setWizardStep(2)
    } else {
      handleSave()
    }
  }

  const handleHermanoSave = () => {
    // Guarda los padres seleccionados en sessionStorage para el flujo existente
    sessionStorage.setItem('hermano_padres', JSON.stringify(padresParaHermano))
    handleSave()
    setWizardStep(1)
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

  function getNodeLevel(nodeId: string, edges: any[], cache = {}): number {
    if (cache[nodeId] !== undefined) return cache[nodeId]
    const incoming = edges.filter(e => e.targets[0] === nodeId)
    if (incoming.length === 0) {
      cache[nodeId] = 0
      return 0
    }
    const parentLevels = incoming.map(e => getNodeLevel(e.sources[0], edges, cache))
    const level = Math.max(...parentLevels) + 1
    cache[nodeId] = level
    return level
  }

  const estilosBoton = {
    padding: '8px 16px',
    borderRadius: 4,
    border: '1px solid #0070f3',
    backgroundColor: 'white',
    color: '#0070f3',
    cursor: 'pointer',
    width: '100%',
    marginBottom: 10,
  }

  const estilosBotonPrincipal = {
    padding: '8px 16px',
    borderRadius: 4,
    border: 'none',
    backgroundColor: '#0070f3',
    color: 'white',
    cursor: 'pointer',
    width: '100%',
    marginBottom: 10,
  }

  // Colores para los niveles de los nodos
  const levelColors = ['#0070f3', '#36f', '#0ff', '#0f0', '#ff0', '#f00']

  return (
    <div style={{ width: '100%', height: '90vh', background: 'transparent', overflow: 'auto' }}>
      <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
        <button onClick={() => setOffset({ x: offset.x - 100, y: offset.y })}>← Izquierda</button>
        <button onClick={() => setOffset({ x: offset.x + 100, y: offset.y })}>Derecha →</button>
        <button onClick={() => setZoom(z => Math.min(3, z + 0.1))}>Zoom +</button>
        <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))}>Zoom -</button>
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
                {/* Renderiza las líneas (edges) */}
                {elkGraph.edges?.map((edge: any) => {
                  const sourceNode = elkGraph.children?.find((n: any) => n.id === edge.sources[0])
                  const targetNode = elkGraph.children?.find((n: any) => n.id === edge.targets[0])
                  if (!sourceNode || !targetNode || !sourceNode.x || !targetNode.x) return null

                  // Calcula el nivel del nodo destino
                  const level = getNodeLevel(edge.targets[0], elkGraph.edges)
                  const color = levelColors[level % levelColors.length]

                  const xSource = sourceNode.x + (sourceNode.width || 0) / 2
                  const ySource = sourceNode.y + (sourceNode.height || 0) / 2
                  const xTarget = targetNode.x + (targetNode.width || 0) / 2
                  const yTarget = targetNode.y + (targetNode.height || 0) / 2

                  return (
                    <g key={edge.id}>
                      <line
                        x1={xSource}
                        y1={ySource}
                        x2={xSource}
                        y2={yTarget}
                        stroke={color}
                        strokeWidth={2}
                      />
                      <line
                        x1={xSource}
                        y1={yTarget}
                        x2={xTarget}
                        y2={yTarget}
                        stroke={color}
                        strokeWidth={2}
                      />
                    </g>
                  )
                })}
                {elkGraph.children?.flatMap((node: any) => {
                  // OCULTAR los nodos de pareja en el renderizado
                  if (node.id.startsWith('pareja_')) return null;
                  if (node.id.startsWith('junction_')) return null;

                  // Renderizar solo personas reales
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

      {showForm && isAdmin ? (
        // Formulario para agregar/editar persona SOLO visible para admin
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'white',
          padding: 20,
          borderRadius: 8,
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
          zIndex: 1000,
          width: 400,
        }}>
          <h2 style={{ margin: 0, marginBottom: 10 }}>{editMode ? 'Editar Persona' : 'Agregar Persona'}</h2>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', marginBottom: 5 }}>Nombre:</label>
            <input
              type="text"
              value={formData.first_name}
              onChange={e => setFormData({ ...formData, first_name: e.target.value })}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', marginBottom: 5 }}>Apellido:</label>
            <input
              type="text"
              value={formData.last_name}
              onChange={e => setFormData({ ...formData, last_name: e.target.value })}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', marginBottom: 5 }}>Fecha de nacimiento:</label>
            <input
              type="date"
              value={formData.birth_date}
              onChange={e => setFormData({ ...formData, birth_date: e.target.value })}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', marginBottom: 5 }}>Lugar de nacimiento:</label>
            <input
              type="text"
              value={formData.birth_place}
              onChange={e => setFormData({ ...formData, birth_place: e.target.value })}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', marginBottom: 5 }}>Fecha de defunción:</label>
            <input
              type="date"
              value={formData.death_date}
              onChange={e => setFormData({ ...formData, death_date: e.target.value })}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', marginBottom: 5 }}>Lugar de fallecimiento:</label>
            <input
              type="text"
              value={formData.death_place || ''}
              onChange={e => setFormData({ ...formData, death_place: e.target.value })}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', marginBottom: 5 }}>Comentarios:</label>
            <textarea
              value={formData.notes || ''}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', minHeight: 60 }}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', marginBottom: 5 }}>Foto:</label>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <img
                src={formData.photo_url || defaultPhotoUrl}
                alt="Foto"
                style={{
                  width: '100%',
                  height: 'auto',
                  borderRadius: '8px',
                  objectFit: 'cover',
                  marginBottom: 10,
                }}
              />
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <button onClick={() => fileInputRef.current?.click()} style={{ ...estilosBoton }}>
                Cambiar foto
              </button>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', marginBottom: 5 }}>Tipo de relación:</label>
            <select
              value={tipoRelacion}
              onChange={e => setTipoRelacion(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="child">Hijo/a</option>
              <option value="parent">Padre/Madre</option>
              <option value="spouse">Pareja</option>
              <option value="hermano">Hermano/a</option>
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowForm(false)}
              style={{
                padding: '10px 20px',
                borderRadius: 4,
                border: '1px solid #ccc',
                backgroundColor: 'white',
                cursor: 'pointer',
                marginRight: 10,
              }}
            >
              Cancelar
            </button>
            {tipoRelacion === 'hermano' && wizardStep === 1 ? (
              <button
                onClick={handleNext}
                style={{
                  padding: '10px 20px',
                  borderRadius: 4,
                  border: 'none',
                  backgroundColor: '#0070f3',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                Siguiente
              </button>
            ) : tipoRelacion === 'hermano' && wizardStep === 2 ? (
              <button
                onClick={handleHermanoSave}
                style={{
                  padding: '10px 20px',
                  borderRadius: 4,
                  border: 'none',
                  backgroundColor: '#0070f3',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                Agregar persona
              </button>
            ) : (
              <button
                onClick={handleSave}
                style={{
                  padding: '10px 20px',
                  borderRadius: 4,
                  border: 'none',
                  backgroundColor: '#0070f3',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                {editMode ? 'Guardar cambios' : 'Agregar persona'}
              </button>
            )}
          </div>
          {/* Paso extra solo para hermanos */}
          {tipoRelacion === 'hermano' && wizardStep === 2 && (
            <div style={{ marginTop: 20 }}>
              <label style={{ display: 'block', marginBottom: 5 }}>
                Selecciona los padres que compartirá con {persona?.first_name}:
              </label>
              <div>
                {personasLista
                  .filter(p =>
                    relaciones.some(
                      r =>
                        r.relation_type === 'parent' &&
                        r.related_person_id === persona?.id &&
                        r.person_id === p.id
                    )
                  )
                  .map(p => (
                    <label key={p.id} style={{ display: 'block', marginBottom: 5 }}>
                      <input
                        type="checkbox"
                        checked={padresParaHermano.includes(p.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setPadresParaHermano([...padresParaHermano, p.id])
                          } else {
                            setPadresParaHermano(padresParaHermano.filter(id => id !== p.id))
                          }
                        }}
                      />
                      {p.first_name} {p.last_name}
                    </label>
                  ))}
              </div>
            </div>
          )}
        </div>
      ) : persona && (
        // Detalle de persona seleccionada
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'white',
          padding: 20,
          borderRadius: 8,
          boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
          zIndex: 1000,
          width: 400,
        }}>
          <img
            src={persona.photo_url || defaultPhotoUrl}
            alt="Foto"
            style={{
              width: '100%',
              height: 'auto',
              borderRadius: '8px',
              objectFit: 'cover',
              marginBottom: 10,
            }}
          />
          <h2 style={{ margin: 0, marginBottom: 10 }}>
            {persona.first_name} {persona.last_name}
          </h2>
          <div style={{ marginBottom: 10 }}>
            <strong>Fecha de nacimiento:</strong> {persona.birth_date || '—'}
          </div>
          <div style={{ marginBottom: 10 }}>
            <strong>Lugar de nacimiento:</strong> {persona.birth_place || '—'}
          </div>
          <div style={{ marginBottom: 10 }}>
            <strong>Fecha de defunción:</strong> {persona.death_date || '—'}
          </div>
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handlePhotoChange(file)
            }}
          />
          {isAdmin && (
            <>
              <button onClick={() => fileInputRef.current?.click()} style={{ marginBottom: 10 }}>
                Cambiar foto
              </button>
              <button onClick={() => { setShowForm(true); setEditMode(false); }} style={{ marginBottom: 10 }}>
                Añadir familiar
              </button>
              <button onClick={() => { setShowForm(true); setEditMode(true); setEditFormData(persona); }}>
                Editar
              </button>
            </>
          )}
          <button onClick={() => setPersona(null)} style={{ marginTop: 10 }}>
            Cerrar
          </button>
        </div>
      )}

      {/* Botón de contacto visible para todos */}
      <a
        href="mailto:tuemail@ejemplo.com?subject=Junio Tree - Nueva información"
        style={{
          display: 'block',
          margin: '24px auto',
          padding: '10px 20px',
          background: '#0070f3',
          color: 'white',
          borderRadius: 4,
          textDecoration: 'none',
          fontWeight: 'bold',
          textAlign: 'center',
          width: 260
        }}
      >
        ¿Quieres agregar información? Contáctanos
      </a>

      {/* Botón de Properties fijo */}
      <div style={{
        position: 'fixed',
        top: 16,
        right: 24,
        zIndex: 2000,
      }}>
        <a
          href="/login"
          style={{
            padding: '8px 16px',
            background: '#0070f3',
            color: 'white',
            borderRadius: 4,
            textDecoration: 'none',
            fontWeight: 'bold'
          }}
        >
          Properties
        </a>
      </div>
    </div>
  )
}
