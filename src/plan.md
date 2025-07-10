# Plan de Trabajo Plataforma Genealógica

## 1. Modelo de Datos y Base de Datos
- [ ] Definir y crear la tabla `persons` en Supabase.
- [ ] Definir y crear la tabla `relationships` en Supabase.
- [ ] Usar UUID para los IDs.
- [ ] Definir nomenclatura única para nodos de pareja (`getPairId`).

## 2. Carga y Lógica del Grafo
- [ ] Cargar personas y relaciones desde Supabase.
- [ ] Crear nodos de persona y nodos virtuales de pareja.
- [ ] Crear edges de padres/hijos y edges de pareja correctamente.
- [ ] Evitar duplicados y relaciones cruzadas.
- [ ] Guardar todo en el estado para renderizado.

## 3. Layout y Visualización
- [ ] Configurar ELK con opciones óptimas (`layered`, `DOWN`, spacing, etc.).
- [ ] Renderizar solo nodos de persona (no mostrar nodos de pareja).
- [ ] Renderizar edges sólidos para padres/hijos y punteados para parejas.
- [ ] Ajustar zoom, pan y centrado automático.

## 4. Edición y Formularios
- [ ] Permitir editar datos de persona (nombre, fechas, foto).
- [ ] Permitir subir foto y actualizar en Supabase.
- [ ] Recargar datos y actualizar el grafo tras editar.

## 5. Validación y Consistencia
- [ ] Validar que no haya relaciones duplicadas.
- [ ] Validar que los hijos estén correctamente conectados a ambos padres si existe pareja.
- [ ] Validar que las generaciones estén alineadas visualmente.

## 6. Pruebas y Ajustes Visuales
- [ ] Probar con datos reales y familias grandes.
- [ ] Ajustar spacing y layout según feedback visual.
- [ ] Revisar que no haya líneas cruzadas ni nodos fuera de lugar.

## 7. Escalabilidad y Futuro
- [ ] Soporte para nuevos tipos de relación (adopción, hermanos, etc.).
- [ ] Permitir centrar el árbol en cualquier persona.
- [ ] Optimizar para grandes volúmenes de datos.