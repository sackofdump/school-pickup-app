import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function TeachersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/login')

  const { data: teachers } = await supabase
    .from('profiles')
    .select('id, full_name, email, school_id, schools:school_id(name)')
    .eq('role', 'teacher')
    .order('full_name')

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">← Admin</Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Teachers</h1>
          <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm font-medium px-2.5 py-0.5 rounded-full">
            {teachers?.length ?? 0}
          </span>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-4 mb-6 text-sm text-blue-800 dark:text-blue-300">
          Teachers are managed in Supabase. In the <code className="font-mono bg-blue-100 dark:bg-blue-800 px-1 rounded">profiles</code> table, set <code className="font-mono bg-blue-100 dark:bg-blue-800 px-1 rounded">role = teacher</code> and optionally set <code className="font-mono bg-blue-100 dark:bg-blue-800 px-1 rounded">school_id</code> to limit their view to one school.
        </div>

        <div className="space-y-3">
          {(teachers ?? []).map(teacher => (
            <div key={teacher.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{teacher.full_name || '—'}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{teacher.email}</p>
              </div>
              <div>
                {(teacher.schools as any)?.name ? (
                  <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full">
                    {(teacher.schools as any).name}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 dark:text-gray-500 italic">No school assigned</span>
                )}
              </div>
            </div>
          ))}

          {(teachers?.length ?? 0) === 0 && (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
              <p className="text-3xl mb-2">👩‍🏫</p>
              <p>No teachers yet. Set a user's role to <code className="font-mono">"teacher"</code> in Supabase.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
