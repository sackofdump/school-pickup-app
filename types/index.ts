export type Role = 'parent' | 'teacher' | 'admin'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: Role
  created_at: string
}

export interface Student {
  id: string
  full_name: string
  grade: string
  class_name: string
  created_at: string
}

export interface ParentStudent {
  parent_id: string
  student_id: string
  student?: Student
}

export interface PickupQueueEntry {
  id: string
  student_id: string
  parent_id: string
  arrived_at: string
  status: 'waiting' | 'picked_up'
  location_verified: boolean
  student?: Student
  parent?: Profile
}

export interface SchoolSettings {
  id: string
  name: string
  lat: number
  lng: number
  radius_meters: number
  updated_at: string
}
