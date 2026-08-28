import React, { useState, useEffect } from 'react';
import { 
  Container, Row, Col, Card, Table, Button, Badge, 
  Form, Modal, InputGroup 
} from 'react-bootstrap';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import './PropertyAcknowledgementReceipt.css';

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
  const [statusFilter, setStatusFilter] = useState<'All' | 'Submitted' | 'Draft'>('All');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [selectedReceipt, setSelectedReceipt] = useState<AcknowledgementReceipt | null>(null);

  useEffect(() => {
    fetchInspected();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const getReceiptTotal = (receipt: AcknowledgementReceipt): number =>
    receipt.items.reduce((sum, item) => sum + (item.total_value || 0), 0);

  const submittedCount = receipts.filter((receipt) => receipt.status === 'Submitted').length;
  const draftCount = receipts.filter((receipt) => receipt.status === 'Draft').length;
  const totalItems = receipts.reduce((sum, receipt) => sum + receipt.items.length, 0);
  const totalValue = receipts.reduce((sum, receipt) => sum + getReceiptTotal(receipt), 0);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredReceipts = receipts.filter((receipt) => {
    const matchesSearch =
      !normalizedSearch ||
      receipt.receipt_number.toLowerCase().includes(normalizedSearch) ||
      receipt.par_number.toLowerCase().includes(normalizedSearch) ||
      receipt.po_number.toLowerCase().includes(normalizedSearch) ||
      receipt.acknowledged_by.toLowerCase().includes(normalizedSearch) ||
      receipt.received_by.toLowerCase().includes(normalizedSearch);

    const matchesStatus = statusFilter === 'All' || receipt.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <Container className="py-4 par-page">
        <LoadingSpinner size="lg" text="Loading..." />
      </Container>
    );
  }

  return (
    <Container fluid className="py-4 par-page">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="par-hero">
            <div className="par-hero-copy">
              <span className="par-eyebrow">Admin property desk</span>
              <h2>Property Acknowledgement Receipt</h2>
              <p>
                Review assigned property, verify acknowledgement details, and prepare receipts for printing.
              </p>
            </div>
            <div className="par-admin-chip">
              <i className="bi bi-person-badge"></i>
              <div>
                <span>Signed in as</span>
                <strong>{user?.username || 'Admin'}</strong>
              </div>
            </div>
          </div>
        </Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col md={3}>
          <Card className="par-stat-card">
            <Card.Body>
              <span>Total receipts</span>
              <strong>{receipts.length}</strong>
              <small>{submittedCount} submitted</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="par-stat-card">
            <Card.Body>
              <span>Assigned items</span>
              <strong>{totalItems}</strong>
              <small>Across accepted inspections</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="par-stat-card">
            <Card.Body>
              <span>Total value</span>
              <strong>{formatCurrency(totalValue)}</strong>
              <small>For current receipt list</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="par-stat-card">
            <Card.Body>
              <span>Needs review</span>
              <strong>{draftCount}</strong>
              <small>Draft acknowledgement receipts</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Receipts Table */}
      <Card className="par-table-card">
        <Card.Header>
          <div>
            <h5>Acknowledgement Receipts</h5>
            <p>{filteredReceipts.length} of {receipts.length} records shown</p>
          </div>
          <div className="par-toolbar">
            <InputGroup className="par-search">
              <InputGroup.Text>
                <i className="bi bi-search"></i>
              </InputGroup.Text>
              <Form.Control
                type="text"
                placeholder="Search PAR, PO, acknowledgement, or receiver"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </InputGroup>
            <Form.Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Submitted' | 'Draft')}
              aria-label="Filter by status"
            >
              <option value="All">All statuses</option>
              <option value="Submitted">Submitted</option>
              <option value="Draft">Draft</option>
            </Form.Select>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          {filteredReceipts.length > 0 ? (
            <div className="table-responsive">
              <Table hover className="par-table mb-0">
                <thead>
                  <tr>
                    <th>Receipt Number</th>
                    <th>P.O. No.</th>
                    <th>Date</th>
                    <th>Acknowledged By</th>
                    <th>Received By</th>
                    <th className="text-center">Items</th>
                    <th className="text-end">Value</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReceipts.map((receipt) => (
                    <tr key={receipt.id || receipt.receipt_number}>
                      <td>
                        <strong className="par-number">{receipt.receipt_number || 'N/A'}</strong>
                      </td>
                      <td>{receipt.po_number}</td>
                      <td>{formatDate(receipt.date)}</td>
                      <td>{receipt.acknowledged_by}</td>
                      <td>{receipt.received_by}</td>
                      <td className="text-center">
                        <span className="par-count-pill">{receipt.items.length}</span>
                      </td>
                      <td className="text-end">{formatCurrency(getReceiptTotal(receipt))}</td>
                      <td>
                        <Badge className={`par-status ${receipt.status === 'Submitted' ? 'is-submitted' : 'is-draft'}`}>
                          {receipt.status}
                        </Badge>
                      </td>
                      <td className="text-end">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="par-view-btn"
                          onClick={() => handleViewReceipt(receipt)}
                        >
                          <i className="bi bi-eye me-1"></i>
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <div className="par-empty-state">
              <i className="bi bi-receipt"></i>
              <h5>No acknowledgement receipts found</h5>
              <p>
                {searchTerm 
                  ? 'Try a different PAR number, purchase order, acknowledgement name, receiver, or status filter.'
                  : 'Accepted inspection records will appear here as property acknowledgement receipts.'}
              </p>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Detail View Modal */}
      <Modal 
        show={showDetailModal} 
        onHide={() => setShowDetailModal(false)}
        size="xl"
        centered
        dialogClassName="par-detail-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <span>Property Acknowledgement Receipt</span>
            {selectedReceipt && <strong>{selectedReceipt.receipt_number}</strong>}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedReceipt && (
            <>
              {/* Header Info */}
              <div className="par-document-heading">
                <div>
                  <span>Property acknowledgement record</span>
                  <h3>{selectedReceipt.receipt_number}</h3>
                </div>
                <Badge className={`par-status ${selectedReceipt.status === 'Submitted' ? 'is-submitted' : 'is-draft'}`}>
                  {selectedReceipt.status}
                </Badge>
              </div>

              <Row className="g-3 mb-4">
                <Col md={3}>
                  <div className="par-detail-tile">
                    <span>PAR No.</span>
                    <strong>{selectedReceipt.par_number}</strong>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="par-detail-tile">
                    <span>P.O. No.</span>
                    <strong>{selectedReceipt.po_number}</strong>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="par-detail-tile">
                    <span>Date</span>
                    <strong>{formatDate(selectedReceipt.date)}</strong>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="par-detail-tile">
                    <span>Total Amount</span>
                    <strong>{formatCurrency(getReceiptTotal(selectedReceipt))}</strong>
                  </div>
                </Col>
              </Row>

              <Row className="g-3 mb-4">
                <Col md={4}>
                  <div className="par-person-panel">
                    <span>Acknowledged by</span>
                    <strong>{selectedReceipt.acknowledged_by}</strong>
                  </div>
                </Col>
                <Col md={4}>
                  <div className="par-person-panel">
                    <span>Received by</span>
                    <strong>{selectedReceipt.received_by}</strong>
                  </div>
                </Col>
                <Col md={4}>
                  <div className="par-person-panel">
                    <span>Position</span>
                    <strong>{selectedReceipt.position || 'Custodian'}</strong>
                  </div>
                </Col>
              </Row>

              {/* Items Section */}
              <div className="par-section-title">
                <h6>Property Items</h6>
                <span>{selectedReceipt.items.length} item{selectedReceipt.items.length === 1 ? '' : 's'}</span>
              </div>
              <div className="table-responsive mb-4">
                <Table size="sm" className="par-detail-table">
                  <thead>
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
                        <td className="text-end">{formatCurrency(item.total_value)}</td>
                        <td>{item.condition}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {/* Remarks */}
              {selectedReceipt.remarks && (
                <div className="par-remarks">
                  <h6>Remarks</h6>
                  <p>{selectedReceipt.remarks}</p>
                </div>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
            Close
          </Button>
          <Button variant="primary" className="par-print-btn" onClick={() => window.print()}>
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
