import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Form, Modal } from 'react-bootstrap';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';

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
  status: 'Draft' | 'Submitted';
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
    ret.entity_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <LoadingSpinner size="lg" text="Loading Property Return Slips..." />;

  return (
    <Container fluid className="py-4">
      {error && (
        <Row className="mb-3">
          <Col>
            <div className="alert alert-danger">{error}</div>
          </Col>
        </Row>
      )}

      {/* Header Section */}
      <Row className="mb-4 align-items-center">
        <Col md={6}>
          <h2 className="mb-0">Property Return Slip</h2>
          <p className="text-muted">Manage and track property returns</p>
        </Col>
        <Col md={6} className="text-end">
          <Button
            variant="primary"
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
            <i className="bi bi-plus-circle me-2"></i>
            New Return
          </Button>
        </Col>
      </Row>

      {/* Search Section */}
      <Row className="mb-4">
        <Col md={12}>
          <Form.Group>
            <Form.Control
              placeholder="Search by PRS No. or Entity Name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Form.Group>
        </Col>
      </Row>

      {/* Table Section */}
      <Row>
        <Col md={12}>
          <Card className="shadow-sm">
            <Card.Body>
              <div className="table-responsive">
                <Table striped hover>
                  <thead>
                    <tr>
                      <th>PRS No.</th>
                      <th>Entity Name</th>
                      <th>Return Type</th>
                      <th>Items</th>
                      <th>Returned Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReturns.length > 0 ? (
                      filteredReturns.map((ret) => (
                        <tr key={ret.id}>
                          <td>{ret.prs_no}</td>
                          <td>{ret.entity_name}</td>
                          <td>{ret.return_type}</td>
                          <td>{ret.items.length}</td>
                          <td>{ret.returned_date}</td>
                          <td>
                            <span className={`badge bg-${ret.status === 'Submitted' ? 'success' : 'warning'}`}>
                              {ret.status}
                            </span>
                          </td>
                          <td>
                            <Button
                              variant="info"
                              size="sm"
                              onClick={() => {
                                setSelectedReturn(ret);
                                setShowViewModal(true);
                              }}
                            >
                              <i className="bi bi-eye"></i> View
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="text-center py-4">
                          No property return slips found
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
      <Modal show={showModal} onHide={() => setShowModal(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>Property Return Slip</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            {/* Header with Entity Name and No. */}
            <Row className="mb-4 border-bottom pb-3">
              <Col md={8}>
                <Form.Group>
                  <Form.Label className="fw-bold">Entity Name:</Form.Label>
                  <Form.Control
                    value={currentReturn.entity_name}
                    onChange={(e) => setCurrentReturn({ ...currentReturn, entity_name: e.target.value })}
                    placeholder="Enter Entity Name"
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label className="fw-bold">No.</Form.Label>
                  <Form.Control
                    value={currentReturn.prs_no}
                    onChange={(e) => setCurrentReturn({ ...currentReturn, prs_no: e.target.value })}
                    placeholder="PRS No."
                  />
                </Form.Group>
              </Col>
            </Row>

            {/* Return Type Section */}
            <Row className="mb-4 border-bottom pb-3">
              <Col>
                <Form.Label className="fw-bold">Return Type (Check one)</Form.Label>
                <div className="ms-3">
                  <Form.Check
                    type="checkbox"
                    label="Unserviceable"
                    checked={currentReturn.return_type === 'Unserviceable'}
                    onChange={() => setCurrentReturn({ ...currentReturn, return_type: 'Unserviceable' })}
                  />
                  <Form.Check
                    type="checkbox"
                    label="No longer needed"
                    checked={currentReturn.return_type === 'No longer needed'}
                    onChange={() => setCurrentReturn({ ...currentReturn, return_type: 'No longer needed' })}
                  />
                  <Form.Check
                    type="checkbox"
                    label="Reassignment"
                    checked={currentReturn.return_type === 'Reassignment'}
                    onChange={() => setCurrentReturn({ ...currentReturn, return_type: 'Reassignment' })}
                  />
                  <div className="mt-2">
                    <Form.Check
                      type="checkbox"
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
                        className="ms-3 mt-1"
                        style={{ maxWidth: '300px' }}
                      />
                    )}
                  </div>
                </div>
              </Col>
            </Row>

            {/* Items Table Section */}
            <Card className="mb-4">
              <Card.Header className="bg-light">
                <Card.Title className="mb-0">Items</Card.Title>
              </Card.Header>
              <Card.Body>
                {/* Add Item Form */}
                <Row className="mb-3">
                  <Col md={2}>
                    <Form.Group className="mb-0">
                      <Form.Label className="small fw-bold">Date Acquired *</Form.Label>
                      <Form.Control
                        type="date"
                        value={newItem.date_acquired}
                        onChange={(e) => setNewItem({ ...newItem, date_acquired: e.target.value })}
                        size="sm"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={1}>
                    <Form.Group className="mb-0">
                      <Form.Label className="small fw-bold">Qty.</Form.Label>
                      <Form.Control
                        type="number"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })}
                        size="sm"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group className="mb-0">
                      <Form.Label className="small fw-bold">Unit</Form.Label>
                      <Form.Control
                        value={newItem.unit}
                        onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                        placeholder="Unit"
                        size="sm"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group className="mb-0">
                      <Form.Label className="small fw-bold">Property No. *</Form.Label>
                      <Form.Control
                        value={newItem.property_number}
                        onChange={(e) => setNewItem({ ...newItem, property_number: e.target.value })}
                        placeholder="Property No."
                        size="sm"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-0">
                      <Form.Label className="small fw-bold">Description *</Form.Label>
                      <Form.Control
                        value={newItem.item_description}
                        onChange={(e) => setNewItem({ ...newItem, item_description: e.target.value })}
                        placeholder="Description"
                        size="sm"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={1}>
                    <Form.Group className="mb-0">
                      <Form.Label className="small fw-bold">Amount</Form.Label>
                      <Form.Control
                        type="number"
                        value={newItem.amount}
                        onChange={(e) => setNewItem({ ...newItem, amount: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                        size="sm"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Row className="mb-3">
                  <Col className="text-end">
                    <Button
                      variant="success"
                      size="sm"
                      onClick={handleAddItem}
                    >
                      <i className="bi bi-plus-circle me-1"></i> Add Item
                    </Button>
                  </Col>
                </Row>

                {/* Items Table */}
                {currentReturn.items.length > 0 && (
                  <div className="table-responsive">
                    <Table striped size="sm" bordered>
                      <thead className="bg-light">
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
                            <td>{item.date_acquired}</td>
                            <td className="text-center">{item.quantity}</td>
                            <td>{item.unit}</td>
                            <td>{item.property_number}</td>
                            <td>{item.item_description}</td>
                            <td className="text-end">₱{item.amount.toFixed(2)}</td>
                            <td>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleRemoveItem(index)}
                              >
                                <i className="bi bi-trash"></i>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Card.Body>
            </Card>

            {/* Signature Section */}
            <Row className="mb-4 border-top pt-3">
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold">Signature / Printed Name</Form.Label>
                  <Form.Control
                    value={currentReturn.returned_by}
                    onChange={(e) => setCurrentReturn({ ...currentReturn, returned_by: e.target.value })}
                    placeholder="Signature / Printed Name"
                    size="sm"
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold">Designation / Office</Form.Label>
                  <Form.Control
                    value={currentReturn.returned_by_designation}
                    onChange={(e) => setCurrentReturn({ ...currentReturn, returned_by_designation: e.target.value })}
                    placeholder="Designation / Office"
                    size="sm"
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label className="small fw-bold">Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={currentReturn.returned_date}
                    onChange={(e) => setCurrentReturn({ ...currentReturn, returned_date: e.target.value })}
                    size="sm"
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label className="small fw-bold">Received By: (Property Unit) *</Form.Label>
                  <Form.Control
                    value={currentReturn.received_by}
                    onChange={(e) => setCurrentReturn({ ...currentReturn, received_by: e.target.value })}
                    placeholder="Received By"
                    size="sm"
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label className="small fw-bold">Noted By: (OIC, Supply & Property Office) *</Form.Label>
                  <Form.Control
                    value={currentReturn.noted_by}
                    onChange={(e) => setCurrentReturn({ ...currentReturn, noted_by: e.target.value })}
                    placeholder="Noted By"
                    size="sm"
                  />
                </Form.Group>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save
          </Button>
        </Modal.Footer>
      </Modal>

      {/* View Modal */}
      {selectedReturn && (
        <Modal show={showViewModal} onHide={() => setShowViewModal(false)} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>Property Return Slip - {selectedReturn.prs_no}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row className="mb-3">
              <Col md={8}>
                <p><strong>Entity Name:</strong> {selectedReturn.entity_name}</p>
              </Col>
              <Col md={4}>
                <p><strong>No.:</strong> {selectedReturn.prs_no}</p>
              </Col>
            </Row>
            <Row className="mb-3">
              <Col>
                <p><strong>Return Type:</strong> {selectedReturn.return_type}</p>
              </Col>
            </Row>

            <h6 className="mt-4 mb-3"><strong>Items</strong></h6>
            <div className="table-responsive">
              <Table striped bordered size="sm">
                <thead className="bg-light">
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
                      <td>{item.date_acquired}</td>
                      <td className="text-center">{item.quantity}</td>
                      <td>{item.unit}</td>
                      <td>{item.property_number}</td>
                      <td>{item.item_description}</td>
                      <td className="text-end">₱{item.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            <Row className="mt-4 pt-3 border-top">
              <Col md={4}>
                <p className="small"><strong>Returned By:</strong> {selectedReturn.returned_by}</p>
                <p className="small"><strong>Designation:</strong> {selectedReturn.returned_by_designation}</p>
                <p className="small"><strong>Date:</strong> {selectedReturn.returned_date}</p>
              </Col>
              <Col md={4}>
                <p className="small"><strong>Received By (Property Unit):</strong> {selectedReturn.received_by}</p>
              </Col>
              <Col md={4}>
                <p className="small"><strong>Noted By (OIC, Supply & Property):</strong> {selectedReturn.noted_by}</p>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowViewModal(false)}>
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
