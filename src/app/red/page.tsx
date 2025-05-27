'use client'

import { useEffect, useState } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import { supabase } from '@/lib/supabase'

export default function RedGenealogica() {
  const [elements, setElements] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      const dagobertoId = 'c8f178ec-4ddc-4041-8a2c-29d1307e9a70'
      const ameliaId = '4df36fe2-7cc7-45d6-b9b7-6e1563a3aecc'

      const { data: dagoberto } = await supabase
        .from('persons')
        .select('*')
        .eq('id', dagobertoId)
        .single()

      if (!dagoberto) return

      const { data: relacionesDagoberto } = await supabase
        .from('relationships')
        .select('*, related_person:related_person_id(*)')
        .eq('person_id', dagobertoId)

      const { data: relacionesAmelia } = await supabase
        .from('relationships')
        .select('*, related_person:related_person_id(*)')
        .eq('person_id', ameliaId)

      const nodos = new Map()
      nodos.set(dagoberto.id, {
        data: { id: dagoberto.id, label: dagoberto.first_name + ' ' + dagoberto.last_name }
      })

      relacionesDagoberto.forEach(r => {
        if (!nodos.has(r.related_person.id)) {
          nodos.set(r.related_person.id, {
            data: {
              id: r.related_person.id,
              label: r.related_person.first_name + ' ' + r.related_person.last_name
            }
          })
        }
      })

      relacionesAmelia.forEach(r => {
        if (!nodos.has(r.related_person.id)) {
          nodos.set(r.related_person.id, {
            data: {
              id: r.related_person.id,
              label: r.related_person.first_name + ' ' + r.related_person.last_name
            }
          })
        }
      })

      const edges = []

      relacionesDagoberto.forEach(r => {
        edges.push({
          data: {
            id: `${dagoberto.id}-${r.related_person.id}`,
            source: dagoberto.id,
            target: r.related_person.id
          }
        })
      })

      relacionesAmelia.forEach(r => {
        if (!edges.some(e => e.data.target === r.related_person.id)) {
          edges.push({
            data: {
              id: `${ameliaId}-${r.related_person.id}`,
              source: ameliaId,
              target: r.related_person.id
            }
          })
        }
      })

      setElements([...nodos.values(), ...edges])
    }

    fetchData()
  }, [])

  const layout = { name: 'cose' }

  return (
    <div style={{ width: '100%', height: '90vh' }}>
      <CytoscapeComponent
        elements={elements}
        layout={layout}
        style={{ width: '100%', height: '100%' }}
        stylesheet={[
          {
            selector: 'node',
            style: {
              label: 'data(label)',
              'background-color': '#cc0000',
              color: '#000',
              'text-valign': 'center',
              'text-halign': 'center',
              'font-weight': 'bold',
              'font-size': '10px',
              'text-wrap': 'wrap',
              'border-width': 2,
              'border-color': '#000',
              'shape': 'ellipse',
              'padding': 10,
            }
          },
          {
            selector: 'edge',
            style: {
              width: 2,
              'line-color': '#999'
            }
          }
        ]}
        cy={(cy) => {
          cy.on('tap', 'node', (evt) => {
            const nodeId = evt.target.id()
            window.location.href = `/personas/${nodeId}`
          })
        }}
      />
    </div>
  )
}