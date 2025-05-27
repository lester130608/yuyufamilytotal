'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function TestPage() {
  const [people, setPeople] = useState<any[]>([])

  useEffect(() => {
    const fetchPeople = async () => {
      const { data, error } = await supabase.from('persons').select('*')
      if (error) {
        console.error('Error:', error.message)
      } else {
        setPeople(data)
      }
    }
    fetchPeople()
  }, [])

  return (
    <main>
      <h1>Personas registradas</h1>
      <ul>
        {people.map((p) => (
          <li key={p.id}>
            {p.first_name} {p.last_name} ({p.birth_date || 'sin fecha'})
          </li>
        ))}
      </ul>
    </main>
  )
}