import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Form, Modal } from 'react-bootstrap';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';

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

const PropertyTransferReport: React.FC = () => {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<PropertyTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<PropertyTransfer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [showToast, setShowToast] = useState(false);

  const [currentTransfer, setCurrentTransfer] = useState<PropertyTransfer>({
    itr_no: '',
    entity_name: '',
    fund_cluster: '',
    transfer_type: 'Reassignment',
    transfer_type_others: '',
    items: [],
    reason_for_transfer: '',
    approved_by: '',
    released_issued_by: user?.full_name || '',
    received_by: '',
    date: new Date().toISOString().split('T')[0],
    status: 'Draft'
  });

  const [newItem, setNewItem] = useState<TransferItem>({
    date_acquired: '',
    item_no: '',
    ics_no: '',
    description: '',
    amount: 0,
    condition: 'Good'
  });

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

    setNewItem({
      date_acquired: '',
      item_no: '',
      ics_no: '',
      description: '',
      amount: 0,
      condition: 'Good'
    });
  };

  const handleRemoveItem = (index: number) => {
    setCurrentTransfer({
      ...currentTransfer,
      items: currentTransfer.items.filter((_, i) => i !== index)
    });
  };

  const handleViewTransfer = (transfer: PropertyTransfer) => {
    setSelectedTransfer(transfer);
    setShowViewModal(true);
  };

  const handleSubmit = async () => {
    try {
      if (!currentTransfer.entity_name || currentTransfer.items.length === 0) {
        setToastMessage('Please fill in all required fields and add at least one item');
        setToastType('warning');
        setShowToast(true);
        return;
      }

      const itrNo = currentTransfer.itr_no || `PTR-${new Date().getFullYear()}-${String(transfers.length + 1).padStart(4, '0')}`;
      const transferData = {
        ...currentTransfer,
        itr_no: itrNo
      };

      await apiService.createPropertyTransferReport(transferData);

      setToastMessage('Property Transfer Report created successfully');
      setToastType('success');
      setShowToast(true);
      setShowModal(false);
      
      setCurrentTransfer({
        itr_no: '',
        entity_name: '',
        fund_cluster: '',
        transfer_type: 'Reassignment',
        transfer_type_others: '',
        items: [],
        reason_for_transfer: '',
        approved_by: '',
        released_issued_by: user?.full_name || '',
        received_by: '',
        date: new Date().toISOString().split('T')[0],
        status: 'Draft'
      });
      
      fetchTransfers();
    } catch (err: any) {
      console.error('Error submitting transfer:', err);
      setToastMessage(err?.message || 'Error creating property transfer report');
      setToastType('error');
      setShowToast(true);
    }
  };

  const filteredTransfers = transfers.filter((transfer: any) =>
    transfer.itr_no?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
    transfer.entity_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <LoadingSpinner size="lg" text="Loading property transfer reports..." />;
  }

  return (
    <Container fluid className="py-4">
      {error && <Toast message={error} type="error" show={!!error} onClose={() => setError(null)} />}

      <Row className="mb-4">
        <Col>
          <h1 className="mb-2">Property Transfer Report</h1>
          <p className="text-muted">Manage and track property transfers between custodians</p>
        </Col>
        <Col xs="auto">
          <Button 
            variant="primary" 
            onClick={() => setShowModal(true)}
            className="d-flex align-items-center gap-2"
          >
            <i className="bi bi-plus-lg"></i>
            New Transfer
          </Button>
        </Col>
      </Row>

      <Card>
        <Card.Body>
          <Form className="mb-4">
            <Form.Group>
              <Form.Control
                placeholder="Search by PTR No. or Entity Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-control-sm"
              />
            </Form.Group>
          </Form>

          {filteredTransfers.length > 0 ? (
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>PTR No.</th>
                  <th>Entity Name</th>
                  <th>Transfer Type</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransfers.map((transfer: any) => (
                  <tr key={transfer.id || transfer.itr_no}>
                    <td>{transfer.itr_no}</td>
                    <td>{transfer.entity_name}</td>
                    <td>{transfer.transfer_type}</td>
                    <td>{transfer.date}</td>
                    <td>{transfer.items?.length || 0}</td>
                    <td>
                      <span className={`badge bg-${transfer.status === 'Submitted' ? 'success' : 'warning'}`}>
                        {transfer.status}
                      </span>
                    </td>
                    <td>
                      <Button 
                        variant="info" 
                        size="sm"
                        onClick={() => handleViewTransfer(transfer)}
                      >
                        <i className="bi bi-eye me-1"></i>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <div className="text-center py-5">
              <p className="text-muted">No property transfer reports found. Create a new one to get started.</p>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Create New Transfer Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title>
            <i className="bi bi-file-earmark-text me-2"></i>
            New Property Transfer Report
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            {/* Header */}
            <div className="text-center mb-4 pb-2 border-bottom">
              <h5 className="mb-0">PROPERTY TRANSFER REPORT</h5>
            </div>

            {/* Entity and PTR Info */}
            <Row className="mb-3">
              <Col md={8}>
                <Form.Group>
                  <Form.Label className="small"><strong>Entity Name *</strong></Form.Label>
                  <Form.Control
                    type="text"
                    size="sm"
                    value={currentTransfer.entity_name}
                    onChange={(e) => setCurrentTransfer({ ...currentTransfer, entity_name: e.target.value })}
                    placeholder="e.g., CAVITE STATE UNIVERSITY"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label className="small"><strong>Fund Cluster</strong></Form.Label>
                  <Form.Control
                    type="text"
                    size="sm"
                    value={currentTransfer.fund_cluster}
                    onChange={(e) => setCurrentTransfer({ ...currentTransfer, fund_cluster: e.target.value })}
                    placeholder="Fund Cluster"
                  />
                </Form.Group>
              </Col>
            </Row>

            {/* From and To Accountable Officer */}
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="small"><strong>From Accountable Officer/Agency/Fund Cluster *</strong></Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    size="sm"
                    value={currentTransfer.approved_by}
                    onChange={(e) => setCurrentTransfer({ ...currentTransfer, approved_by: e.target.value })}
                    placeholder="Name and designation"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="small"><strong>To Accountable Officer/Agency/Fund Cluster *</strong></Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    size="sm"
                    value={currentTransfer.received_by}
                    onChange={(e) => setCurrentTransfer({ ...currentTransfer, received_by: e.target.value })}
                    placeholder="Name and designation"
                  />
                </Form.Group>
              </Col>
            </Row>

            {/* PTR No. and Date */}
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="small"><strong>PTR No.</strong></Form.Label>
                  <Form.Control
                    type="text"
                    size="sm"
                    value={currentTransfer.itr_no}
                    onChange={(e) => setCurrentTransfer({ ...currentTransfer, itr_no: e.target.value })}
                    placeholder="Auto-generated if blank"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="small"><strong>Date *</strong></Form.Label>
                  <Form.Control
                    type="date"
                    size="sm"
                    value={currentTransfer.date}
                    onChange={(e) => setCurrentTransfer({ ...currentTransfer, date: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            {/* Transfer Type */}
            <Row className="mb-3">
              <Col>
                <Form.Group>
                  <Form.Label className="small"><strong>Transfer Type (check only one) *</strong></Form.Label>
                  <div className="ms-3">
                    <Form.Check
                      type="radio"
                      id="transfer_donation"
                      label="☐ Donation"
                      name="transfer_type"
                      value="Donation"
                      checked={currentTransfer.transfer_type === 'Donation'}
                      onChange={(e) => setCurrentTransfer({ ...currentTransfer, transfer_type: e.target.value as any })}
                    />
                    <Form.Check
                      type="radio"
                      id="transfer_reassignment"
                      label="☐ Reassignment"
                      name="transfer_type"
                      value="Reassignment"
                      checked={currentTransfer.transfer_type === 'Reassignment'}
                      onChange={(e) => setCurrentTransfer({ ...currentTransfer, transfer_type: e.target.value as any })}
                    />
                    <Form.Check
                      type="radio"
                      id="transfer_relocate"
                      label="☐ Relocate"
                      name="transfer_type"
                      value="Relocate"
                      checked={currentTransfer.transfer_type === 'Relocate'}
                      onChange={(e) => setCurrentTransfer({ ...currentTransfer, transfer_type: e.target.value as any })}
                    />
                    <div className="d-flex gap-2 align-items-center">
                      <Form.Check
                        type="radio"
                        id="transfer_others"
                        label="☐ Others (Specify)"
                        name="transfer_type"
                        value="Others"
                        checked={currentTransfer.transfer_type === 'Others'}
                        onChange={(e) => setCurrentTransfer({ ...currentTransfer, transfer_type: e.target.value as any })}
                      />
                      {currentTransfer.transfer_type === 'Others' && (
                        <Form.Control
                          type="text"
                          size="sm"
                          style={{ width: '200px' }}
                          value={currentTransfer.transfer_type_others}
                          onChange={(e) => setCurrentTransfer({ ...currentTransfer, transfer_type_others: e.target.value })}
                          placeholder="Specify"
                        />
                      )}
                    </div>
                  </div>
                </Form.Group>
              </Col>
            </Row>

            {/* Items Table */}
            <div className="mb-3">
              <Form.Label className="small"><strong>Items to be Transferred *</strong></Form.Label>
              
              {/* Add Item Form */}
              <Card className="mb-3 p-3 bg-light">
                <Row>
                  <Col md={2}>
                    <Form.Group>
                      <Form.Label className="small">Date Acquired</Form.Label>
                      <Form.Control
                        type="date"
                        size="sm"
                        value={newItem.date_acquired}
                        onChange={(e) => setNewItem({ ...newItem, date_acquired: e.target.value })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group>
                      <Form.Label className="small">Item No.</Form.Label>
                      <Form.Control
                        type="text"
                        size="sm"
                        value={newItem.item_no}
                        onChange={(e) => setNewItem({ ...newItem, item_no: e.target.value })}
                        placeholder="e.g., 1 pc"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group>
                      <Form.Label className="small">ICS No./Date</Form.Label>
                      <Form.Control
                        type="text"
                        size="sm"
                        value={newItem.ics_no}
                        onChange={(e) => setNewItem({ ...newItem, ics_no: e.target.value })}
                        placeholder="ICS No./Date"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label className="small">Description</Form.Label>
                      <Form.Control
                        type="text"
                        size="sm"
                        value={newItem.description}
                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                        placeholder="Item description"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={1}>
                    <Form.Group>
                      <Form.Label className="small">Amount</Form.Label>
                      <Form.Control
                        type="number"
                        size="sm"
                        value={newItem.amount}
                        onChange={(e) => setNewItem({ ...newItem, amount: parseFloat(e.target.value) || 0 })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group>
                      <Form.Label className="small">Condition</Form.Label>
                      <Form.Select
                        size="sm"
                        value={newItem.condition}
                        onChange={(e) => setNewItem({ ...newItem, condition: e.target.value })}
                      >
                        <option value="Good">Good</option>
                        <option value="Fair">Fair</option>
                        <option value="Poor">Poor</option>
                        <option value="For Repair">For Repair</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
                <Button 
                  variant="outline-primary" 
                  size="sm"
                  onClick={handleAddItem}
                >
                  <i className="bi bi-plus me-1"></i>Add Item
                </Button>
              </Card>

              <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <Table striped bordered hover size="sm" className="mb-0">
                  <thead>
                    <tr>
                      <th className="text-center" style={{ width: '90px' }}>Date Acquired</th>
                      <th className="text-center" style={{ width: '80px' }}>Item No.</th>
                      <th className="text-center" style={{ width: '100px' }}>ICS No./Date</th>
                      <th>Description</th>
                      <th className="text-center" style={{ width: '100px' }}>Amount</th>
                      <th className="text-center" style={{ width: '120px' }}>Condition of Inventory</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentTransfer.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="text-center">{item.date_acquired}</td>
                        <td className="text-center">{item.item_no}</td>
                        <td className="text-center">{item.ics_no}</td>
                        <td>{item.description}</td>
                        <td className="text-center">{item.amount}</td>
                        <td className="text-center">
                          <div className="d-flex justify-content-between align-items-center">
                            <span>{item.condition}</span>
                            <Button 
                              variant="danger" 
                              size="sm"
                              onClick={() => {
                                const updated = currentTransfer.items.filter((_, i) => i !== idx);
                                setCurrentTransfer({ ...currentTransfer, items: updated });
                              }}
                              className="ms-2"
                            >
                              <i className="bi bi-trash"></i>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </div>

            {/* Reason for Transfer */}
            <Form.Group className="mb-3">
              <Form.Label className="small"><strong>Reason for Transfer</strong></Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                size="sm"
                value={currentTransfer.reason_for_transfer}
                onChange={(e) => setCurrentTransfer({ ...currentTransfer, reason_for_transfer: e.target.value })}
                placeholder="Reason for transfer"
              />
            </Form.Group>

            {/* Approval Section */}
            <div className="border-top pt-3">
              <Row className="text-center">
                <Col md={4}>
                  <div className="mb-2">
                    <small><strong>Approved by:</strong></small>
                    <div style={{ height: '60px', border: '1px solid #dee2e6', marginBottom: '5px' }}></div>
                    <Form.Control
                      type="text"
                      size="sm"
                      value={currentTransfer.approved_by}
                      onChange={(e) => setCurrentTransfer({ ...currentTransfer, approved_by: e.target.value })}
                      placeholder="Printed Name"
                      className="mb-1"
                    />
                    <Form.Control
                      type="text"
                      size="sm"
                      placeholder="Designation"
                      className="mb-1"
                    />
                    <Form.Control
                      type="date"
                      size="sm"
                      placeholder="Date"
                    />
                  </div>
                </Col>
                <Col md={4}>
                  <div className="mb-2">
                    <small><strong>Released/Issued by:</strong></small>
                    <div style={{ height: '60px', border: '1px solid #dee2e6', marginBottom: '5px' }}></div>
                    <Form.Control
                      type="text"
                      size="sm"
                      value={currentTransfer.released_issued_by}
                      onChange={(e) => setCurrentTransfer({ ...currentTransfer, released_issued_by: e.target.value })}
                      placeholder="Printed Name"
                      className="mb-1"
                    />
                    <Form.Control
                      type="text"
                      size="sm"
                      placeholder="Designation"
                      className="mb-1"
                    />
                    <Form.Control
                      type="date"
                      size="sm"
                      placeholder="Date"
                    />
                  </div>
                </Col>
                <Col md={4}>
                  <div className="mb-2">
                    <small><strong>Received by:</strong></small>
                    <div style={{ height: '60px', border: '1px solid #dee2e6', marginBottom: '5px' }}></div>
                    <Form.Control
                      type="text"
                      size="sm"
                      value={currentTransfer.received_by}
                      onChange={(e) => setCurrentTransfer({ ...currentTransfer, received_by: e.target.value })}
                      placeholder="Printed Name"
                      className="mb-1"
                    />
                    <Form.Control
                      type="text"
                      size="sm"
                      placeholder="Designation"
                      className="mb-1"
                    />
                    <Form.Control
                      type="date"
                      size="sm"
                      placeholder="Date"
                    />
                  </div>
                </Col>
              </Row>
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            <i className="bi bi-check-circle me-2"></i>
            Save Transfer Report
          </Button>
        </Modal.Footer>
      </Modal>

      {/* View Transfer Modal */}
      <Modal show={showViewModal} onHide={() => setShowViewModal(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-info text-white">
          <Modal.Title>
            <i className="bi bi-file-earmark-text me-2"></i>
            Transfer Report Details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedTransfer && (
            <div>
              <Row className="mb-3">
                <Col md={6}>
                  <strong>PTR No.:</strong> {selectedTransfer.itr_no}
                </Col>
                <Col md={6}>
                  <strong>Date:</strong> {selectedTransfer.date}
                </Col>
              </Row>
              <Row className="mb-3">
                <Col md={6}>
                  <strong>Entity Name:</strong> {selectedTransfer.entity_name}
                </Col>
                <Col md={6}>
                  <strong>Fund Cluster:</strong> {selectedTransfer.fund_cluster}
                </Col>
              </Row>
              <Row className="mb-3">
                <Col md={6}>
                  <strong>Transfer Type:</strong> {selectedTransfer.transfer_type}
                </Col>
                <Col md={6}>
                  <strong>Status:</strong> 
                  <span className={`ms-2 badge bg-${selectedTransfer.status === 'Submitted' ? 'success' : 'warning'}`}>
                    {selectedTransfer.status}
                  </span>
                </Col>
              </Row>
              <hr />
              <h6 className="mb-3"><i className="bi bi-list me-2"></i>Items</h6>
              {selectedTransfer.items?.length ? (
                <Table striped bordered hover size="sm" responsive>
                  <thead>
                    <tr>
                      <th>Date Acquired</th>
                      <th>Item No.</th>
                      <th>ICS No.</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Condition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTransfer.items.map((item: TransferItem, idx: number) => (
                      <tr key={idx}>
                        <td>{item.date_acquired}</td>
                        <td>{item.item_no}</td>
                        <td>{item.ics_no}</td>
                        <td>{item.description}</td>
                        <td>₱{item.amount.toLocaleString()}</td>
                        <td>{item.condition}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <p className="text-muted">No items</p>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowViewModal(false)}>
            Close
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

export default PropertyTransferReport;
