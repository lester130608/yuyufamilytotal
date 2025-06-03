/**
 * Genera un layoutOptions estándar para ELK con orientación vertical (DOWN),
 * conectores ortogonales y separación entre generaciones.
 */
export function getDefaultElkLayoutOptions() {
  return {
    'elk.algorithm': 'layered',
    'elk.direction': 'DOWN',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.layered.nodePlacement.bk.edgeStraightening': 'IMPROVE_STRAIGHTNESS',
    'elk.layered.crossingMinimization.semiInteractive': 'true',
    'elk.layered.considerModelOrder': 'true',
    'elk.layered.layering.strategy': 'LONGEST_PATH',
    'elk.layered.nodePlacement.strategy': 'SIMPLE',
    'elk.layered.spacing.edgeNodeBetweenLayers': '80',
    'elk.layered.spacing.nodeNodeBetweenLayers': '100',
    'elk.spacing.nodeNode': '60',
    'elk.spacing.edgeNode': '50',
    'elk.spacing.edgeEdge': '30',
  }
}

/**
 * Crea un nodo intermedio de pareja con ID único
 */
export function createPairNode(key: string) {
  return {
    id: `pareja_${key}`,
    labels: [{ text: '' }],
    width: 40,
    height: 20,
    layoutOptions: {
      'elk.layered.layerConstraint': 'INTERACTIVE',
    },
  }
}

/**
 * Añade edges entre dos personas y un nodo de pareja intermedio.
 */
export function addSpouseEdges(personId1: string, personId2: string, parejaId: string, edges: any[], edgeIds: Set<string>) {
  const e1 = `edge_${personId1}_to_${parejaId}`
  const e2 = `edge_${personId2}_to_${parejaId}`
  if (!edgeIds.has(e1)) {
    edges.push({ id: e1, sources: [personId1], targets: [parejaId] })
    edgeIds.add(e1)
  }
  if (!edgeIds.has(e2)) {
    edges.push({ id: e2, sources: [personId2], targets: [parejaId] })
    edgeIds.add(e2)
  }
}

/**
 * Añade edge desde el nodo pareja a su hijo. Si no hay pareja, conecta directamente.
 */
export function addParentChildEdge(
  padresIds: string[],
  childId: string,
  nodes: any[],
  edges: any[],
  edgeIds: Set<string>
) {
  const sorted = [...padresIds].sort()
  if (sorted.length === 2) {
    const parejaKey = sorted.join('_')
    const parejaId = `pareja_${parejaKey}`
    if (nodes.some(n => n.id === parejaId)) {
      const edgeId = `edge_${parejaId}_to_${childId}`
      if (!edgeIds.has(edgeId)) {
        edges.push({ id: edgeId, sources: [parejaId], targets: [childId] })
        edgeIds.add(edgeId)
      }
      return
    }
  }
  // Sin pareja → edge directo
  sorted.forEach(parentId => {
    const edgeId = `edge_${parentId}_to_${childId}`
    if (!edgeIds.has(edgeId)) {
      edges.push({ id: edgeId, sources: [parentId], targets: [childId] })
      edgeIds.add(edgeId)
    }
  })
}