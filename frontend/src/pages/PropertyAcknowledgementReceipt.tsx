import React, { useState, useEffect } from 'react';
import { 
  Container, Row, Col, Card, Table, Button, Badge, 
  Form, Modal, InputGroup 
} from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';

interface PropertyItem {
  property_number: string;
  item_description: string;
  quantity: number;
  unit: string;
  unit_value: number;
  total_value: number;
  condition: string;
  date_acquired: string;
  remarks: string;
}

interface AcknowledgementReceipt {
  id?: string;
  receipt_number: string;
  date: string;
  acknowledged_by: string;
  received_by: string;
  position: string;
  items: PropertyItem[];
  remarks: string;
  status: 'Draft' | 'Submitted';
}

const PropertyAcknowledgementReceipt: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [receipts, setReceipts] = useState<AcknowledgementReceipt[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [currentReceipt, setCurrentReceipt] = useState<AcknowledgementReceipt>({
    receipt_number: '',
    date: new Date().toISOString().split('T')[0],
    acknowledged_by: '',
    received_by: user?.full_name || user?.username || '',
    position: '',
    items: [],
    remarks: '',
    status: 'Draft'
  });

  useEffect(() => {
    // TODO: Fetch acknowledgement receipts from API
    // fetchReceipts();
  }, []);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleCreateNew = () => {
    setCurrentReceipt({
      receipt_number: '',
      date: new Date().toISOString().split('T')[0],
      acknowledged_by: '',
      received_by: user?.full_name || user?.username || '',
      position: '',
      items: [],
      remarks: '',
      status: 'Draft'
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    try {
      // TODO: Submit to API
      setToastMessage('Property Acknowledgement Receipt created successfully');
      setToastType('success');
      setShowToast(true);
      setShowModal(false);
    } catch (error: any) {
      console.error('Error submitting receipt:', error);
      setToastMessage(error.response?.data?.message || 'Failed to create property acknowledgement receipt');
      setToastType('error');
      setShowToast(true);
    }
  };

  const filteredReceipts = receipts.filter(receipt =>
    receipt.receipt_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    receipt.acknowledged_by.toLowerCase().includes(searchTerm.toLowerCase()) ||
    receipt.received_by.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Container className="py-4">
        <LoadingSpinner size="lg" text="Loading..." />
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
              <h2 className="mb-1">Property Acknowledgement Receipt</h2>
              <p className="text-muted mb-0">
                Manage property acknowledgement receipts for assigned items
              </p>
            </div>
            <Button variant="primary" onClick={handleCreateNew}>
              <i className="bi bi-plus-circle me-2"></i>
              New Receipt
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
              placeholder="Search by receipt number, acknowledged by, or received by..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
        </Col>
      </Row>

      {/* Receipts Table */}
      <Card>
        <Card.Header>
          <h5 className="mb-0">Acknowledgement Receipts</h5>
        </Card.Header>
        <Card.Body className="p-0">
          {filteredReceipts.length > 0 ? (
            <div className="table-responsive">
              <Table striped bordered hover className="mb-0">
                <thead>
                  <tr>
                    <th>Receipt Number</th>
                    <th>Date</th>
                    <th>Acknowledged By</th>
                    <th>Received By</th>
                    <th>Items Count</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReceipts.map((receipt) => (
                    <tr key={receipt.id || receipt.receipt_number}>
                      <td><strong>{receipt.receipt_number || 'N/A'}</strong></td>
                      <td>{formatDate(receipt.date)}</td>
                      <td>{receipt.acknowledged_by}</td>
                      <td>{receipt.received_by}</td>
                      <td>{receipt.items.length}</td>
                      <td>
                        <Badge bg={receipt.status === 'Submitted' ? 'success' : 'secondary'}>
                          {receipt.status}
                        </Badge>
                      </td>
                      <td>
                        <Button variant="primary" size="sm">
                          <i className="bi bi-eye me-1"></i>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-5">
              <i className="bi bi-receipt text-muted" style={{ fontSize: '3rem' }}></i>
              <p className="text-muted mt-3">
                {searchTerm 
                  ? 'No receipts found matching your search' 
                  : 'No property acknowledgement receipts found. Create a new one to get started.'}
              </p>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Create/Edit Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title>
            <i className="bi bi-receipt me-2"></i>
            Property Acknowledgement Receipt
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Receipt Number *</Form.Label>
                  <Form.Control
                    type="text"
                    value={currentReceipt.receipt_number}
                    onChange={(e) => setCurrentReceipt({ ...currentReceipt, receipt_number: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Date *</Form.Label>
                  <Form.Control
                    type="date"
                    value={currentReceipt.date}
                    onChange={(e) => setCurrentReceipt({ ...currentReceipt, date: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Acknowledged By *</Form.Label>
                  <Form.Control
                    type="text"
                    value={currentReceipt.acknowledged_by}
                    onChange={(e) => setCurrentReceipt({ ...currentReceipt, acknowledged_by: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Received By *</Form.Label>
                  <Form.Control
                    type="text"
                    value={currentReceipt.received_by}
                    onChange={(e) => setCurrentReceipt({ ...currentReceipt, received_by: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>Position</Form.Label>
              <Form.Control
                type="text"
                value={currentReceipt.position}
                onChange={(e) => setCurrentReceipt({ ...currentReceipt, position: e.target.value })}
                placeholder="Enter position..."
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Remarks</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={currentReceipt.remarks}
                onChange={(e) => setCurrentReceipt({ ...currentReceipt, remarks: e.target.value })}
                placeholder="Enter remarks..."
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            <i className="bi bi-check-circle me-2"></i>
            Submit
          </Button>
        </Modal.Footer>
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

export default PropertyAcknowledgementReceipt;
