'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { SchoolSettings as SchoolSettingsType } from '@/types'

interface Props {
  settings: SchoolSettingsType | null
}

export default function SchoolSettings({ settings }: Props) {
  const [name, setName] = useState(settings?.name ?? '')
  const [lat, setLat] = useState(settings?.lat?.toString() ?? '')
  const [lng, setLng] = useState(settings?.lng?.toString() ?? '')
  const [radius, setRadius] = useState(settings?.radius_meters?.toString() ?? '150')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [detecting, setDetecting] = useState(false)

  async function detectLocation() {
    setDetecting(true)
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true })
      )
      setLat(pos.coords.latitude.toFixed(6))
      setLng(pos.coords.longitude.toFixed(6))
    } catch {
      setError('Could not get location. Enter coordinates manually.')
    }
    setDetecting(false)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess(false)

    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        radius_meters: parseInt(radius),
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
    } else {
      setSuccess(true)
    }
    setSaving(false)
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600">← Admin</Link>
          <h1 className="text-2xl font-bold text-gray-900">School Location</h1>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-5">
            Set the school's GPS coordinates and pickup radius. Parents must be within this
            radius to check in.
          </p>

          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="e.g. Lincoln Elementary"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                <input
                  value={lat}
                  onChange={e => setLat(e.target.value)}
                  required
                  placeholder="e.g. 40.712776"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                <input
                  value={lng}
                  onChange={e => setLng(e.target.value)}
                  required
                  placeholder="e.g. -74.005974"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={detectLocation}
              disabled={detecting}
              className="w-full border border-blue-300 text-blue-600 hover:bg-blue-50 text-sm font-medium rounded-lg py-2.5 transition-colors"
            >
              {detecting ? 'Detecting…' : '📍 Use my current location'}
            </button>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pickup Radius (metres)
              </label>
              <input
                type="number"
                value={radius}
                onChange={e => setRadius(e.target.value)}
                required
                min={10}
                max={2000}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <p className="text-xs text-gray-400 mt-1">
                150m is recommended for most school carparks.
              </p>
            </div>

            {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            {success && <p className="text-green-600 text-sm bg-green-50 rounded-lg px-3 py-2">Settings saved!</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg py-3 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
