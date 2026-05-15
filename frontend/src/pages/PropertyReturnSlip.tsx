import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Form, Modal } from 'react-bootstrap';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import './PropertyReturnSlip.css';

interface ReturnItem {
  date_acquired: string;
  quantity: number;
  unit: string;
  property_number: string;
  item_description: string;
  amount: number;
  remarks?: string;
}

interface PropertyReturn {
  id?: string;
  prs_no: string;
  entity_name: string;
  return_type: 'Unserviceable' | 'No longer needed' | 'Reassignment' | 'Others';
  return_type_others?: string;
  items: ReturnItem[];
  returned_by: string;
  returned_by_designation: string;
  returned_by_office: string;
  returned_date: string;
  received_by: string;
  noted_by: string;
  status: string;
}

const PropertyReturnSlip: React.FC = () => {
  const { user } = useAuth();
  const [returns, setReturns] = useState<PropertyReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<PropertyReturn | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [showToast, setShowToast] = useState(false);

  const [currentReturn, setCurrentReturn] = useState<PropertyReturn>({
    prs_no: '',
    entity_name: '',
    return_type: 'Unserviceable',
    return_type_others: '',
    items: [],
    returned_by: user?.full_name || '',
    returned_by_designation: '',
    returned_by_office: '',
    returned_date: new Date().toISOString().split('T')[0],
    received_by: '',
    noted_by: '',
    status: 'Draft'
  });

  const [newItem, setNewItem] = useState<ReturnItem>({
    date_acquired: '',
    quantity: 0,
    unit: '',
    property_number: '',
    item_description: '',
    amount: 0,
    remarks: ''
  });

  useEffect(() => {
    fetchPropertyReturns();
  }, []);

  const fetchPropertyReturns = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getPropertyReturnSlips();
      setReturns(data || []);
    } catch (err) {
      setError('Failed to load property return slips');
      console.error(err);
      setReturns([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    if (!newItem.date_acquired || !newItem.property_number || !newItem.item_description) {
      setToastMessage('Please fill in required item fields');
      setToastType('warning');
      setShowToast(true);
      return;
    }

    setCurrentReturn({
      ...currentReturn,
      items: [...currentReturn.items, newItem]
    });

    setNewItem({
      date_acquired: '',
      quantity: 0,
      unit: '',
      property_number: '',
      item_description: '',
      amount: 0,
      remarks: ''
    });
  };

  const handleRemoveItem = (index: number) => {
    setCurrentReturn({
      ...currentReturn,
      items: currentReturn.items.filter((_, i) => i !== index)
    });
  };

  const handleSave = async () => {
    try {
      if (!currentReturn.prs_no || !currentReturn.entity_name) {
        setToastMessage('Please fill in all required fields');
        setToastType('warning');
        setShowToast(true);
        return;
      }

      if (currentReturn.items.length === 0) {
        setToastMessage('Please add at least one item');
        setToastType('warning');
        setShowToast(true);
        return;
      }

      if (!currentReturn.received_by || !currentReturn.noted_by) {
        setToastMessage('Please fill in Received By and Noted By fields');
        setToastType('warning');
        setShowToast(true);
        return;
      }

      // Call API to save property return slip
      const { id, ...slipDataToSend } = currentReturn;
      await apiService.createPropertyReturnSlip(slipDataToSend);

      setToastMessage('Property Return Slip saved successfully');
      setToastType('success');
      setShowToast(true);
      setShowModal(false);
      
      // Reset form
      setCurrentReturn({
        prs_no: '',
        entity_name: '',
        return_type: 'Unserviceable',
        return_type_others: '',
        items: [],
        returned_by: user?.full_name || '',
        returned_by_designation: '',
        returned_by_office: '',
        returned_date: new Date().toISOString().split('T')[0],
        received_by: '',
        noted_by: '',
        status: 'Draft'
      });

      setNewItem({
        date_acquired: '',
        quantity: 0,
        unit: '',
        property_number: '',
        item_description: '',
        amount: 0,
        remarks: ''
      });

      fetchPropertyReturns();
    } catch (err) {
      setToastMessage('Failed to save property return slip');
      setToastType('error');
      setShowToast(true);
    }
  };

  const filteredReturns = returns.filter(ret =>
    ret.prs_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ret.entity_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ret.return_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (value?: string) => {
    if (!value) return 'Not set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  };

  const formatCurrency = (value?: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(value || 0);

  const getReturnTotal = (ret: PropertyReturn) =>
    ret.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const getStatusClass = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === 'submitted' || normalized === 'received') return 'is-submitted';
    if (normalized === 'draft') return 'is-draft';
    return 'is-neutral';
  };

  const submittedCount = returns.filter(ret => ['submitted', 'received'].includes(ret.status.toLowerCase())).length;
  const draftCount = returns.filter(ret => ret.status.toLowerCase() === 'draft').length;
  const itemCount = returns.reduce((sum, ret) => sum + ret.items.length, 0);

  if (loading) {
    return (
      <Container fluid className="prs-page py-4">
        <div className="prs-loading">
          <LoadingSpinner size="lg" text="Loading Property Return Slips..." />
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="prs-page py-4">
      {error && (
        <Row className="mb-3">
          <Col>
            <div className="alert alert-danger prs-alert">
              <i className="bi bi-exclamation-triangle me-2" aria-hidden="true"></i>
              {error}
            </div>
          </Col>
        </Row>
      )}

      <section className="prs-hero mb-4">
        <div className="prs-hero-copy">
          <span className="prs-eyebrow">Property accountability</span>
          <h2>Property Return Slip</h2>
          <p>Record returned assets, route them to the property unit, and keep each slip easy to audit.</p>
        </div>
        <Button
          className="prs-primary-action"
          onClick={() => {
            setCurrentReturn({
              prs_no: '',
              entity_name: '',
              return_type: 'Unserviceable',
              return_type_others: '',
              items: [],
              returned_by: user?.full_name || '',
              returned_by_designation: '',
              returned_by_office: '',
              returned_date: new Date().toISOString().split('T')[0],
              received_by: '',
              noted_by: '',
              status: 'Draft'
            });
            setNewItem({
              date_acquired: '',
              quantity: 0,
              unit: '',
              property_number: '',
              item_description: '',
              amount: 0,
              remarks: ''
            });
            setShowModal(true);
          }}
        >
          <i className="bi bi-plus-circle" aria-hidden="true"></i>
          New Return
        </Button>
      </section>

      <Row className="g-3 mb-4">
        <Col md={6} xl={3}>
          <Card className="prs-stat-card">
            <Card.Body>
              <span>Total slips</span>
              <strong>{returns.length}</strong>
              <small>All property returns on record</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} xl={3}>
          <Card className="prs-stat-card">
            <Card.Body>
              <span>Received or submitted</span>
              <strong>{submittedCount}</strong>
              <small>Ready for property unit review</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} xl={3}>
          <Card className="prs-stat-card">
            <Card.Body>
              <span>Draft slips</span>
              <strong>{draftCount}</strong>
              <small>Still being prepared</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} xl={3}>
          <Card className="prs-stat-card">
            <Card.Body>
              <span>Returned items</span>
              <strong>{itemCount}</strong>
              <small>Items listed across slips</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Table Section */}
      <Row>
        <Col md={12}>
          <Card className="prs-table-card shadow-sm">
            <Card.Header>
              <div>
                <h5>Return slips</h5>
                <p>{filteredReturns.length} of {returns.length} records shown</p>
              </div>
              <Form.Group className="prs-search">
                <i className="bi bi-search" aria-hidden="true"></i>
                <Form.Control
                  placeholder="Search PRS no., entity, or return type"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </Form.Group>
            </Card.Header>
            <Card.Body>
              <div className="table-responsive">
                <Table hover className="prs-table">
                  <thead>
                    <tr>
                      <th>PRS No.</th>
                      <th>Entity Name</th>
                      <th>Return Type</th>
                      <th>Items</th>
                      <th>Total Amount</th>
                      <th>Returned Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReturns.length > 0 ? (
                      filteredReturns.map((ret) => (
                        <tr key={ret.id || ret.prs_no}>
                          <td>
                            <strong className="prs-number">{ret.prs_no}</strong>
                          </td>
                          <td>
                            <div className="prs-entity">{ret.entity_name}</div>
                          </td>
                          <td>
                            <span className="prs-type">{ret.return_type}</span>
                          </td>
                          <td>{ret.items.length}</td>
                          <td>{formatCurrency(getReturnTotal(ret))}</td>
                          <td>{formatDate(ret.returned_date)}</td>
                          <td>
                            <span className={`badge prs-status ${getStatusClass(ret.status)}`}>
                              {ret.status}
                            </span>
                          </td>
                          <td>
                            <Button
                              size="sm"
                              className="prs-view-btn"
                              onClick={() => {
                                setSelectedReturn(ret);
                                setShowViewModal(true);
                              }}
                              aria-label={`View ${ret.prs_no}`}
                            >
                              <i className="bi bi-eye" aria-hidden="true"></i>
                              View
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8}>
                          <div className="prs-empty-state">
                            <i className="bi bi-inbox" aria-hidden="true"></i>
                            <h5>No property return slips found</h5>
                            <p>
                              {searchTerm
                                ? 'Try another search term or clear the search field.'
                                : 'Create a new return slip when property is returned to the property unit.'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Create/Edit Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="xl" className="prs-modal">
        <Modal.Header closeButton>
          <Modal.Title>
            <span>Create document</span>
            <strong>Property Return Slip</strong>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <div className="prs-form-section">
              <div>
                <h6>Slip details</h6>
                <p>Identify the accountable entity and return classification.</p>
              </div>
            </div>

            <Row className="mb-4 g-3">
              <Col md={8}>
                <Form.Group>
                  <Form.Label className="prs-form-label">Entity Name</Form.Label>
                  <Form.Control
                    value={currentReturn.entity_name}
                    onChange={(e) => setCurrentReturn({ ...currentReturn, entity_name: e.target.value })}
                    placeholder="Enter entity name"
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label className="prs-form-label">PRS No.</Form.Label>
                  <Form.Control
                    value={currentReturn.prs_no}
                    onChange={(e) => setCurrentReturn({ ...currentReturn, prs_no: e.target.value })}
                    placeholder="PRS No."
                  />
                </Form.Group>
              </Col>
            </Row>

            {/* Return Type Section */}
            <Row className="mb-4">
              <Col>
                <Form.Label className="prs-form-label">Return Type</Form.Label>
                <div className="prs-return-type-grid">
                  <Form.Check
                    type="radio"
                    name="returnType"
                    label="Unserviceable"
                    checked={currentReturn.return_type === 'Unserviceable'}
                    onChange={() => setCurrentReturn({ ...currentReturn, return_type: 'Unserviceable' })}
                  />
                  <Form.Check
                    type="radio"
                    name="returnType"
                    label="No longer needed"
                    checked={currentReturn.return_type === 'No longer needed'}
                    onChange={() => setCurrentReturn({ ...currentReturn, return_type: 'No longer needed' })}
                  />
                  <Form.Check
                    type="radio"
                    name="returnType"
                    label="Reassignment"
                    checked={currentReturn.return_type === 'Reassignment'}
                    onChange={() => setCurrentReturn({ ...currentReturn, return_type: 'Reassignment' })}
                  />
                  <div>
                    <Form.Check
                      type="radio"
                      name="returnType"
                      label="Others (Specify)"
                      checked={currentReturn.return_type === 'Others'}
                      onChange={() => setCurrentReturn({ ...currentReturn, return_type: 'Others' })}
                    />
                    {currentReturn.return_type === 'Others' && (
                      <Form.Control
                        size="sm"
                        value={currentReturn.return_type_others || ''}
                        onChange={(e) => setCurrentReturn({ ...currentReturn, return_type_others: e.target.value })}
                        placeholder="Specify"
                        className="mt-2"
                      />
                    )}
                  </div>
                </div>
              </Col>
            </Row>

            {/* Items Table Section */}
            <Card className="prs-items-card mb-4">
              <Card.Header>
                <div>
                  <Card.Title className="mb-0">Returned items</Card.Title>
                  <p>Add each property item included in this slip.</p>
                </div>
              </Card.Header>
              <Card.Body>
                {/* Add Item Form */}
                <Row className="g-3 mb-3">
                  <Col md={6} xl={2}>
                    <Form.Group>
                      <Form.Label className="prs-form-label">Date Acquired *</Form.Label>
                      <Form.Control
                        type="date"
                        value={newItem.date_acquired}
                        onChange={(e) => setNewItem({ ...newItem, date_acquired: e.target.value })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6} xl={1}>
                    <Form.Group>
                      <Form.Label className="prs-form-label">Qty.</Form.Label>
                      <Form.Control
                        type="number"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6} xl={2}>
                    <Form.Group>
                      <Form.Label className="prs-form-label">Unit</Form.Label>
                      <Form.Control
                        value={newItem.unit}
                        onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                        placeholder="Unit"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6} xl={2}>
                    <Form.Group>
                      <Form.Label className="prs-form-label">Property No. *</Form.Label>
                      <Form.Control
                        value={newItem.property_number}
                        onChange={(e) => setNewItem({ ...newItem, property_number: e.target.value })}
                        placeholder="Property No."
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6} xl={3}>
                    <Form.Group>
                      <Form.Label className="prs-form-label">Description *</Form.Label>
                      <Form.Control
                        value={newItem.item_description}
                        onChange={(e) => setNewItem({ ...newItem, item_description: e.target.value })}
                        placeholder="Description"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6} xl={2}>
                    <Form.Group>
                      <Form.Label className="prs-form-label">Amount</Form.Label>
                      <Form.Control
                        type="number"
                        value={newItem.amount}
                        onChange={(e) => setNewItem({ ...newItem, amount: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <div className="prs-add-item-row">
                  <Button className="prs-add-item-btn" onClick={handleAddItem}>
                    <i className="bi bi-plus-circle" aria-hidden="true"></i>
                    Add Item
                  </Button>
                </div>

                {/* Items Table */}
                {currentReturn.items.length > 0 ? (
                  <div className="table-responsive">
                    <Table size="sm" className="prs-detail-table">
                      <thead>
                        <tr>
                          <th>Date Acquired</th>
                          <th>Qty.</th>
                          <th>Unit</th>
                          <th>Property No.</th>
                          <th>Description</th>
                          <th>Amount</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentReturn.items.map((item, index) => (
                          <tr key={index}>
                            <td>{formatDate(item.date_acquired)}</td>
                            <td className="text-center">{item.quantity}</td>
                            <td>{item.unit}</td>
                            <td>{item.property_number}</td>
                            <td>{item.item_description}</td>
                            <td className="text-end">{formatCurrency(item.amount)}</td>
                            <td>
                              <Button
                                size="sm"
                                className="prs-remove-btn"
                                onClick={() => handleRemoveItem(index)}
                                aria-label={`Remove ${item.property_number}`}
                              >
                                <i className="bi bi-trash" aria-hidden="true"></i>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                ) : (
                  <div className="prs-inline-empty">
                    <i className="bi bi-box-seam" aria-hidden="true"></i>
                    <span>No items added yet.</span>
                  </div>
                )}
              </Card.Body>
            </Card>

            {/* Signature Section */}
            <div className="prs-form-section">
              <div>
                <h6>Signatories</h6>
                <p>Complete the returned, received, and noted-by details.</p>
              </div>
            </div>

            <Row className="mb-4 g-3">
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label className="prs-form-label">Signature / Printed Name</Form.Label>
                  <Form.Control
                    value={currentReturn.returned_by}
                    onChange={(e) => setCurrentReturn({ ...currentReturn, returned_by: e.target.value })}
                    placeholder="Signature / Printed Name"
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label className="prs-form-label">Designation / Office</Form.Label>
                  <Form.Control
                    value={currentReturn.returned_by_designation}
                    onChange={(e) => setCurrentReturn({ ...currentReturn, returned_by_designation: e.target.value })}
                    placeholder="Designation / Office"
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label className="prs-form-label">Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={currentReturn.returned_date}
                    onChange={(e) => setCurrentReturn({ ...currentReturn, returned_date: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label className="prs-form-label">Received By: Property Unit *</Form.Label>
                  <Form.Control
                    value={currentReturn.received_by}
                    onChange={(e) => setCurrentReturn({ ...currentReturn, received_by: e.target.value })}
                    placeholder="Received By"
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label className="prs-form-label">Noted By: OIC, Supply & Property *</Form.Label>
                  <Form.Control
                    value={currentReturn.noted_by}
                    onChange={(e) => setCurrentReturn({ ...currentReturn, noted_by: e.target.value })}
                    placeholder="Noted By"
                  />
                </Form.Group>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button className="prs-primary-action" onClick={handleSave}>
            <i className="bi bi-check2-circle" aria-hidden="true"></i>
            Save
          </Button>
        </Modal.Footer>
      </Modal>

      {/* View Modal */}
      {selectedReturn && (
        <Modal show={showViewModal} onHide={() => setShowViewModal(false)} size="lg" className="prs-modal">
          <Modal.Header closeButton>
            <Modal.Title>
              <span>Property Return Slip</span>
              <strong>{selectedReturn.prs_no}</strong>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="prs-document-heading">
              <div>
                <span>Entity Name</span>
                <h3>{selectedReturn.entity_name}</h3>
              </div>
              <span className={`badge prs-status ${getStatusClass(selectedReturn.status)}`}>
                {selectedReturn.status}
              </span>
            </div>

            <Row className="g-3 mb-4">
              <Col md={4}>
                <div className="prs-detail-tile">
                  <span>PRS No.</span>
                  <strong>{selectedReturn.prs_no}</strong>
                </div>
              </Col>
              <Col md={4}>
                <div className="prs-detail-tile">
                  <span>Return Type</span>
                  <strong>
                    {selectedReturn.return_type === 'Others' && selectedReturn.return_type_others
                      ? selectedReturn.return_type_others
                      : selectedReturn.return_type}
                  </strong>
                </div>
              </Col>
              <Col md={4}>
                <div className="prs-detail-tile">
                  <span>Returned Date</span>
                  <strong>{formatDate(selectedReturn.returned_date)}</strong>
                </div>
              </Col>
            </Row>

            <div className="prs-section-title">
              <h6>Items</h6>
              <span>{selectedReturn.items.length} listed</span>
            </div>
            <div className="table-responsive">
              <Table size="sm" className="prs-detail-table">
                <thead>
                  <tr>
                    <th>Date Acquired</th>
                    <th>Qty.</th>
                    <th>Unit</th>
                    <th>Property No.</th>
                    <th>Description</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReturn.items.map((item, index) => (
                    <tr key={index}>
                      <td>{formatDate(item.date_acquired)}</td>
                      <td className="text-center">{item.quantity}</td>
                      <td>{item.unit}</td>
                      <td>{item.property_number}</td>
                      <td>{item.item_description}</td>
                      <td className="text-end">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            <Row className="mt-4 g-3">
              <Col md={4}>
                <div className="prs-person-panel">
                  <span>Returned By</span>
                  <strong>{selectedReturn.returned_by || 'Not set'}</strong>
                  <small>{selectedReturn.returned_by_designation || 'Designation not set'}</small>
                  <small>{formatDate(selectedReturn.returned_date)}</small>
                </div>
              </Col>
              <Col md={4}>
                <div className="prs-person-panel">
                  <span>Received By</span>
                  <strong>{selectedReturn.received_by || 'Not set'}</strong>
                  <small>Property Unit</small>
                </div>
              </Col>
              <Col md={4}>
                <div className="prs-person-panel">
                  <span>Noted By</span>
                  <strong>{selectedReturn.noted_by || 'Not set'}</strong>
                  <small>OIC, Supply & Property</small>
                </div>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowViewModal(false)}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      <Toast
        message={toastMessage}
        type={toastType}
        show={showToast}
        onClose={() => setShowToast(false)}
      />
    </Container>
  );
};

export default PropertyReturnSlip;
