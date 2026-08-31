import React from 'react'
import Graph from './components/Graph'

export default function App(){
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Product Planr — Graph (in-memory)</h1>
      </header>

      <main>
        <Graph />
      </main>
    </div>
  )
}
