import React, { useState, useEffect } from 'react';
import { 
  Container, Row, Col, Card, Table, Button, Badge, 
  Modal, Form, Alert, Tabs, Tab, Pagination 
} from 'react-bootstrap';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';

interface Item {
  id: number;
  name: string;
  description: string;
  category: string;
  unit: string;
  unit_price: number;
  proposed_by: string;
  proposed_date: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  approved_by?: string;
  approved_date?: string;
}

const ItemManagement: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [activeTab, setActiveTab] = useState('pending');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Mock data for demonstration
  const mockItems: Item[] = [
    {
      id: 1,
      name: "Office Chairs - Ergonomic",
      description: "High-quality ergonomic office chairs with adjustable features",
      category: "Office Furniture",
      unit: "pieces",
      unit_price: 2500.00,
      proposed_by: "procurement0",
      proposed_date: "2025-01-15T10:30:00Z",
      status: "pending"
    },
    {
      id: 2,
      name: "Laptop Stands",
      description: "Adjustable laptop stands for better ergonomics",
      category: "Office Equipment",
      unit: "pieces",
      unit_price: 800.00,
      proposed_by: "procurement1",
      proposed_date: "2025-01-14T14:20:00Z",
      status: "pending"
    },
    {
      id: 3,
      name: "Wireless Keyboards",
      description: "Bluetooth wireless keyboards with backlit keys",
      category: "Computer Accessories",
      unit: "pieces",
      unit_price: 1200.00,
      proposed_by: "procurement0",
      proposed_date: "2025-01-13T09:15:00Z",
      status: "approved",
      approved_by: "admin",
      approved_date: "2025-01-14T11:00:00Z"
    },
    {
      id: 4,
      name: "Desk Organizers",
      description: "Multi-compartment desk organizers for office supplies",
      category: "Office Supplies",
      unit: "pieces",
      unit_price: 350.00,
      proposed_by: "procurement2",
      proposed_date: "2025-01-12T16:45:00Z",
      status: "rejected",
      reason: "Item already available in inventory",
      approved_by: "admin",
      approved_date: "2025-01-13T10:30:00Z"
    },
    {
      id: 5,
      name: "Standing Desks",
      description: "Electric standing desks with memory settings",
      category: "Office Furniture",
      unit: "pieces",
      unit_price: 15000.00,
      proposed_by: "procurement1",
      proposed_date: "2025-01-16T08:30:00Z",
      status: "pending"
    },
    {
      id: 6,
      name: "Monitor Arms",
      description: "Dual monitor arms with cable management",
      category: "Office Equipment",
      unit: "pieces",
      unit_price: 1200.00,
      proposed_by: "procurement0",
      proposed_date: "2025-01-17T11:45:00Z",
      status: "approved",
      approved_by: "admin",
      approved_date: "2025-01-18T09:15:00Z"
    }
  ];
  void mockItems;

  useEffect(() => {
    setItems([]);
    setLoading(false);
  }, []);

  const handleApprove = (item: Item) => {
    setSelectedItem(item);
    setShowApprovalModal(true);
  };

  const handleReject = (item: Item) => {
    setSelectedItem(item);
    setShowRejectionModal(true);
  };

  const confirmApprove = () => {
    if (selectedItem) {
      setShowApprovalModal(false);
      setSelectedItem(null);
      setToastMessage('Item approval is coming soon. The backend endpoint is not available yet.');
      setToastType('warning');
      setShowToast(true);
    }
  };

  const confirmReject = () => {
    if (selectedItem && rejectionReason.trim()) {
      setShowRejectionModal(false);
      setSelectedItem(null);
      setRejectionReason('');
      setToastMessage('Item rejection is coming soon. The backend endpoint is not available yet.');
      setToastType('warning');
      setShowToast(true);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'pending': { variant: 'warning', text: 'Pending Review' },
      'approved': { variant: 'success', text: 'Approved' },
      'rejected': { variant: 'danger', text: 'Rejected' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { 
      variant: 'secondary', 
      text: status 
    };

    return <Badge bg={config.variant}>{config.text}</Badge>;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const filteredItems = items.filter(item => {
    if (activeTab === 'pending') return item.status === 'pending';
    if (activeTab === 'approved') return item.status === 'approved';
    if (activeTab === 'rejected') return item.status === 'rejected';
    return true;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  const handleToastClose = () => {
    setShowToast(false);
  };

  if (loading) {
    return (
      <Container className="py-4">
        <LoadingSpinner size="lg" text="Loading item management data..." />
      </Container>
    );
  }

  return (
    <Container className="py-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h2 className="mb-1">Item Management</h2>
              <p className="text-muted mb-0">
                Approve, reject, and manage proposed items
              </p>
            </div>
            <Button variant="primary" disabled title="Coming soon">
              <i className="bi bi-plus me-2"></i>
              Add New Item
            </Button>
          </div>
        </Col>
      </Row>

      {/* Statistics Cards */}
      <Row className="g-3 mb-4">
        <Col md={3}>
          <Card className="text-bg-warning">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="fs-6">Pending Review</div>
                  <div className="display-6 fw-bold">
                    {items.filter(item => item.status === 'pending').length}
                  </div>
                </div>
                <div className="opacity-50" style={{ fontSize: '2rem' }}>
                  <i className="bi bi-clock"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-bg-success">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="fs-6">Approved</div>
                  <div className="display-6 fw-bold">
                    {items.filter(item => item.status === 'approved').length}
                  </div>
                </div>
                <div className="opacity-50" style={{ fontSize: '2rem' }}>
                  <i className="bi bi-check-circle"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-bg-danger">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="fs-6">Rejected</div>
                  <div className="display-6 fw-bold">
                    {items.filter(item => item.status === 'rejected').length}
                  </div>
                </div>
                <div className="opacity-50" style={{ fontSize: '2rem' }}>
                  <i className="bi bi-x-circle"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-bg-info">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="fs-6">Total Items</div>
                  <div className="display-6 fw-bold">{items.length}</div>
                </div>
                <div className="opacity-50" style={{ fontSize: '2rem' }}>
                  <i className="bi bi-box-seam"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Alert variant="info" className="mb-4">
        <i className="bi bi-info-circle me-2"></i>
        Item management is coming soon. No backend endpoint is available yet.
      </Alert>

      {/* Tabs */}
      <Card>
        <Card.Body className="p-0">
          <Tabs 
            activeKey={activeTab} 
            onSelect={(k) => setActiveTab(k || 'pending')}
            className="border-bottom"
          >
            <Tab eventKey="pending" title={`Pending Review (${items.filter(item => item.status === 'pending').length})`}>
              <div className="p-3">
                <div className="table-responsive">
                  <Table className="table-striped mb-0">
                    <thead>
                      <tr>
                        <th>Item Name</th>
                        <th>Category</th>
                        <th>Unit Price</th>
                        <th>Proposed By</th>
                        <th>Date Proposed</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.length > 0 ? (
                        currentItems.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <div>
                                <strong>{item.name}</strong>
                                <div className="text-muted small">{item.description}</div>
                              </div>
                            </td>
                            <td>{item.category}</td>
                            <td>
                              <strong>{formatCurrency(item.unit_price)}</strong>
                              <div className="text-muted small">per {item.unit}</div>
                            </td>
                            <td>{item.proposed_by}</td>
                            <td>{formatDate(item.proposed_date)}</td>
                            <td>{getStatusBadge(item.status)}</td>
                            <td>
                              <div className="d-flex gap-2">
                                <Button 
                                  variant="success" 
                                  size="sm"
                                  onClick={() => handleApprove(item)}
                                >
                                  <i className="bi bi-check me-1"></i>
                                  Approve
                                </Button>
                                <Button 
                                  variant="danger" 
                                  size="sm"
                                  onClick={() => handleReject(item)}
                                >
                                  <i className="bi bi-x me-1"></i>
                                  Reject
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="text-center text-muted py-4">
                            <i className="bi bi-inbox" style={{ fontSize: '2rem' }}></i>
                            <div className="mt-2">No items found</div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              </div>
            </Tab>
            <Tab eventKey="approved" title={`Approved (${items.filter(item => item.status === 'approved').length})`}>
              <div className="p-3">
                <div className="table-responsive">
                  <Table className="table-striped mb-0">
                    <thead>
                      <tr>
                        <th>Item Name</th>
                        <th>Category</th>
                        <th>Unit Price</th>
                        <th>Approved By</th>
                        <th>Date Approved</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.length > 0 ? (
                        currentItems.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <div>
                                <strong>{item.name}</strong>
                                <div className="text-muted small">{item.description}</div>
                              </div>
                            </td>
                            <td>{item.category}</td>
                            <td>
                              <strong>{formatCurrency(item.unit_price)}</strong>
                              <div className="text-muted small">per {item.unit}</div>
                            </td>
                            <td>{item.approved_by}</td>
                            <td>{item.approved_date ? formatDate(item.approved_date) : '-'}</td>
                            <td>{getStatusBadge(item.status)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="text-center text-muted py-4">
                            <i className="bi bi-inbox" style={{ fontSize: '2rem' }}></i>
                            <div className="mt-2">No approved items found</div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              </div>
            </Tab>
            <Tab eventKey="rejected" title={`Rejected (${items.filter(item => item.status === 'rejected').length})`}>
              <div className="p-3">
                <div className="table-responsive">
                  <Table className="table-striped mb-0">
                    <thead>
                      <tr>
                        <th>Item Name</th>
                        <th>Category</th>
                        <th>Unit Price</th>
                        <th>Rejected By</th>
                        <th>Date Rejected</th>
                        <th>Reason</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.length > 0 ? (
                        currentItems.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <div>
                                <strong>{item.name}</strong>
                                <div className="text-muted small">{item.description}</div>
                              </div>
                            </td>
                            <td>{item.category}</td>
                            <td>
                              <strong>{formatCurrency(item.unit_price)}</strong>
                              <div className="text-muted small">per {item.unit}</div>
                            </td>
                            <td>{item.approved_by}</td>
                            <td>{item.approved_date ? formatDate(item.approved_date) : '-'}</td>
                            <td>
                              <span className="text-danger">{item.reason}</span>
                            </td>
                            <td>{getStatusBadge(item.status)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="text-center text-muted py-4">
                            <i className="bi bi-inbox" style={{ fontSize: '2rem' }}></i>
                            <div className="mt-2">No rejected items found</div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              </div>
            </Tab>
          </Tabs>
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
              onClick={() => setCurrentPage(currentPage - 1)} 
              disabled={currentPage === 1}
            />
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Pagination.Item
                key={page}
                active={page === currentPage}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Pagination.Item>
            ))}
            <Pagination.Next 
              onClick={() => setCurrentPage(currentPage + 1)} 
              disabled={currentPage === totalPages}
            />
            <Pagination.Last 
              onClick={() => setCurrentPage(totalPages)} 
              disabled={currentPage === totalPages}
            />
          </Pagination>
        </div>
      )}

      {/* Approval Modal */}
      <Modal show={showApprovalModal} onHide={() => setShowApprovalModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Approve Item</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to approve this item?</p>
          {selectedItem && (
            <div className="border rounded p-3 bg-light">
              <strong>{selectedItem.name}</strong>
              <div className="text-muted">{selectedItem.description}</div>
              <div className="mt-2">
                <strong>Category:</strong> {selectedItem.category}<br/>
                <strong>Unit Price:</strong> {formatCurrency(selectedItem.unit_price)} per {selectedItem.unit}<br/>
                <strong>Proposed By:</strong> {selectedItem.proposed_by}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowApprovalModal(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={confirmApprove}>
            <i className="bi bi-check me-2"></i>
            Approve Item
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Rejection Modal */}
      <Modal show={showRejectionModal} onHide={() => setShowRejectionModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Reject Item</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Please provide a reason for rejecting this item:</p>
          {selectedItem && (
            <div className="border rounded p-3 bg-light mb-3">
              <strong>{selectedItem.name}</strong>
              <div className="text-muted">{selectedItem.description}</div>
            </div>
          )}
          <Form.Group>
            <Form.Label>Rejection Reason *</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter the reason for rejection..."
              required
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRejectionModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={confirmReject}
            disabled={!rejectionReason.trim()}
          >
            <i className="bi bi-x me-2"></i>
            Reject Item
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Toast Notification */}
      <Toast
        show={showToast}
        message={toastMessage}
        type={toastType}
        onClose={handleToastClose}
      />
    </Container>
  );
};

export default ItemManagement;
