import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchoolId } from '@/lib/active-school'
import Link from 'next/link'
import ResetQueueButton from '@/components/ResetQueueButton'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/login')

  const schoolId = await getActiveSchoolId()

  const [{ count: studentCount }, { count: parentCount }, { count: pendingCount }] = await Promise.all([
    schoolId
      ? supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', schoolId)
      : { count: 0 },
    schoolId
      ? supabase.from('profiles').select('*, parent_students!inner(students!inner(school_id))', { count: 'exact', head: true }).eq('role', 'parent').eq('parent_students.students.school_id', schoolId)
      : { count: 0 },
    schoolId
      ? supabase.from('pending_student_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('school_id', schoolId)
      : { count: 0 },
  ])

  if (!schoolId) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="flex justify-center mb-4"><img src="/logo.png" alt="PickMeUp Kids" className="h-16 object-contain" /></div>
          <p className="text-xl font-bold text-gray-800 dark:text-white mb-2">No school selected</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Use the school switcher above to create or select a school.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Welcome, {profile.full_name}</p>
          </div>
          <LogoutButton />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <Link href="/admin/students" className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
            <p className="text-3xl font-bold text-blue-600">{studentCount ?? 0}</p>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Students</p>
          </Link>
          <Link href="/admin/parents" className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-600 transition-colors">
            <p className="text-3xl font-bold text-green-600">{parentCount ?? 0}</p>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Parents</p>
          </Link>
        </div>

        <div className="grid gap-4">
          <Link href="/admin/students" className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl">👦</span>
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100">Manage Students</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Add students and link parents</p>
              </div>
            </div>
            <span className="text-gray-400 dark:text-gray-500">›</span>
          </Link>

          <Link href="/admin/parents" className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between hover:border-green-300 dark:hover:border-green-600 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl">👨‍👩‍👧</span>
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100">Manage Parents</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Add parents and link them to students</p>
              </div>
            </div>
            <span className="text-gray-400 dark:text-gray-500">›</span>
          </Link>

          <Link href="/admin/pending-requests" className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between hover:border-purple-300 dark:hover:border-purple-600 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔗</span>
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100">Pending Link Requests</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Parents waiting for a student to be confirmed</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(pendingCount ?? 0) > 0 && (
                <span className="bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingCount}</span>
              )}
              <span className="text-gray-400 dark:text-gray-500">›</span>
            </div>
          </Link>

          <Link href="/admin/teachers" className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl">👩‍🏫</span>
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100">Manage Teachers</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm">View teacher accounts and school assignments</p>
              </div>
            </div>
            <span className="text-gray-400 dark:text-gray-500">›</span>
          </Link>

          <Link href="/admin/absences" className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between hover:border-orange-300 dark:hover:border-orange-600 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🤒</span>
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100">Absent Today</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Mark students as sick or absent</p>
              </div>
            </div>
            <span className="text-gray-400 dark:text-gray-500">›</span>
          </Link>

          <Link href="/admin/import" className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📥</span>
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100">Bulk Import</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Import students and parents from a CSV</p>
              </div>
            </div>
            <span className="text-gray-400 dark:text-gray-500">›</span>
          </Link>

          <Link href="/admin/settings" className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📍</span>
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100">School Locations</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Manage pickup zones and GPS radii</p>
              </div>
            </div>
            <span className="text-gray-400 dark:text-gray-500">›</span>
          </Link>

          <ResetQueueButton />
        </div>
      </div>
    </main>
  )
}

function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="POST">
      <button type="submit" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2">
        Sign out
      </button>
    </form>
  )
}
