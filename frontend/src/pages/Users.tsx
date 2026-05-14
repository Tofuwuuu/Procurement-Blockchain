import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, Row, Col, Card, Table, Button, Badge, 
  Form, Modal, InputGroup 
} from 'react-bootstrap';
import { apiService, User } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';

interface UserFormData {
  username: string;
  password: string;
  full_name: string;
  position: string;
  department: string;
  role: string;
}

// Mock data for demonstration
const mockUsers: User[] = [
  {
    id: 1,
    username: "admin",
    full_name: "System Administrator",
    position: "System Administrator",
    department: "IT Department",
    role: "admin",
    is_admin: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z"
  },
  {
    id: 2,
    username: "procurement0",
    full_name: "Juan Dela Cruz",
    position: "Procurement Officer",
    department: "Procurement Department",
    role: "procurement",
    is_admin: false,
    created_at: "2025-08-15T10:30:00Z",
    updated_at: "2025-08-15T10:30:00Z"
  },
  {
    id: 3,
    username: "procurement1",
    full_name: "Maria Santos",
    position: "Senior Procurement Officer",
    department: "Procurement Department",
    role: "procurement",
    is_admin: false,
    created_at: "2025-08-14T14:20:00Z",
    updated_at: "2025-08-14T14:20:00Z"
  },
  {
    id: 4,
    username: "procurement2",
    full_name: "Pedro Martinez",
    position: "Procurement Specialist",
    department: "Procurement Department",
    role: "procurement",
    is_admin: false,
    created_at: "2025-08-13T09:15:00Z",
    updated_at: "2025-08-13T09:15:00Z"
  },
  {
    id: 5,
    username: "validator1",
    full_name: "Ana Reyes",
    position: "Validation Officer",
    department: "Quality Assurance",
    role: "validator",
    is_admin: false,
    created_at: "2025-08-12T16:45:00Z",
    updated_at: "2025-08-12T16:45:00Z"
  },
  {
    id: 6,
    username: "finance1",
    full_name: "Carlos Lopez",
    position: "Finance Manager",
    department: "Finance Department",
    role: "finance",
    is_admin: false,
    created_at: "2025-08-11T11:30:00Z",
    updated_at: "2025-08-11T11:30:00Z"
  }
];
void mockUsers;

const mockRoles = [
  'admin',
  'procurement',
  'validator',
  'supplier',
  'auditor',
  'finance'
];

const roleDescriptions: Record<string, string> = {
  'admin': 'Full system access and user management',
  'procurement': 'Create and manage purchase orders',
  'validator': 'Approve and validate transactions',
  'supplier': 'View and manage supplier information',
  'auditor': 'Access audit logs and reports',
  'finance': 'Financial reporting and analysis'
};

const Users: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    password: '',
    full_name: '',
    position: '',
    department: '',
    role: 'procurement'
  });

  const [errors, setErrors] = useState<{
    username?: string;
    password?: string;
    full_name?: string;
    position?: string;
    department?: string;
    role?: string;
  }>({});

  // Check if user is admin
  useEffect(() => {
    if (user && !user.is_admin) {
      setToastMessage('Access denied. Admin privileges required.');
      setToastType('error');
      setShowToast(true);
      setTimeout(() => navigate('/dashboard'), 2000);
    }
  }, [user, navigate]);

  // Load users
  useEffect(() => {
    if (user?.is_admin) {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Try to fetch from API first
      try {
      const response = await apiService.getUsers();
      setUsers(response);
        setUsingMockData(false);
      } catch (apiError) {
        console.error('Users endpoint is not available:', apiError);
        setUsers([]);
        setUsingMockData(false);
        setToastMessage('User management is coming soon. The backend endpoint is not available yet.');
        setToastType('info');
        setShowToast(true);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      setUsers([]);
      setUsingMockData(false);
      setToastMessage('User management is coming soon. The backend endpoint is not available yet.');
      setToastType('info');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {
      username?: string;
      password?: string;
      full_name?: string;
      position?: string;
      department?: string;
      role?: string;
    } = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }

    if (!editingUser && !formData.password.trim()) {
      newErrors.password = 'Password is required';
    }

    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Full name is required';
    }

    if (!formData.position.trim()) {
      newErrors.position = 'Position is required';
    }

    if (!formData.department.trim()) {
      newErrors.department = 'Department is required';
    }

    if (!formData.role) {
      newErrors.role = 'Role is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      if (usingMockData) {
        setToastMessage('User management is coming soon. The backend endpoint is not available yet.');
        setToastType('warning');
        setShowToast(true);
        return;
      } else {
        // Real API call
        if (editingUser) {
          await apiService.updateUser(editingUser.id, {
            full_name: formData.full_name,
            position: formData.position,
            department: formData.department,
            role: formData.role
          });
          setToastMessage('User updated successfully');
        } else {
          await apiService.createUser({
        username: formData.username,
        password: formData.password,
        full_name: formData.full_name,
        position: formData.position,
        department: formData.department,
        role: formData.role
          });
          setToastMessage('User created successfully');
        }
        fetchUsers();
      }
      
      setToastType('success');
      setShowToast(true);
      setShowModal(false);
      resetForm();
    } catch (error: any) {
      console.error('Failed to save user:', error);
      setToastMessage(error.response?.data?.error || 'Failed to save user');
      setToastType('error');
      setShowToast(true);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      if (usingMockData) {
        setToastMessage('User deletion is coming soon. The backend endpoint is not available yet.');
        setToastType('warning');
        setShowToast(true);
        return;
      } else {
      await apiService.deleteUser(userId);
        setToastMessage('User deleted successfully');
        fetchUsers();
      }
      setToastType('success');
      setShowToast(true);
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      setToastMessage(error.response?.data?.error || 'Failed to delete user');
      setToastType('error');
      setShowToast(true);
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      full_name: '',
      position: '',
      department: '',
      role: 'procurement'
    });
    setErrors({});
    setEditingUser(null);
  };

  const handleShowModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const startEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      full_name: user.full_name,
      position: user.position,
      department: user.department,
      role: user.role
    });
    setShowModal(true);
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!user?.is_admin) {
    return (
      <Container>
        <LoadingSpinner size="lg" text="Checking permissions..." />
      </Container>
    );
  }

  if (loading) {
    return (
      <Container>
        <LoadingSpinner size="lg" text="Loading users..." />
      </Container>
    );
  }

  return (
    <Container>
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h1 className="h2 mb-1">User Management</h1>
              <p className="text-muted mb-0">
                Manage system users and their roles
              </p>
            </div>
            <Button 
              variant="primary" 
              onClick={handleShowModal}
              aria-label="Add new user"
            >
              <i className="bi bi-plus-circle me-2"></i>
          Add User
            </Button>
      </div>
        </Col>
      </Row>

      {/* Search */}
      <Row className="mb-4">
        <Col md={6}>
          <InputGroup>
            <InputGroup.Text>
              <i className="bi bi-search"></i>
            </InputGroup.Text>
            <Form.Control
                    type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search users"
            />
          </InputGroup>
        </Col>
      </Row>

      {/* Users Table */}
      <Card>
        <Card.Header>
          <h5 className="mb-0">Users ({filteredUsers.length})</h5>
        </Card.Header>
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table striped bordered className="mb-0">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Full Name</th>
                  <th>Position</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>Admin</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.username}</strong>
                    </td>
                    <td>{user.full_name}</td>
                    <td>{user.position}</td>
                    <td>{user.department}</td>
                    <td>
                      <Badge bg={
                        user.role === 'admin' ? 'danger' :
                        user.role === 'procurement' ? 'primary' :
                        user.role === 'validator' ? 'warning' :
                        user.role === 'supplier' ? 'info' :
                        user.role === 'auditor' ? 'secondary' :
                        user.role === 'finance' ? 'success' : 'secondary'
                      }>
                        {user.role}
                      </Badge>
                    </td>
                    <td>
                      {user.is_admin ? (
                        <Badge bg="success">Yes</Badge>
                      ) : (
                        <Badge bg="secondary">No</Badge>
                      )}
                    </td>
                    <td>{formatDate(user.created_at)}</td>
                    <td>
                      <div className="d-flex gap-1">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => startEditUser(user)}
                          aria-label={`Edit ${user.username}`}
                        >
                          <i className="bi bi-pencil"></i>
                        </Button>
                        {user.id !== 1 && ( // Prevent deleting the main admin
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => handleDeleteUser(user.id)}
                            aria-label={`Delete ${user.username}`}
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* User Modal */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {editingUser ? 'Edit User' : 'Create New User'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label htmlFor="username">Username *</Form.Label>
                  <Form.Control
                    id="username"
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    isInvalid={!!errors.username}
                    disabled={!!editingUser}
                    aria-describedby="usernameError"
                  />
                  <Form.Control.Feedback type="invalid" id="usernameError">
                    {errors.username}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label htmlFor="password">Password *</Form.Label>
                  <Form.Control
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    isInvalid={!!errors.password}
                    placeholder={editingUser ? 'Leave blank to keep current' : ''}
                    aria-describedby="passwordError"
                  />
                  <Form.Control.Feedback type="invalid" id="passwordError">
                    {errors.password}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label htmlFor="full_name">Full Name *</Form.Label>
                  <Form.Control
                    id="full_name"
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    isInvalid={!!errors.full_name}
                    aria-describedby="fullNameError"
                  />
                  <Form.Control.Feedback type="invalid" id="fullNameError">
                    {errors.full_name}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label htmlFor="position">Position *</Form.Label>
                  <Form.Control
                    id="position"
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    isInvalid={!!errors.position}
                    aria-describedby="positionError"
                  />
                  <Form.Control.Feedback type="invalid" id="positionError">
                    {errors.position}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label htmlFor="department">Department *</Form.Label>
                  <Form.Control
                    id="department"
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    isInvalid={!!errors.department}
                    aria-describedby="departmentError"
                  />
                  <Form.Control.Feedback type="invalid" id="departmentError">
                    {errors.department}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label htmlFor="role">Role *</Form.Label>
                  <Form.Select
                    id="role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    isInvalid={!!errors.role}
                    aria-describedby="roleError"
                  >
                    <option value="">Select Role</option>
                    {mockRoles.map(role => (
                      <option key={role} value={role}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Control.Feedback type="invalid" id="roleError">
                    {errors.role}
                  </Form.Control.Feedback>
                  {roleDescriptions[formData.role] && (
                    <Form.Text className="text-muted">
                      {roleDescriptions[formData.role]}
                    </Form.Text>
                  )}
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {editingUser ? 'Update User' : 'Create User'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Toast Notification */}
      <Toast
        show={showToast}
        message={toastMessage}
        type={toastType}
        onClose={() => setShowToast(false)}
      />
    </Container>
  );
};

export default Users;
