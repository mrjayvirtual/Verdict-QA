-- Verdict QA Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Test Cases table
CREATE TABLE IF NOT EXISTS test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  preconditions TEXT,
  steps TEXT,
  expected_result TEXT,
  priority VARCHAR(50) DEFAULT 'medium',
  status VARCHAR(50) DEFAULT 'draft',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Test Executions table
CREATE TABLE IF NOT EXISTS test_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id UUID NOT NULL REFERENCES test_cases(id),
  executed_by UUID NOT NULL REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending',
  result VARCHAR(50),
  notes TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bugs table
CREATE TABLE IF NOT EXISTS bugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(50) DEFAULT 'medium',
  status VARCHAR(50) DEFAULT 'open',
  reported_by UUID NOT NULL REFERENCES users(id),
  assigned_to UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_test_cases_project ON test_cases(project_id);
CREATE INDEX idx_test_executions_test_case ON test_executions(test_case_id);
CREATE INDEX idx_bugs_project ON bugs(project_id);
CREATE INDEX idx_bugs_assigned_to ON bugs(assigned_to);
