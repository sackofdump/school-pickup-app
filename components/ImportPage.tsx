'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import type { ImportRow, ImportResult } from '@/app/api/import/route'

type ParsedRow = ImportRow & { _valid: boolean; _errors: string[] }

const REQUIRED_HEADERS = ['student_name', 'grade', 'class_name', 'parent_name', 'parent_email']

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/)
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
  const rows = lines.slice(1).map(line => line.split(',').map(c => c.trim()))
  return { headers, rows }
}

function validateRows(headers: string[], rows: string[][]): ParsedRow[] {
  return rows.map(row => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = row[i] ?? '' })

    const errors: string[] = []
    if (!obj.student_name) errors.push('Missing student name')
    if (!obj.parent_email) errors.push('Missing parent email')
    if (obj.parent_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(obj.parent_email)) {
      errors.push('Invalid email')
    }

    return {
      student_name: obj.student_name ?? '',
      grade: obj.grade ?? '',
      class_name: obj.class_name ?? '',
      parent_name: obj.parent_name ?? '',
      parent_email: obj.parent_email ?? '',
      _valid: errors.length === 0,
      _errors: errors,
    }
  }).filter(r => r.student_name || r.parent_email) // skip blank rows
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ParsedRow[] | null>(null)
  const [missingHeaders, setMissingHeaders] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<ImportResult[] | null>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const { headers, rows } = parseCSV(text)

      const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h))
      if (missing.length) {
        setMissingHeaders(missing)
        setPreview(null)
        return
      }

      setMissingHeaders([])
      setPreview(validateRows(headers, rows))
    }
    reader.readAsText(file)
  }

  async function runImport() {
    if (!preview) return
    const validRows = preview.filter(r => r._valid)
    if (!validRows.length) return

    setImporting(true)
    setResults(null)

    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: validRows }),
    })

    const data = await res.json()
    setResults(data.results ?? [])
    setImporting(false)
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const validCount = preview?.filter(r => r._valid).length ?? 0
  const invalidCount = preview?.filter(r => !r._valid).length ?? 0

  const createdCount = results?.filter(r => r.status === 'created').length ?? 0
  const existingCount = results?.filter(r => r.status === 'existing').length ?? 0
  const errorCount = results?.filter(r => r.status === 'error').length ?? 0

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600">← Admin</Link>
          <h1 className="text-2xl font-bold text-gray-900">Bulk Import</h1>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
          <p className="font-semibold text-blue-800 mb-2">CSV format</p>
          <p className="text-blue-700 text-sm mb-3">
            Your spreadsheet must have these column headers (exact names, case-insensitive):
          </p>
          <code className="block bg-white border border-blue-200 rounded-lg px-4 py-3 text-sm text-gray-800 font-mono">
            student_name, grade, class_name, parent_name, parent_email
          </code>
          <p className="text-blue-600 text-xs mt-3">
            Multiple rows with the same student but different parents are supported.
            Existing accounts won't be duplicated. Parents will receive an invite email to set their password.
          </p>
        </div>

        {/* Download template */}
        <div className="mb-6">
          <a
            href="data:text/csv;charset=utf-8,student_name,grade,class_name,parent_name,parent_email%0AEmma Johnson,4,4B,Sarah Johnson,sarah%40example.com%0ALiam Smith,2,2A,Mike Smith,mike%40example.com"
            download="import-template.csv"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-4 py-2 bg-white hover:bg-blue-50 transition-colors"
          >
            ⬇ Download template CSV
          </a>
        </div>

        {/* File upload */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Upload CSV file
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFile}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium hover:file:bg-blue-100 cursor-pointer"
          />
        </div>

        {/* Missing headers error */}
        {missingHeaders.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="font-semibold text-red-700">Missing required columns:</p>
            <ul className="mt-1 text-red-600 text-sm list-disc list-inside">
              {missingHeaders.map(h => <li key={h}><code>{h}</code></li>)}
            </ul>
          </div>
        )}

        {/* Preview table */}
        {preview && preview.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">Preview — {preview.length} rows</p>
                <p className="text-sm text-gray-500">
                  <span className="text-green-600">{validCount} valid</span>
                  {invalidCount > 0 && <span className="text-red-500 ml-2">{invalidCount} with errors (will be skipped)</span>}
                </p>
              </div>
              <button
                onClick={runImport}
                disabled={importing || validCount === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold text-sm rounded-lg px-5 py-2.5 transition-colors"
              >
                {importing ? 'Importing…' : `Import ${validCount} rows`}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Student</th>
                    <th className="px-4 py-3 text-left">Grade</th>
                    <th className="px-4 py-3 text-left">Class</th>
                    <th className="px-4 py-3 text-left">Parent</th>
                    <th className="px-4 py-3 text-left">Parent Email</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.map((row, i) => (
                    <tr key={i} className={row._valid ? '' : 'bg-red-50'}>
                      <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{row.student_name}</td>
                      <td className="px-4 py-3 text-gray-600">{row.grade}</td>
                      <td className="px-4 py-3 text-gray-600">{row.class_name}</td>
                      <td className="px-4 py-3 text-gray-600">{row.parent_name}</td>
                      <td className="px-4 py-3 text-gray-600">{row.parent_email}</td>
                      <td className="px-4 py-3">
                        {row._valid ? (
                          <span className="text-green-600 text-xs">✓ Ready</span>
                        ) : (
                          <span className="text-red-500 text-xs">{row._errors.join(', ')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="font-semibold text-gray-800">Import complete</p>
              <div className="flex gap-4 mt-1 text-sm">
                {createdCount > 0 && <span className="text-green-600">✓ {createdCount} invited</span>}
                {existingCount > 0 && <span className="text-blue-600">↩ {existingCount} already existed</span>}
                {errorCount > 0 && <span className="text-red-500">✗ {errorCount} errors</span>}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Student</th>
                    <th className="px-4 py-3 text-left">Parent Email</th>
                    <th className="px-4 py-3 text-left">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {results.map((r, i) => (
                    <tr key={i} className={r.status === 'error' ? 'bg-red-50' : ''}>
                      <td className="px-4 py-3 text-gray-400">{r.row}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{r.student_name}</td>
                      <td className="px-4 py-3 text-gray-600">{r.parent_email}</td>
                      <td className="px-4 py-3">
                        {r.status === 'created' && <span className="text-green-600 text-xs">✓ {r.detail}</span>}
                        {r.status === 'existing' && <span className="text-blue-600 text-xs">↩ {r.detail}</span>}
                        {r.status === 'error' && <span className="text-red-500 text-xs">✗ {r.detail}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
