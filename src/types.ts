export interface Staff {
  id: string;
  name: string;
  email: string;
  status: 'pending' | 'approved';
  role: 'admin' | 'staff';
  photoURL?: string;
  createdAt: number;
}

export interface BrandingSettings {
  logoUrl?: string;
  platformName?: string;
  tagline?: string;
  updatedAt?: number;
}

export interface Student {
  id: string;
  instituteId: 'SevenAI';
  name: string;
  age?: number | string;
  email: string;
  phone: string;
  course: string;
  batch: string; // Will hold the Batch identifier
  schoolClass?: string;
  schoolName?: string;
  fatherName?: string;
  address?: string;
  image?: string;
  status?: 'active' | 'completed' | 'dropped'; // New field for course status
  createdByStaffId: string;
  createdByStaffName: string;
  startDate?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AttendanceRecord {
  id: string;
  instituteId: 'SevenAI';
  date: string; // YYYY-MM-DD format
  timestamp: number;
  presentStudents: string[]; // array of student IDs
  isNoClass?: boolean;
  batch?: string | null;
  staffId: string;
  staffName: string;
  note?: string; // Taught topic
}

export interface Transaction {
  id: string;
  instituteId: 'SevenAI';
  studentId: string;
  amount: number;
  date: string;
  monthForFee: string;
  paymentMethod: 'cash' | 'online';
  collectedBy?: string; // Optional: Harsimran Singh, Nikhil, Nishant
  staffId: string;
  staffName: string;
  createdAt: number;
}

export interface Expense {
  id: string;
  instituteId: 'SevenAI';
  title: string;
  amount: number;
  date: string; // ISO date or yyyy-MM-dd
  category: string;
  paidBy?: string;
  staffId: string;
  staffName: string;
  createdAt: number;
}

export interface Batch {
  id: string;
  instituteId: 'SevenAI';
  identifier: string; // e.g. "Web-Ai-Mon-01"
  course: string;
  startDate: string;
  timing: string;
  teacher: string;
  createdAt: number;
}

export interface OfficeEarning {
  id: string;
  instituteId: 'SevenAI';
  title: string;
  amount: number;
  date: string; // ISO date or yyyy-MM-dd
  collectedBy: string;
  paymentMethod: 'cash' | 'online';
  staffId: string;
  staffName: string;
  createdAt: number;
}

export interface FollowUpRecord {
  id: string;
  date: string; // YYYY-MM-DD or formatted string
  notes: string;
  countNumber: number; // 1 to 5
  stage: string; // 'First 2 Weeks' | 'Late Month Batch Update'
  createdAt: number;
  by?: string;
}

export interface Lead {
  id: string;
  instituteId: 'SevenAI';
  name?: string;
  email?: string;
  work?: string;
  studyClass?: string;
  institution?: string; // College or School name
  mobile: string;
  address?: string;
  courseInterest?: string;
  status?: string; // 'Intersted', 'Not Intersted', 'Follow up', 'Demo Pending', 'Demo Completed', 'Admission Follow Up', 'Cancelled', 'Sucess'
  handleBy?: string; // Jagdeep Kaur, Nishant Mittal, Nikhil Mittal, Harsimran Singh, Telecaler
  source?: string; // advertisement, Instagram, refferal, word of mouth, Crosing in front of institute
  followUps?: FollowUpRecord[];
  followUpCount?: number;
  nextFollowUpDate?: string;
  createdAt: number;
  updatedAt?: number;
}
