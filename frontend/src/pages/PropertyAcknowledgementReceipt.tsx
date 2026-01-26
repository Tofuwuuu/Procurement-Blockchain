import React, { useState, useEffect } from 'react';
import { 
  Container, Row, Col, Card, Table, Button, Badge, 
  Form, Modal, InputGroup 
} from 'react-bootstrap';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';

interface PropertyItem {
  property_number: string;
  item_description: string;
  quantity_ordered?: number;
  quantity_received?: number;
  quantity: number;
  unit: string;
  unit_value: number;
  unit_price?: number;
  total_value: number;
  condition: string;
  date_acquired: string;
  remarks: string;
}

interface AcknowledgementReceipt {
  id?: string;
  par_number: string;
  po_number: string;
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
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState<AcknowledgementReceipt[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [selectedReceipt, setSelectedReceipt] = useState<AcknowledgementReceipt | null>(null);

  useEffect(() => {
    fetchInspected();
  }, []);

  const fetchInspected = async () => {
    try {
      setLoading(true);
      const inspected = await apiService.getInspected();
      
      // Convert inspected records to acknowledgement receipt format
      const receiptsData: AcknowledgementReceipt[] = inspected.map((item: any, index: number) => ({
        id: item.id || item._id,
        par_number: `PAR-${new Date().getFullYear()}-${String(index + 1).padStart(4, '0')}`,
        po_number: item.po_number || 'N/A',
        receipt_number: `PAR-${new Date().getFullYear()}-${String(index + 1).padStart(4, '0')}`,
        date: item.inspection_date || new Date().toISOString().split('T')[0],
        acknowledged_by: item.inspected_by || 'N/A',
        received_by: user?.full_name || item.inspected_by || 'N/A',
        position: user?.role || 'Custodian',
        items: item.items.map((itemData: any) => ({
          property_number: `2024-${String(index + 1).padStart(3, '0')}-001`,
          item_description: itemData.item_description,
          quantity_ordered: itemData.quantity_ordered || 1,
          quantity_received: itemData.quantity_received || 1,
          quantity: itemData.quantity_received || itemData.quantity_ordered || 1,
          unit: itemData.unit || 'pcs',
          unit_value: itemData.unit_price || 0,
          unit_price: itemData.unit_price || 0,
          total_value: (itemData.unit_price || 0) * (itemData.quantity_received || itemData.quantity_ordered || 1),
          condition: itemData.condition || 'Good',
          date_acquired: item.inspection_date || new Date().toISOString().split('T')[0],
          remarks: itemData.remarks || ''
        })),
        remarks: item.overall_remarks || '',
        status: item.status === 'Accepted' ? 'Submitted' : 'Draft'
      }));
      
      setReceipts(receiptsData);
    } catch (error: any) {
      console.error('Error fetching inspected records:', error);
      setToastMessage('Failed to load inspection records');
      setToastType('error');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const handleViewReceipt = (receipt: AcknowledgementReceipt) => {
    setSelectedReceipt(receipt);
    setShowDetailModal(true);
  };

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
                        <Button variant="primary" size="sm" onClick={() => handleViewReceipt(receipt)}>
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

      {/* Detail View Modal */}
      <Modal 
        show={showDetailModal} 
        onHide={() => setShowDetailModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Property Acknowledgement Receipt Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedReceipt && (
            <>
              {/* Header Info */}
              <Row className="mb-4">
                <Col md={6}>
                  <Card className="mb-3">
                    <Card.Body>
                      <div className="row mb-2">
                        <div className="col-6"><strong>PAR No.</strong></div>
                        <div className="col-6">{selectedReceipt.par_number}</div>
                      </div>
                      <div className="row mb-2">
                        <div className="col-6"><strong>PO No.</strong></div>
                        <div className="col-6">{selectedReceipt.po_number}</div>
                      </div>
                      <div className="row">
                        <div className="col-6"><strong>Date</strong></div>
                        <div className="col-6">{formatDate(selectedReceipt.date)}</div>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="mb-3">
                    <Card.Body>
                      <div className="row mb-2">
                        <div className="col-6"><strong>Acknowledged By</strong></div>
                        <div className="col-6">{selectedReceipt.acknowledged_by}</div>
                      </div>
                      <div className="row">
                        <div className="col-6"><strong>Received By</strong></div>
                        <div className="col-6">{selectedReceipt.received_by}</div>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Items Section */}
              <h6 className="fw-bold mb-3">Property Items</h6>
              <div className="table-responsive mb-4">
                <Table bordered striped size="sm">
                  <thead className="bg-light">
                    <tr>
                      <th>Property No.</th>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Unit Cost</th>
                      <th>Total Amount</th>
                      <th>Condition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReceipt.items.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.property_number}</td>
                        <td>{item.item_description}</td>
                        <td>{item.quantity}</td>
                        <td>{item.unit}</td>
                        <td>{formatCurrency(item.unit_value)}</td>
                        <td>{formatCurrency(item.total_value)}</td>
                        <td>{item.condition}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {/* Remarks */}
              {selectedReceipt.remarks && (
                <div className="mb-3">
                  <strong>Remarks:</strong>
                  <p className="mb-0">{selectedReceipt.remarks}</p>
                </div>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
            Close
          </Button>
          <Button variant="primary">
            <i className="bi bi-printer me-2"></i>
            Print
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
