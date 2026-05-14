import React, { useState, useEffect } from 'react';
import {
  Container, Row, Col, Card, Button, Table, Form, Modal,
  InputGroup, Badge
} from 'react-bootstrap';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import './PropertyTransferReport.css';

interface TransferItem {
  date_acquired: string;
  item_no: string;
  ics_no: string;
  description: string;
  amount: number;
  condition: string;
}

interface PropertyTransfer {
  id?: string;
  itr_no: string;
  entity_name: string;
  fund_cluster: string;
  transfer_type: 'Donation' | 'Reassignment' | 'Relocate' | 'Others';
  transfer_type_others?: string;
  items: TransferItem[];
  reason_for_transfer: string;
  approved_by: string;
  released_issued_by: string;
  received_by: string;
  date: string;
  status: 'Draft' | 'Submitted';
}

const emptyTransfer = (releasedBy = ''): PropertyTransfer => ({
  itr_no: '',
  entity_name: '',
  fund_cluster: '',
  transfer_type: 'Reassignment',
  transfer_type_others: '',
  items: [],
  reason_for_transfer: '',
  approved_by: '',
  released_issued_by: releasedBy,
  received_by: '',
  date: new Date().toISOString().split('T')[0],
  status: 'Draft'
});

const emptyItem = (): TransferItem => ({
  date_acquired: '',
  item_no: '',
  ics_no: '',
  description: '',
  amount: 0,
  condition: 'Good'
});

const PropertyTransferReport: React.FC = () => {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<PropertyTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<PropertyTransfer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Submitted' | 'Draft'>('All');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [showToast, setShowToast] = useState(false);
  const [currentTransfer, setCurrentTransfer] = useState<PropertyTransfer>(emptyTransfer(user?.full_name || ''));
  const [newItem, setNewItem] = useState<TransferItem>(emptyItem());

  useEffect(() => {
    fetchTransfers();
  }, []);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getPropertyTransferReports();
      setTransfers(data || []);
    } catch (err) {
      setError('Failed to load property transfer reports');
      console.error(err);
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number): string =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount || 0);

  const formatDate = (dateString: string): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getTransferTotal = (transfer: PropertyTransfer): number =>
    transfer.items?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;

  const submittedCount = transfers.filter((transfer) => transfer.status === 'Submitted').length;
  const draftCount = transfers.filter((transfer) => transfer.status === 'Draft').length;
  const totalItems = transfers.reduce((sum, transfer) => sum + (transfer.items?.length || 0), 0);
  const totalValue = transfers.reduce((sum, transfer) => sum + getTransferTotal(transfer), 0);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredTransfers = transfers.filter((transfer) => {
    const matchesSearch =
      !normalizedSearch ||
      transfer.itr_no?.toLowerCase().includes(normalizedSearch) ||
      transfer.entity_name?.toLowerCase().includes(normalizedSearch) ||
      transfer.transfer_type?.toLowerCase().includes(normalizedSearch) ||
      transfer.released_issued_by?.toLowerCase().includes(normalizedSearch) ||
      transfer.received_by?.toLowerCase().includes(normalizedSearch);

    const matchesStatus = statusFilter === 'All' || transfer.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleViewTransfer = (transfer: PropertyTransfer) => {
    setSelectedTransfer(transfer);
    setShowViewModal(true);
  };

  const handleAddItem = () => {
    if (!newItem.date_acquired || !newItem.item_no || !newItem.description) {
      setToastMessage('Please fill in required item fields');
      setToastType('warning');
      setShowToast(true);
      return;
    }

    setCurrentTransfer({
      ...currentTransfer,
      items: [...currentTransfer.items, newItem]
    });
    setNewItem(emptyItem());
  };

  const handleRemoveItem = (index: number) => {
    setCurrentTransfer({
      ...currentTransfer,
      items: currentTransfer.items.filter((_, itemIndex) => itemIndex !== index)
    });
  };

  const handleSubmit = async () => {
    try {
      if (!currentTransfer.entity_name || currentTransfer.items.length === 0) {
        setToastMessage('Please fill in all required fields and add at least one item');
        setToastType('warning');
        setShowToast(true);
        return;
      }

      const ptrNo = currentTransfer.itr_no || `PTR-${new Date().getFullYear()}-${String(transfers.length + 1).padStart(4, '0')}`;
      await apiService.createPropertyTransferReport({ ...currentTransfer, itr_no: ptrNo });

      setToastMessage('Property Transfer Report created successfully');
      setToastType('success');
      setShowToast(true);
      setShowModal(false);
      setCurrentTransfer(emptyTransfer(user?.full_name || ''));
      setNewItem(emptyItem());
      fetchTransfers();
    } catch (err: any) {
      console.error('Error submitting transfer:', err);
      setToastMessage(err?.message || 'Error creating property transfer report');
      setToastType('error');
      setShowToast(true);
    }
  };

  if (loading) {
    return (
      <Container className="py-4 ptr-page">
        <LoadingSpinner size="lg" text="Loading property transfer reports..." />
      </Container>
    );
  }

  return (
    <Container fluid className="py-4 ptr-page">
      {error && <Toast message={error} type="error" show={!!error} onClose={() => setError(null)} />}

      <Row className="mb-4">
        <Col>
          <div className="ptr-hero">
            <div>
              <span className="ptr-eyebrow">Admin property desk</span>
              <h1>Property Transfer Report</h1>
              <p>Manage property movement, verify accountability, and prepare transfer records for audit.</p>
            </div>
            <div className="ptr-hero-actions">
              <div className="ptr-admin-chip">
                <i className="bi bi-person-badge"></i>
                <div>
                  <span>Signed in as</span>
                  <strong>{user?.username || 'Admin'}</strong>
                </div>
              </div>
              <Button variant="primary" className="ptr-primary-action" onClick={() => setShowModal(true)}>
                <i className="bi bi-plus-lg"></i>
                New Transfer
              </Button>
            </div>
          </div>
        </Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col md={3}>
          <Card className="ptr-stat-card"><Card.Body><span>Total transfers</span><strong>{transfers.length}</strong><small>{submittedCount} submitted</small></Card.Body></Card>
        </Col>
        <Col md={3}>
          <Card className="ptr-stat-card"><Card.Body><span>Property items</span><strong>{totalItems}</strong><small>Across all reports</small></Card.Body></Card>
        </Col>
        <Col md={3}>
          <Card className="ptr-stat-card"><Card.Body><span>Total value</span><strong>{formatCurrency(totalValue)}</strong><small>Recorded transfer value</small></Card.Body></Card>
        </Col>
        <Col md={3}>
          <Card className="ptr-stat-card"><Card.Body><span>Needs review</span><strong>{draftCount}</strong><small>Draft property transfers</small></Card.Body></Card>
        </Col>
      </Row>

      <Card className="ptr-table-card">
        <Card.Header>
          <div>
            <h5>Property Transfer Reports</h5>
            <p>{filteredTransfers.length} of {transfers.length} records shown</p>
          </div>
          <div className="ptr-toolbar">
            <InputGroup className="ptr-search">
              <InputGroup.Text><i className="bi bi-search"></i></InputGroup.Text>
              <Form.Control
                placeholder="Search PTR, entity, type, issuer, or receiver"
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
          {filteredTransfers.length > 0 ? (
            <div className="table-responsive">
              <Table hover className="ptr-table mb-0">
                <thead>
                  <tr>
                    <th>PTR No.</th>
                    <th>Entity Name</th>
                    <th>Transfer Type</th>
                    <th>Date</th>
                    <th className="text-center">Items</th>
                    <th className="text-end">Value</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransfers.map((transfer) => (
                    <tr key={transfer.id || transfer.itr_no}>
                      <td><strong className="ptr-number">{transfer.itr_no}</strong></td>
                      <td>{transfer.entity_name || 'N/A'}</td>
                      <td>{transfer.transfer_type_others || transfer.transfer_type}</td>
                      <td>{formatDate(transfer.date)}</td>
                      <td className="text-center"><span className="ptr-count-pill">{transfer.items?.length || 0}</span></td>
                      <td className="text-end">{formatCurrency(getTransferTotal(transfer))}</td>
                      <td>
                        <Badge className={`ptr-status ${transfer.status === 'Submitted' ? 'is-submitted' : 'is-draft'}`}>
                          {transfer.status}
                        </Badge>
                      </td>
                      <td className="text-end">
                        <Button variant="outline-primary" size="sm" className="ptr-view-btn" onClick={() => handleViewTransfer(transfer)}>
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
            <div className="ptr-empty-state">
              <i className="bi bi-arrow-left-right"></i>
              <h5>No property transfer reports found</h5>
              <p>
                {searchTerm ? 'Try a different PTR number, entity, transfer type, or status filter.' : 'Create a new transfer report when property moves between custodians.'}
              </p>
            </div>
          )}
        </Card.Body>
      </Card>

      <Modal show={showModal} onHide={() => setShowModal(false)} size="xl" centered dialogClassName="ptr-form-modal">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-file-earmark-text me-2"></i>
            New Property Transfer Report
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <div className="ptr-form-heading">
              <h5>PROPERTY TRANSFER REPORT</h5>
              <p>Complete accountability and property movement details before saving the report.</p>
            </div>

            <Row className="g-3 mb-3">
              <Col md={8}>
                <Form.Group>
                  <Form.Label>Entity Name *</Form.Label>
                  <Form.Control value={currentTransfer.entity_name} onChange={(e) => setCurrentTransfer({ ...currentTransfer, entity_name: e.target.value })} placeholder="e.g., CAVITE STATE UNIVERSITY" required />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Fund Cluster</Form.Label>
                  <Form.Control value={currentTransfer.fund_cluster} onChange={(e) => setCurrentTransfer({ ...currentTransfer, fund_cluster: e.target.value })} placeholder="Fund Cluster" />
                </Form.Group>
              </Col>
            </Row>

            <Row className="g-3 mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>From Accountable Officer/Agency/Fund Cluster *</Form.Label>
                  <Form.Control as="textarea" rows={2} value={currentTransfer.approved_by} onChange={(e) => setCurrentTransfer({ ...currentTransfer, approved_by: e.target.value })} placeholder="Name and designation" />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>To Accountable Officer/Agency/Fund Cluster *</Form.Label>
                  <Form.Control as="textarea" rows={2} value={currentTransfer.received_by} onChange={(e) => setCurrentTransfer({ ...currentTransfer, received_by: e.target.value })} placeholder="Name and designation" />
                </Form.Group>
              </Col>
            </Row>

            <Row className="g-3 mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>PTR No.</Form.Label>
                  <Form.Control value={currentTransfer.itr_no} onChange={(e) => setCurrentTransfer({ ...currentTransfer, itr_no: e.target.value })} placeholder="Auto-generated if blank" />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Date *</Form.Label>
                  <Form.Control type="date" value={currentTransfer.date} onChange={(e) => setCurrentTransfer({ ...currentTransfer, date: e.target.value })} required />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Transfer Type *</Form.Label>
              <div className="ptr-transfer-options">
                {(['Donation', 'Reassignment', 'Relocate', 'Others'] as const).map((type) => (
                  <Form.Check
                    key={type}
                    type="radio"
                    id={`property_transfer_${type.toLowerCase()}`}
                    label={type === 'Others' ? 'Others (Specify)' : type}
                    name="transfer_type"
                    value={type}
                    checked={currentTransfer.transfer_type === type}
                    onChange={(e) => setCurrentTransfer({ ...currentTransfer, transfer_type: e.target.value as any })}
                  />
                ))}
                {currentTransfer.transfer_type === 'Others' && (
                  <Form.Control value={currentTransfer.transfer_type_others} onChange={(e) => setCurrentTransfer({ ...currentTransfer, transfer_type_others: e.target.value })} placeholder="Specify transfer type" />
                )}
              </div>
            </Form.Group>

            <div className="mb-3">
              <Form.Label>Items to be Transferred *</Form.Label>
              <Card className="ptr-add-item-card mb-3">
                <Card.Body>
                  <Row className="g-3">
                    <Col md={2}><Form.Group><Form.Label>Date Acquired</Form.Label><Form.Control type="date" value={newItem.date_acquired} onChange={(e) => setNewItem({ ...newItem, date_acquired: e.target.value })} /></Form.Group></Col>
                    <Col md={2}><Form.Group><Form.Label>Item No.</Form.Label><Form.Control value={newItem.item_no} onChange={(e) => setNewItem({ ...newItem, item_no: e.target.value })} placeholder="e.g., 1 pc" /></Form.Group></Col>
                    <Col md={2}><Form.Group><Form.Label>ICS No./Date</Form.Label><Form.Control value={newItem.ics_no} onChange={(e) => setNewItem({ ...newItem, ics_no: e.target.value })} placeholder="ICS No./Date" /></Form.Group></Col>
                    <Col md={3}><Form.Group><Form.Label>Description</Form.Label><Form.Control value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} placeholder="Item description" /></Form.Group></Col>
                    <Col md={1}><Form.Group><Form.Label>Amount</Form.Label><Form.Control type="number" value={newItem.amount} onChange={(e) => setNewItem({ ...newItem, amount: parseFloat(e.target.value) || 0 })} /></Form.Group></Col>
                    <Col md={2}>
                      <Form.Group>
                        <Form.Label>Condition</Form.Label>
                        <Form.Select value={newItem.condition} onChange={(e) => setNewItem({ ...newItem, condition: e.target.value })}>
                          <option value="Good">Good</option>
                          <option value="Fair">Fair</option>
                          <option value="Poor">Poor</option>
                          <option value="For Repair">For Repair</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>
                  <Button variant="outline-primary" size="sm" className="mt-3" onClick={handleAddItem}>
                    <i className="bi bi-plus me-1"></i>Add Item
                  </Button>
                </Card.Body>
              </Card>

              <div className="table-responsive ptr-form-table-wrap">
                <Table size="sm" className="ptr-form-table mb-0">
                  <thead>
                    <tr>
                      <th>Date Acquired</th>
                      <th>Item No.</th>
                      <th>ICS No./Date</th>
                      <th>Description</th>
                      <th className="text-end">Amount</th>
                      <th>Condition</th>
                      <th className="text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentTransfer.items.length > 0 ? currentTransfer.items.map((item, index) => (
                      <tr key={`${item.item_no}-${index}`}>
                        <td>{item.date_acquired}</td>
                        <td>{item.item_no}</td>
                        <td>{item.ics_no}</td>
                        <td>{item.description}</td>
                        <td className="text-end">{formatCurrency(item.amount)}</td>
                        <td>{item.condition}</td>
                        <td className="text-end">
                          <Button variant="outline-danger" size="sm" onClick={() => handleRemoveItem(index)}>
                            <i className="bi bi-trash"></i>
                          </Button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7} className="text-center text-muted py-4">No items added yet.</td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </div>

            <Form.Group className="mb-3">
              <Form.Label>Reason for Transfer</Form.Label>
              <Form.Control as="textarea" rows={3} value={currentTransfer.reason_for_transfer} onChange={(e) => setCurrentTransfer({ ...currentTransfer, reason_for_transfer: e.target.value })} placeholder="Reason for transfer" />
            </Form.Group>

            <div className="ptr-signature-section">
              <Row className="g-3 text-center">
                <Col md={4}>
                  <small><strong>Approved by:</strong></small>
                  <div className="ptr-signature-box"></div>
                  <Form.Control size="sm" value={currentTransfer.approved_by} onChange={(e) => setCurrentTransfer({ ...currentTransfer, approved_by: e.target.value })} placeholder="Printed Name" className="mb-1" />
                  <Form.Control size="sm" placeholder="Designation" className="mb-1" />
                  <Form.Control type="date" size="sm" />
                </Col>
                <Col md={4}>
                  <small><strong>Released/Issued by:</strong></small>
                  <div className="ptr-signature-box"></div>
                  <Form.Control size="sm" value={currentTransfer.released_issued_by} onChange={(e) => setCurrentTransfer({ ...currentTransfer, released_issued_by: e.target.value })} placeholder="Printed Name" className="mb-1" />
                  <Form.Control size="sm" placeholder="Designation" className="mb-1" />
                  <Form.Control type="date" size="sm" />
                </Col>
                <Col md={4}>
                  <small><strong>Received by:</strong></small>
                  <div className="ptr-signature-box"></div>
                  <Form.Control size="sm" value={currentTransfer.received_by} onChange={(e) => setCurrentTransfer({ ...currentTransfer, received_by: e.target.value })} placeholder="Printed Name" className="mb-1" />
                  <Form.Control size="sm" placeholder="Designation" className="mb-1" />
                  <Form.Control type="date" size="sm" />
                </Col>
              </Row>
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit}>
            <i className="bi bi-check-circle me-2"></i>
            Save Transfer Report
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showViewModal} onHide={() => setShowViewModal(false)} size="xl" centered dialogClassName="ptr-detail-modal">
        <Modal.Header closeButton>
          <Modal.Title>
            <span>Property Transfer Report</span>
            {selectedTransfer && <strong>{selectedTransfer.itr_no}</strong>}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedTransfer && (
            <div className="ptr-document">
              <div className="ptr-document-heading">
                <div>
                  <span>Property movement record</span>
                  <h3>{selectedTransfer.itr_no}</h3>
                </div>
                <Badge className={`ptr-status ${selectedTransfer.status === 'Submitted' ? 'is-submitted' : 'is-draft'}`}>
                  {selectedTransfer.status}
                </Badge>
              </div>

              <Row className="g-3 mb-4">
                <Col md={3}><div className="ptr-detail-tile"><span>Entity</span><strong>{selectedTransfer.entity_name || 'N/A'}</strong></div></Col>
                <Col md={3}><div className="ptr-detail-tile"><span>Fund Cluster</span><strong>{selectedTransfer.fund_cluster || 'N/A'}</strong></div></Col>
                <Col md={3}><div className="ptr-detail-tile"><span>Transfer Type</span><strong>{selectedTransfer.transfer_type_others || selectedTransfer.transfer_type}</strong></div></Col>
                <Col md={3}><div className="ptr-detail-tile"><span>Date</span><strong>{formatDate(selectedTransfer.date)}</strong></div></Col>
              </Row>

              <Row className="g-3 mb-4">
                <Col md={4}><div className="ptr-detail-tile"><span>Total Items</span><strong>{selectedTransfer.items?.length || 0}</strong></div></Col>
                <Col md={4}><div className="ptr-detail-tile"><span>Total Value</span><strong>{formatCurrency(getTransferTotal(selectedTransfer))}</strong></div></Col>
                <Col md={4}><div className="ptr-detail-tile"><span>Released By</span><strong>{selectedTransfer.released_issued_by || 'N/A'}</strong></div></Col>
              </Row>

              <div className="ptr-section-title">
                <h6>Items</h6>
                <span>{selectedTransfer.items?.length || 0} item{selectedTransfer.items?.length === 1 ? '' : 's'}</span>
              </div>
              {selectedTransfer.items?.length ? (
                <div className="table-responsive">
                  <Table size="sm" className="ptr-detail-table">
                    <thead>
                      <tr>
                        <th>Date Acquired</th>
                        <th>Item No.</th>
                        <th>ICS No.</th>
                        <th>Description</th>
                        <th className="text-end">Amount</th>
                        <th>Condition</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTransfer.items.map((item, index) => (
                        <tr key={`${item.item_no}-${index}`}>
                          <td>{item.date_acquired}</td>
                          <td>{item.item_no}</td>
                          <td>{item.ics_no}</td>
                          <td>{item.description}</td>
                          <td className="text-end">{formatCurrency(item.amount)}</td>
                          <td>{item.condition}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted">No items</p>
              )}

              <Row className="g-3 my-4">
                <Col md={12}>
                  <div className="ptr-reason-box">
                    <span>Reason for Transfer</span>
                    <p>{selectedTransfer.reason_for_transfer || 'N/A'}</p>
                  </div>
                </Col>
              </Row>

              <div className="ptr-section-title">
                <h6>Approval Signatures</h6>
              </div>
              <Row className="g-3">
                <Col md={4}><div className="ptr-signature-card"><span>Approved By</span><strong>{selectedTransfer.approved_by || 'N/A'}</strong></div></Col>
                <Col md={4}><div className="ptr-signature-card"><span>Released/Issued By</span><strong>{selectedTransfer.released_issued_by || 'N/A'}</strong></div></Col>
                <Col md={4}><div className="ptr-signature-card"><span>Received By</span><strong>{selectedTransfer.received_by || 'N/A'}</strong></div></Col>
              </Row>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowViewModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>

      <Toast show={showToast} message={toastMessage} type={toastType} onClose={() => setShowToast(false)} />
    </Container>
  );
};

export default PropertyTransferReport;
