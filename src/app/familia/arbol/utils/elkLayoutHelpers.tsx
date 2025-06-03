export function getDefaultElkLayoutOptions() {
  return {
    'elk.algorithm': 'layered',
    'elk.direction': 'DOWN',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF', // Mejora la alineación de hijos bajo la pareja
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP', // Reduce cruces y mejora disposición
    'elk.layered.layering.strategy': 'LONGEST_PATH',
    'elk.layered.nodePlacement.bk.fixedAlignment': 'CENTER',
    'elk.layered.nodePlacement.bk.edgeStraightening': 'IMPROVE_STRAIGHTNESS',
    'elk.layered.spacing.edgeNodeBetweenLayers': '80',
    'elk.layered.spacing.nodeNodeBetweenLayers': '100',
    'elk.spacing.nodeNode': '100', // Más espacio horizontal entre nodos
    'elk.spacing.edgeNode': '60',
    'elk.spacing.edgeEdge': '40',
    'elk.layered.considerModelOrder': 'true',
    'elk.layered.crossingMinimization.semiInteractive': 'true'
  }
}