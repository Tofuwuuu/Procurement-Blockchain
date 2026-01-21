import React, { useState, useEffect } from 'react';
import { 
  Container, Row, Col, Card, Table, Button, Badge, 
  Form, Modal, InputGroup 
} from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';

interface CustodianSlipItem {
  item_description: string;
  property_number: string;
  quantity: number;
  unit: string;
  unit_value: number;
  total_value: number;
  condition: string;
  remarks: string;
}

interface CustodianSlip {
  id?: string;
  slip_number: string;
  date: string;
  received_from: string;
  received_by: string;
  items: CustodianSlipItem[];
  remarks: string;
  status: 'Draft' | 'Submitted';
}

const InventoryCustodianSlip: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [slips, setSlips] = useState<CustodianSlip[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [currentSlip, setCurrentSlip] = useState<CustodianSlip>({
    slip_number: '',
    date: new Date().toISOString().split('T')[0],
    received_from: '',
    received_by: user?.full_name || user?.username || '',
    items: [],
    remarks: '',
    status: 'Draft'
  });

  useEffect(() => {
    // TODO: Fetch custodian slips from API
    // fetchSlips();
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
    setCurrentSlip({
      slip_number: '',
      date: new Date().toISOString().split('T')[0],
      received_from: '',
      received_by: user?.full_name || user?.username || '',
      items: [],
      remarks: '',
      status: 'Draft'
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    try {
      // TODO: Submit to API
      setToastMessage('Inventory Custodian Slip created successfully');
      setToastType('success');
      setShowToast(true);
      setShowModal(false);
    } catch (error: any) {
      console.error('Error submitting slip:', error);
      setToastMessage(error.response?.data?.message || 'Failed to create inventory custodian slip');
      setToastType('error');
      setShowToast(true);
    }
  };

  const filteredSlips = slips.filter(slip =>
    slip.slip_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    slip.received_from.toLowerCase().includes(searchTerm.toLowerCase())
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
              <h2 className="mb-1">Inventory Custodian Slip</h2>
              <p className="text-muted mb-0">
                Manage inventory custodian slips for received items
              </p>
            </div>
            <Button variant="primary" onClick={handleCreateNew}>
              <i className="bi bi-plus-circle me-2"></i>
              New Slip
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
              placeholder="Search by slip number or received from..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
        </Col>
      </Row>

      {/* Slips Table */}
      <Card>
        <Card.Header>
          <h5 className="mb-0">Custodian Slips</h5>
        </Card.Header>
        <Card.Body className="p-0">
          {filteredSlips.length > 0 ? (
            <div className="table-responsive">
              <Table striped bordered hover className="mb-0">
                <thead>
                  <tr>
                    <th>Slip Number</th>
                    <th>Date</th>
                    <th>Received From</th>
                    <th>Received By</th>
                    <th>Items Count</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSlips.map((slip) => (
                    <tr key={slip.id || slip.slip_number}>
                      <td><strong>{slip.slip_number || 'N/A'}</strong></td>
                      <td>{formatDate(slip.date)}</td>
                      <td>{slip.received_from}</td>
                      <td>{slip.received_by}</td>
                      <td>{slip.items.length}</td>
                      <td>
                        <Badge bg={slip.status === 'Submitted' ? 'success' : 'secondary'}>
                          {slip.status}
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
              <i className="bi bi-file-earmark-text text-muted" style={{ fontSize: '3rem' }}></i>
              <p className="text-muted mt-3">
                {searchTerm 
                  ? 'No slips found matching your search' 
                  : 'No inventory custodian slips found. Create a new one to get started.'}
              </p>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Create/Edit Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title>
            <i className="bi bi-file-earmark-text me-2"></i>
            Inventory Custodian Slip
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Slip Number *</Form.Label>
                  <Form.Control
                    type="text"
                    value={currentSlip.slip_number}
                    onChange={(e) => setCurrentSlip({ ...currentSlip, slip_number: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Date *</Form.Label>
                  <Form.Control
                    type="date"
                    value={currentSlip.date}
                    onChange={(e) => setCurrentSlip({ ...currentSlip, date: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Received From *</Form.Label>
                  <Form.Control
                    type="text"
                    value={currentSlip.received_from}
                    onChange={(e) => setCurrentSlip({ ...currentSlip, received_from: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Received By *</Form.Label>
                  <Form.Control
                    type="text"
                    value={currentSlip.received_by}
                    onChange={(e) => setCurrentSlip({ ...currentSlip, received_by: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>Remarks</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={currentSlip.remarks}
                onChange={(e) => setCurrentSlip({ ...currentSlip, remarks: e.target.value })}
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

export default InventoryCustodianSlip;
