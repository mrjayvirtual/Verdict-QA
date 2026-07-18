// User types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin' | 'manager';
  createdAt: Date;
  updatedAt: Date;
}

// Project types
export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Test case types
export interface TestCase {
  id: string;
  projectId: string;
  title: string;
  description: string;
  preconditions: string;
  steps: string;
  expectedResult: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'draft' | 'active' | 'deprecated';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Test execution types
export interface TestExecution {
  id: string;
  testCaseId: string;
  executedBy: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result: 'pass' | 'fail' | 'blocked' | 'skip';
  notes: string;
  startedAt: Date;
  completedAt: Date;
  createdAt: Date;
}

// Bug types
export interface Bug {
  id: string;
  projectId: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'assigned' | 'fixed' | 'closed';
  reportedBy: string;
  assignedTo: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
