import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ParentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/login')

  const { data: parents } = await supabase
    .from('profiles')
    .select('id, full_name, email, created_at, parent_students(student_id, students(full_name, grade, class_name))')
    .eq('role', 'parent')
    .order('full_name')

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600">← Admin</Link>
          <h1 className="text-2xl font-bold text-gray-900">Parents</h1>
          <span className="bg-green-100 text-green-700 text-sm font-medium px-2.5 py-0.5 rounded-full">
            {parents?.length ?? 0}
          </span>
        </div>

        <div className="space-y-3">
          {parents?.map(parent => {
            const children = (parent.parent_students ?? [])
              .map((ps: any) => ps.students)
              .filter(Boolean)

            return (
              <div key={parent.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{parent.full_name || '—'}</p>
                    <p className="text-sm text-gray-500">{parent.email}</p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(parent.created_at).toLocaleDateString()}
                  </span>
                </div>

                {children.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {children.map((c: any, i: number) => (
                      <span key={i} className="bg-blue-50 text-blue-700 text-xs rounded-full px-3 py-1">
                        {c.full_name}
                        {c.grade && ` · Grade ${c.grade}`}
                        {c.class_name && ` · ${c.class_name}`}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mt-2 italic">No children linked</p>
                )}
              </div>
            )
          })}

          {(!parents || parents.length === 0) && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-3xl mb-2">👨‍👩‍👧</p>
              <p>No parent accounts yet.</p>
              <Link href="/admin/import" className="text-blue-500 text-sm mt-1 inline-block hover:underline">
                Import from CSV
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
