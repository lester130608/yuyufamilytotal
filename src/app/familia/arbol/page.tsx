'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'

// Importar react-d3-tree dinámicamente (para que no rompa SSR)
const Tree = dynamic(() => import('react-d3-tree').then(mod => mod.Tree), { ssr: false })

const sampleData = {
  name: 'Perfeto Ramón Martel',
  children: [
    {
      name: 'Olga Cristina Martel',
      children: [
        { name: 'Amelia Mercedes Morales' },
        { name: 'Carlos Jesús Morales' },
      ],
    },
    {
      name: 'José Ignacio Martel',
      children: [
        { name: 'Alba Aurora Martel' },
        { name: 'Agnerys María Martel' },
      ],
    },
  ],
}

export default function ArbolGenealogicoPage() {
  const [translate, setTranslate] = useState({ x: 0, y: 0 })

  return (
    <div style={{ width: '100%', height: '90vh' }}>
      <Tree
        data={sampleData}
        orientation="vertical"
        translate={translate}
        zoomable
        collapsible
        pathFunc="elbow"
        onNodeClick={(node) => alert(`Clic en: ${node.name}`)}
      />
    </div>
  )
}