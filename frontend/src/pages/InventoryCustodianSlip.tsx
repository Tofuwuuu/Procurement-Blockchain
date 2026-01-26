import React, { useState, useEffect } from 'react';
import { 
  Container, Row, Col, Card, Table, Button, Badge, 
  Form, Modal, InputGroup 
} from 'react-bootstrap';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';

interface CustodianSlipItem {
  item_description: string;
  property_number: string;
  quantity_ordered?: number;
  quantity_received?: number;
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
  po_number: string;
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
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [selectedSlip, setSelectedSlip] = useState<CustodianSlip | null>(null);

  useEffect(() => {
    fetchInspected();
  }, []);

  const fetchInspected = async () => {
    try {
      setLoading(true);
      const inspected = await apiService.getInspected();
      
      // Convert inspected records to custodian slip format
      const slipsData: CustodianSlip[] = inspected.map((item: any, index: number) => ({
        id: item.id || item._id,
        slip_number: `ICS-${new Date().getFullYear()}-${String(index + 1).padStart(4, '0')}`,
        po_number: item.po_number || 'N/A',
        date: item.inspection_date || new Date().toISOString().split('T')[0],
        received_from: item.inspected_by || 'N/A',
        received_by: item.inspected_by || 'N/A',
        items: item.items.map((itemData: any) => ({
          item_description: itemData.item_description,
          property_number: `2024-${String(index + 1).padStart(3, '0')}-001`,
          quantity_ordered: itemData.quantity_ordered || 1,
          quantity_received: itemData.quantity_received || 1,
          quantity: itemData.quantity_received || itemData.quantity_ordered || 1,
          unit: itemData.unit || 'pcs',
          unit_value: itemData.unit_price || 0,
          total_value: (itemData.unit_price || 0) * (itemData.quantity_received || itemData.quantity_ordered || 1),
          condition: itemData.condition || 'Good',
          remarks: itemData.remarks || ''
        })),
        remarks: item.overall_remarks || '',
        status: item.status === 'Accepted' ? 'Submitted' : 'Draft'
      }));
      
      setSlips(slipsData);
    } catch (error: any) {
      console.error('Error fetching inspected records:', error);
      setToastMessage('Failed to load inspected records');
      setToastType('error');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const handleViewSlip = (slip: CustodianSlip) => {
    setSelectedSlip(slip);
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
                        <Button 
                          variant="primary" 
                          size="sm"
                          onClick={() => handleViewSlip(slip)}
                        >
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

      {/* Detail View Modal */}
      <Modal 
        show={showDetailModal} 
        onHide={() => setShowDetailModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Inventory Custodian Slip Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedSlip && (
            <>
              {/* Header Info */}
              <Row className="mb-4">
                <Col md={6}>
                  <Card className="mb-3">
                    <Card.Body>
                      <div className="row mb-2">
                        <div className="col-6"><strong>Reference No.</strong></div>
                        <div className="col-6">{selectedSlip.slip_number}</div>
                      </div>
                      <div className="row mb-2">
                        <div className="col-6"><strong>P.O. No.</strong></div>
                        <div className="col-6">{selectedSlip.po_number}</div>
                      </div>
                      <div className="row">
                        <div className="col-6"><strong>Category</strong></div>
                        <div className="col-6">5,001 - 49,999.99</div>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="mb-3">
                    <Card.Body>
                      <div className="row mb-2">
                        <div className="col-6"><strong>ICS No.</strong></div>
                        <div className="col-6">{selectedSlip.slip_number}</div>
                      </div>
                      <div className="row">
                        <div className="col-6"><strong>Received by</strong></div>
                        <div className="col-6">{selectedSlip.received_by}</div>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Items Section */}
              <h6 className="fw-bold mb-3">List of Items</h6>
              <div className="table-responsive mb-4">
                <Table bordered striped size="sm">
                  <thead className="bg-light">
                    <tr>
                      <th>Stock/ Property No.</th>
                      <th>Item Description</th>
                      <th>Qty Ordered</th>
                      <th>Qty Received</th>
                      <th>Unit</th>
                      <th>Unit Cost</th>
                      <th>Condition</th>
                      <th>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSlip.items.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.property_number}</td>
                        <td>{item.item_description}</td>
                        <td>{item.quantity_ordered ?? item.quantity}</td>
                        <td>{item.quantity_received ?? item.quantity}</td>
                        <td>{item.unit}</td>
                        <td>{formatCurrency(item.unit_value)}</td>
                        <td>{item.condition}</td>
                        <td>{formatCurrency(item.total_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {/* Remarks */}
              {selectedSlip.remarks && (
                <div className="mb-4">
                  <h6 className="fw-bold">Remarks</h6>
                  <p className="text-muted">{selectedSlip.remarks}</p>
                </div>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
            Close
          </Button>
          <Button 
            variant="primary"
            onClick={() => window.print()}
          >
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

export default InventoryCustodianSlip;
