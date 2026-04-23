# School Pickup App

A web app that replaces the walkie-talkie pickup process. Parents tap "I'm Here" when they arrive, and teachers see a live queue on a dashboard screen.

## How it works

1. **Parent** opens the app on their phone, sees their child's name, taps **"I'm Here! 👋"**
2. The app verifies their GPS location (must be within the school's pickup radius)
3. The parent appears instantly on the **teacher's live queue dashboard**
4. The teacher taps **"Picked Up ✓"** — the entry disappears from the queue

## Tech stack

- **Next.js 14** (App Router, TypeScript)
- **Supabase** (Postgres + Auth + Realtime)
- **Tailwind CSS**
- Browser **Geolocation API**

---

## Setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a new project, then:

- Open **SQL Editor** and paste the entire contents of `supabase/schema.sql`
- Run it — this creates all tables, RLS policies, and enables Realtime

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in your values from Supabase → Project Settings → API:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

### 3. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Creating accounts

User accounts are created via **Supabase Auth**. To create the first admin:

1. Go to Supabase → **Authentication → Users → Add user**
2. Set email + password
3. Then in **SQL Editor**, set their role:

```sql
update public.profiles
set role = 'admin', full_name = 'Your Name'
where email = 'admin@yourschool.com';
```

Repeat for teachers (`role = 'teacher'`) and parents (`role = 'parent'`).

---

## Admin setup checklist

- [ ] Run `supabase/schema.sql` in SQL Editor
- [ ] Set environment variables
- [ ] Create admin account (see above)
- [ ] Sign in as admin → **School Location** → set GPS coordinates + radius
- [ ] **Manage Students** → add students
- [ ] Create parent accounts → link them to their children
- [ ] Create teacher accounts

---

## Roles

| Role | Access |
|------|--------|
| `parent` | See linked children, check in with location |
| `teacher` | Live pickup queue dashboard, mark as picked up |
| `admin` | Everything + manage students/parents/settings |

---

## Migrating to React Native later

All API calls, Supabase queries, and business logic stay identical. You would:

- Replace HTML elements (`<div>`, `<button>`) with RN equivalents (`<View>`, `<Pressable>`)
- Replace Tailwind with `StyleSheet` or NativeWind
- Replace `navigator.geolocation` with `expo-location`
- Replace `next/navigation` with React Navigation

---

## Project structure

```
app/
  page.tsx              → redirects to role-based home
  login/page.tsx        → sign in
  parent/page.tsx       → parent home
  teacher/page.tsx      → teacher dashboard
  admin/
    page.tsx            → admin overview
    students/page.tsx   → manage students + parent links
    settings/page.tsx   → school GPS settings
  api/
    auth/logout/        → sign out
    checkin/            → parent check-in with location verify
    queue/[id]/         → mark child as picked up
    students/           → add/delete students
    students/link/      → link/unlink parent <-> student
    settings/           → save school location
components/
  ParentHome.tsx        → "I'm Here" button + status cards
  TeacherDashboard.tsx  → realtime queue with Supabase subscriptions
  StudentsManager.tsx   → admin student + parent link management
  SchoolSettings.tsx    → GPS coordinate form
lib/
  supabase/client.ts    → browser Supabase client
  supabase/server.ts    → server Supabase client
  location.ts           → Haversine distance + geolocation helper
types/index.ts          → shared TypeScript types
middleware.ts           → auth guard + role-based redirects
supabase/schema.sql     → full DB schema with RLS policies
```
