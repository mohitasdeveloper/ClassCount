-- Run these in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Classes table (CR manages their class)
CREATE TABLE classes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  department VARCHAR(100) NOT NULL,
  semester INT NOT NULL,
  section VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- CR Profiles (linked to Supabase Auth)
CREATE TABLE cr_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  roll_number VARCHAR(50) UNIQUE NOT NULL,
  class_id UUID REFERENCES classes(id),
  email VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Students table
CREATE TABLE students (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  roll_number VARCHAR(50) NOT NULL,
  class_id UUID REFERENCES classes(id) NOT NULL,
  email VARCHAR(150),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(roll_number, class_id)
);

-- Subjects table
CREATE TABLE subjects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL,
  class_id UUID REFERENCES classes(id) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Attendance Sessions
CREATE TABLE attendance_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  class_id UUID REFERENCES classes(id) NOT NULL,
  subject_id UUID REFERENCES subjects(id) NOT NULL,
  cr_id UUID REFERENCES cr_profiles(id) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  lecture_number INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Attendance Records
CREATE TABLE attendance_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES attendance_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) NOT NULL,
  status VARCHAR(10) CHECK (status IN ('present', 'absent', 'late')) DEFAULT 'absent',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);

-- Row Level Security
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cr_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "CR can view their class" ON classes
  FOR SELECT USING (
    id IN (SELECT class_id FROM cr_profiles WHERE id = auth.uid())
  );

CREATE POLICY "CR can manage their students" ON students
  FOR ALL USING (
    class_id IN (SELECT class_id FROM cr_profiles WHERE id = auth.uid())
  );

CREATE POLICY "CR can manage their subjects" ON subjects
  FOR ALL USING (
    class_id IN (SELECT class_id FROM cr_profiles WHERE id = auth.uid())
  );

CREATE POLICY "CR can manage attendance sessions" ON attendance_sessions
  FOR ALL USING (cr_id = auth.uid());

CREATE POLICY "CR can manage attendance records" ON attendance_records
  FOR ALL USING (
    session_id IN (SELECT id FROM attendance_sessions WHERE cr_id = auth.uid())
  );

CREATE POLICY "CR can view/update own profile" ON cr_profiles
  FOR ALL USING (id = auth.uid());
