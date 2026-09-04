import React from "react";
import Graph from "./components/Graph";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Product Planr</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Settings"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <span aria-hidden="true">&#9881;</span>
          </button>
          <button
            type="button"
            aria-label="Profile"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100"
          >
            <span aria-hidden="true" className="profile-placeholder" />
          </button>
        </div>
      </header>

      <main className="p-6">
        <Graph />
      </main>
    </div>
  );
}
