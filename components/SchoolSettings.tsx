'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Location {
  id: string
  name: string
  lat: number
  lng: number
  radius_meters: number
}

const emptyForm = () => ({ name: '', lat: '', lng: '', radius: '150' })

export default function SchoolSettings() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        setLocations(d.locations ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function startEdit(loc: Location) {
    setEditingId(loc.id)
    setForm({ name: loc.name, lat: loc.lat.toString(), lng: loc.lng.toString(), radius: loc.radius_meters.toString() })
    setError('')
    setSuccess('')
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm())
    setError('')
  }

  async function detectLocation() {
    setDetecting(true)
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true })
      )
      setForm(f => ({ ...f, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }))
    } catch {
      setError('Could not get location. Enter coordinates manually.')
    }
    setDetecting(false)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    const body = {
      id: editingId ?? undefined,
      name: form.name,
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      radius_meters: parseInt(form.radius),
    }

    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
    } else {
      const saved: Location = data.location
      if (editingId) {
        setLocations(prev => prev.map(l => l.id === editingId ? saved : l))
      } else {
        setLocations(prev => [...prev, saved])
      }
      setSuccess(editingId ? 'Location updated!' : 'Location added!')
      setEditingId(null)
      setForm(emptyForm())
    }
    setSaving(false)
  }

  async function deleteLocation(id: string) {
    if (!confirm('Delete this location?')) return
    setDeleting(prev => ({ ...prev, [id]: true }))
    const res = await fetch('/api/settings', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setLocations(prev => prev.filter(l => l.id !== id))
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Could not delete location.')
    }
    setDeleting(prev => ({ ...prev, [id]: false }))
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">← Admin</Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">School Locations</h1>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Parents must be within the radius of <strong>any</strong> listed location to check in.
          Add multiple locations if you have more than one pickup zone.
        </p>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl px-4 py-3 mb-4 text-sm text-red-600 dark:text-red-400 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-4 text-red-400 hover:text-red-600">✕</button>
          </div>
        )}
        {success && (
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl px-4 py-3 mb-4 text-sm text-green-600 dark:text-green-400">
            {success}
          </div>
        )}

        {/* Existing locations */}
        {loading ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">Loading…</p>
        ) : locations.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-600 p-6 text-center text-gray-400 dark:text-gray-500 text-sm mb-6">
            No locations yet. Add one below.
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {locations.map(loc => (
              <div key={loc.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                {editingId === loc.id ? (
                  <form onSubmit={save} className="p-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Edit location</p>
                    <LocationFormFields form={form} setForm={setForm} detecting={detecting} onDetect={detectLocation} />
                    <div className="flex gap-2">
                      <button type="submit" disabled={saving}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold text-sm rounded-lg py-2 transition-colors">
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" onClick={cancelEdit}
                        className="px-4 text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="p-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{loc.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)} · {loc.radius_meters}m radius
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => startEdit(loc)}
                        className="text-xs text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded-lg px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                        Edit
                      </button>
                      <button onClick={() => deleteLocation(loc.id)} disabled={deleting[loc.id]}
                        className="text-xs text-red-500 dark:text-red-400 border border-red-200 dark:border-red-700 rounded-lg px-2.5 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40">
                        {deleting[loc.id] ? '…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add new location */}
        {!editingId && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Add a location</p>
            <form onSubmit={save} className="space-y-4">
              <LocationFormFields form={form} setForm={setForm} detecting={detecting} onDetect={detectLocation} />
              <button type="submit" disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg py-3 transition-colors">
                {saving ? 'Adding…' : 'Add Location'}
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  )
}

function LocationFormFields({
  form,
  setForm,
  detecting,
  onDetect,
}: {
  form: { name: string; lat: string; lng: string; radius: string }
  setForm: React.Dispatch<React.SetStateAction<{ name: string; lat: string; lng: string; radius: string }>>
  detecting: boolean
  onDetect: () => void
}) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location Name</label>
        <input
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          required
          placeholder="e.g. Main Entrance"
          className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Latitude</label>
          <input
            value={form.lat}
            onChange={e => setForm(f => ({ ...f, lat: e.target.value }))}
            required
            placeholder="e.g. 40.712776"
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Longitude</label>
          <input
            value={form.lng}
            onChange={e => setForm(f => ({ ...f, lng: e.target.value }))}
            required
            placeholder="e.g. -74.005974"
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onDetect}
        disabled={detecting}
        className="w-full border border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm font-medium rounded-lg py-2.5 transition-colors"
      >
        {detecting ? 'Detecting…' : '📍 Use my current location'}
      </button>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Pickup Radius (metres)
        </label>
        <input
          type="number"
          value={form.radius}
          onChange={e => setForm(f => ({ ...f, radius: e.target.value }))}
          required
          min={10}
          max={2000}
          className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">150m is recommended for most school car parks.</p>
      </div>
    </>
  )
}
