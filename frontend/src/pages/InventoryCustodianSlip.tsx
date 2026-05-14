import React, { useState, useEffect } from 'react';
import { 
  Container, Row, Col, Card, Table, Button, Badge, 
  Form, Modal, InputGroup 
} from 'react-bootstrap';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import './InventoryCustodianSlip.css';

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
  const [statusFilter, setStatusFilter] = useState<'All' | 'Submitted' | 'Draft'>('All');
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

  const getSlipTotal = (slip: CustodianSlip): number =>
    slip.items.reduce((sum, item) => sum + (item.total_value || 0), 0);

  const submittedCount = slips.filter((slip) => slip.status === 'Submitted').length;
  const draftCount = slips.filter((slip) => slip.status === 'Draft').length;
  const totalItems = slips.reduce((sum, slip) => sum + slip.items.length, 0);
  const totalValue = slips.reduce((sum, slip) => sum + getSlipTotal(slip), 0);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredSlips = slips.filter((slip) => {
    const matchesSearch =
      !normalizedSearch ||
      slip.slip_number.toLowerCase().includes(normalizedSearch) ||
      slip.po_number.toLowerCase().includes(normalizedSearch) ||
      slip.received_from.toLowerCase().includes(normalizedSearch) ||
      slip.received_by.toLowerCase().includes(normalizedSearch);

    const matchesStatus = statusFilter === 'All' || slip.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <Container className="py-4 ics-page">
        <LoadingSpinner size="lg" text="Loading..." />
      </Container>
    );
  }

  return (
    <Container fluid className="ics-page py-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="ics-hero">
            <div className="ics-hero-copy">
              <span className="ics-eyebrow">Admin records workspace</span>
              <h2>Inventory Custodian Slip</h2>
              <p>
                Review accepted inspection records, validate custody details, and prepare slips for printing.
              </p>
            </div>
            <div className="ics-admin-chip">
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
          <Card className="ics-stat-card">
            <Card.Body>
              <span>Total slips</span>
              <strong>{slips.length}</strong>
              <small>{submittedCount} submitted</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="ics-stat-card">
            <Card.Body>
              <span>Received items</span>
              <strong>{totalItems}</strong>
              <small>Across accepted inspections</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="ics-stat-card">
            <Card.Body>
              <span>Total value</span>
              <strong>{formatCurrency(totalValue)}</strong>
              <small>For current slip list</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="ics-stat-card">
            <Card.Body>
              <span>Needs review</span>
              <strong>{draftCount}</strong>
              <small>Draft custody slips</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Slips Table */}
      <Card className="ics-table-card">
        <Card.Header>
          <div>
            <h5>Custodian Slips</h5>
            <p>{filteredSlips.length} of {slips.length} records shown</p>
          </div>
          <div className="ics-toolbar">
            <InputGroup className="ics-search">
              <InputGroup.Text>
                <i className="bi bi-search"></i>
              </InputGroup.Text>
              <Form.Control
                type="text"
                placeholder="Search slip, PO, sender, or receiver"
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
          {filteredSlips.length > 0 ? (
            <div className="table-responsive">
              <Table hover className="ics-table mb-0">
                <thead>
                  <tr>
                    <th>Slip Number</th>
                    <th>P.O. No.</th>
                    <th>Date</th>
                    <th>Received From</th>
                    <th>Received By</th>
                    <th className="text-center">Items</th>
                    <th className="text-end">Value</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSlips.map((slip) => (
                    <tr key={slip.id || slip.slip_number}>
                      <td>
                        <strong className="ics-slip-number">{slip.slip_number || 'N/A'}</strong>
                      </td>
                      <td>{slip.po_number}</td>
                      <td>{formatDate(slip.date)}</td>
                      <td>{slip.received_from}</td>
                      <td>{slip.received_by}</td>
                      <td className="text-center">
                        <span className="ics-count-pill">{slip.items.length}</span>
                      </td>
                      <td className="text-end">{formatCurrency(getSlipTotal(slip))}</td>
                      <td>
                        <Badge className={`ics-status ${slip.status === 'Submitted' ? 'is-submitted' : 'is-draft'}`}>
                          {slip.status}
                        </Badge>
                      </td>
                      <td className="text-end">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="ics-view-btn"
                          onClick={() => handleViewSlip(slip)}
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
            <div className="ics-empty-state">
              <i className="bi bi-file-earmark-text"></i>
              <h5>No custodian slips found</h5>
              <p>
                {searchTerm 
                  ? 'Try a different slip number, purchase order, sender, receiver, or status filter.'
                  : 'Accepted inspection records will appear here as inventory custodian slips.'}
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
        dialogClassName="ics-detail-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <span>Inventory Custodian Slip</span>
            {selectedSlip && <strong>{selectedSlip.slip_number}</strong>}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedSlip && (
            <>
              {/* Header Info */}
              <div className="ics-document-heading">
                <div>
                  <span>Custody record</span>
                  <h3>{selectedSlip.slip_number}</h3>
                </div>
                <Badge className={`ics-status ${selectedSlip.status === 'Submitted' ? 'is-submitted' : 'is-draft'}`}>
                  {selectedSlip.status}
                </Badge>
              </div>

              <Row className="g-3 mb-4">
                <Col md={3}>
                  <div className="ics-detail-tile">
                    <span>Reference No.</span>
                    <strong>{selectedSlip.slip_number}</strong>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="ics-detail-tile">
                    <span>P.O. No.</span>
                    <strong>{selectedSlip.po_number}</strong>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="ics-detail-tile">
                    <span>Date</span>
                    <strong>{formatDate(selectedSlip.date)}</strong>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="ics-detail-tile">
                    <span>Total Amount</span>
                    <strong>{formatCurrency(getSlipTotal(selectedSlip))}</strong>
                  </div>
                </Col>
              </Row>

              <Row className="g-3 mb-4">
                <Col md={6}>
                  <div className="ics-person-panel">
                    <span>Received from</span>
                    <strong>{selectedSlip.received_from}</strong>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="ics-person-panel">
                    <span>Received by</span>
                    <strong>{selectedSlip.received_by}</strong>
                  </div>
                </Col>
              </Row>

              {/* Items Section */}
              <div className="ics-section-title">
                <h6>List of Items</h6>
                <span>{selectedSlip.items.length} item{selectedSlip.items.length === 1 ? '' : 's'}</span>
              </div>
              <div className="table-responsive mb-4">
                <Table size="sm" className="ics-detail-table">
                  <thead>
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
                        <td className="text-end">{formatCurrency(item.total_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {/* Remarks */}
              {selectedSlip.remarks && (
                <div className="ics-remarks">
                  <h6>Remarks</h6>
                  <p>{selectedSlip.remarks}</p>
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
            className="ics-print-btn"
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
