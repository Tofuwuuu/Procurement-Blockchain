import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Row, 
  Col, 
  Card, 
  Table, 
  Badge, 
  Form, 
  Button, 
  Pagination,
  Alert,
  Spinner
} from 'react-bootstrap';
import { httpService } from '../services/api';

interface AuditLog {
  id: number;
  user_id: number;
  username: string;
  action: string;
  table_name: string;
  record_id: number;
  old_values: string | null;
  new_values: string | null;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    action: '',
    table_name: '',
    username: '',
    date_from: '',
    date_to: ''
  });

  const pageSize = 20;

  useEffect(() => {
    fetchAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, filters]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        ...filters
      });

      const response = await httpService.get(`/api/audit-logs?${params}`);
      
      if (response.ok && response.data) {
        setLogs(response.data.logs || []);
        setTotalPages(Math.ceil((response.data.total || 0) / pageSize));
      } else {
        setError('Failed to fetch audit logs');
      }
    } catch (err) {
      setError('Error fetching audit logs');
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setFilters({
      action: '',
      table_name: '',
      username: '',
      date_from: '',
      date_to: ''
    });
    setCurrentPage(1);
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
      case 'insert':
        return 'success';
      case 'update':
      case 'modify':
        return 'warning';
      case 'delete':
      case 'remove':
        return 'danger';
      case 'login':
      case 'logout':
        return 'info';
      default:
        return 'secondary';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  if (loading && logs.length === 0) {
    return (
      <Container fluid className="mt-4">
        <Row className="justify-content-center">
          <Col md={6} className="text-center">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
            <p className="mt-3">Loading audit logs...</p>
          </Col>
        </Row>
      </Container>
    );
  }

  return (
    <Container fluid className="mt-4">
      <Row>
        <Col>
          <h2 className="mb-4">
            <i className="bi bi-clock-history me-2"></i>
            Audit Logs
          </h2>
          
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Filters */}
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">
                <i className="bi bi-funnel me-2"></i>
                Filters
              </h5>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>Action</Form.Label>
                    <Form.Select
                      value={filters.action}
                      onChange={(e) => handleFilterChange('action', e.target.value)}
                    >
                      <option value="">All Actions</option>
                      <option value="create">Create</option>
                      <option value="update">Update</option>
                      <option value="delete">Delete</option>
                      <option value="login">Login</option>
                      <option value="logout">Logout</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>Table</Form.Label>
                    <Form.Select
                      value={filters.table_name}
                      onChange={(e) => handleFilterChange('table_name', e.target.value)}
                    >
                      <option value="">All Tables</option>
                      <option value="users">Users</option>
                      <option value="orders">Orders</option>
                      <option value="suppliers">Suppliers</option>
                      <option value="inventory">Inventory</option>
                      <option value="items">Items</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>Username</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Filter by username"
                      value={filters.username}
                      onChange={(e) => handleFilterChange('username', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>From Date</Form.Label>
                    <Form.Control
                      type="date"
                      value={filters.date_from}
                      onChange={(e) => handleFilterChange('date_from', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>To Date</Form.Label>
                    <Form.Control
                      type="date"
                      value={filters.date_to}
                      onChange={(e) => handleFilterChange('date_to', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={2} className="d-flex align-items-end">
                  <Button 
                    variant="outline-secondary" 
                    onClick={clearFilters}
                    className="w-100"
                  >
                    <i className="bi bi-x-circle me-2"></i>
                    Clear
                  </Button>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Audit Logs Table */}
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                <i className="bi bi-list-ul me-2"></i>
                Audit Trail
              </h5>
              <Badge bg="info" className="fs-6">
                {logs.length} records
              </Badge>
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive striped hover className="mb-0">
                <thead className="table-dark">
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Table</th>
                    <th>Record ID</th>
                    <th>Changes</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <small className="text-muted">
                          {formatDate(log.created_at)}
                        </small>
                      </td>
                      <td>
                        <strong>{log.username}</strong>
                      </td>
                      <td>
                        <Badge bg={getActionBadgeVariant(log.action)}>
                          {log.action}
                        </Badge>
                      </td>
                      <td>
                        <code>{log.table_name}</code>
                      </td>
                      <td>
                        <Badge bg="secondary">#{log.record_id}</Badge>
                      </td>
                      <td>
                        <div className="small">
                          {log.old_values && (
                            <div className="text-danger">
                              <strong>Old:</strong> {truncateText(log.old_values)}
                            </div>
                          )}
                          {log.new_values && (
                            <div className="text-success">
                              <strong>New:</strong> {truncateText(log.new_values)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <small className="text-muted">
                          {log.ip_address}
                        </small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              
              {logs.length === 0 && !loading && (
                <div className="text-center py-4">
                  <i className="bi bi-inbox display-4 text-muted"></i>
                  <p className="text-muted mt-3">No audit logs found</p>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-center mt-4">
              <Pagination>
                <Pagination.First 
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                />
                <Pagination.Prev 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                />
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                  if (page > totalPages) return null;
                  
                  return (
                    <Pagination.Item
                      key={page}
                      active={page === currentPage}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Pagination.Item>
                  );
                })}
                
                <Pagination.Next 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                />
                <Pagination.Last 
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                />
              </Pagination>
            </div>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default AuditLogs;
