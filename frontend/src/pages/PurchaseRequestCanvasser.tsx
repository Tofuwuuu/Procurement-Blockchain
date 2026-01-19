import React, { useEffect, useState } from 'react';
import { Container, Table, Card, Badge, Button, Modal, Form, Row, Col, InputGroup } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { apiService, PurchaseRequest } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';

/**
 * Purchase Request list for canvassers (and admins if needed).
 * Pulls real-time data from MongoDB-backed backend via /api/purchase-requests.
 */
const PurchaseRequestCanvasser: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [formData, setFormData] = useState({
    entity_name: user?.full_name || user?.username || '',
    fund_cluster: '',
    office_section: user?.department || 'General',
    responsibility_center_code: '',
    date: new Date().toISOString().split('T')[0],
    remark: '',
    items: Array(3).fill(null).map(() => ({
      unit: '',
      item_description: '',
      quantity: 0,
      unit_cost: 0,
      total_cost: 0
    }))
  });
  const [errors, setErrors] = useState<{ items?: string; entity_name?: string; office_section?: string }>({});

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await apiService.getPurchaseRequests(false); // canvasser sees all
      setRequests(data);
    } catch (err: any) {
      console.error('Failed to load purchase requests (canvasser):', err);
      setToastMessage(err.response?.data?.message || 'Failed to load purchase requests');
      setToastType('error');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: string; text: string }> = {
      Pending: { variant: 'warning', text: 'Pending' },
      Approved: { variant: 'success', text: 'Approved' },
      Draft: { variant: 'secondary', text: 'Draft' },
      Completed: { variant: 'primary', text: 'Completed' },
    };
    const config = statusConfig[status] || { variant: 'secondary', text: status };
    return <Badge bg={config.variant}>{config.text}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const items = [...formData.items];
    const numericFields = ['quantity', 'unit_cost', 'total_cost'];
    const parsedValue = numericFields.includes(field) ? Number(value) || 0 : value;
    items[index] = {
      ...items[index],
      [field]: parsedValue,
    };
    // Keep total_cost in sync if quantity/unit_cost updated
    if (field === 'quantity' || field === 'unit_cost') {
      const qty = Number(items[index].quantity) || 0;
      const cost = Number(items[index].unit_cost) || 0;
      items[index].total_cost = qty * cost;
    }
    setFormData({ ...formData, items });
  };

  const openUpdateModal = (req: PurchaseRequest) => {
    setSelectedRequest(req);
    setShowUpdateModal(true);
  };

  const validateForm = () => {
    const errs: typeof errors = {};
    if (!formData.entity_name.trim()) errs.entity_name = 'Entity/Requested By is required';
    if (!formData.office_section.trim()) errs.office_section = 'Office/Section is required';

    const validItems = formData.items.filter(
      (i) => i.item_description && i.quantity > 0 && i.unit_cost >= 0
    );
    if (validItems.length === 0) {
      errs.items = 'Add at least one item with description and quantity';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      setSubmitting(true);
      const payload = {
        ...formData,
        remark: formData.remark || formData.fund_cluster || 'No remarks',
        items: formData.items
          .filter((i) => i.item_description && i.quantity > 0)
          .map((i) => ({
            unit: i.unit,
            item_description: i.item_description,
            quantity: i.quantity,
            unit_cost: i.unit_cost,
            total_cost: i.total_cost || (i.quantity || 0) * (i.unit_cost || 0),
          })),
      };
      await apiService.createPurchaseRequest(payload);
      setToastMessage('Purchase request submitted');
      setToastType('success');
      setShowToast(true);
      setShowModal(false);
      await loadRequests();
      // reset form
      setFormData({
        entity_name: user?.full_name || user?.username || '',
        fund_cluster: '',
        office_section: user?.department || 'General',
        responsibility_center_code: '',
        date: new Date().toISOString().split('T')[0],
        remark: '',
        items: Array(3).fill(null).map(() => ({
          unit: '',
          item_description: '',
          quantity: 0,
          unit_cost: 0,
          total_cost: 0
        }))
      });
      setErrors({});
    } catch (err: any) {
      console.error('Failed to submit purchase request:', err);
      setToastMessage(err.response?.data?.message || 'Failed to submit purchase request');
      setToastType('error');
      setShowToast(true);
    } finally {
      setSubmitting(false);
    }
  };

  const addItemRow = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { unit: '', item_description: '', quantity: 0, unit_cost: 0, total_cost: 0 }
      ]
    });
  };

  const removeItemRow = (index: number) => {
    const items = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items });
  };

  if (loading) {
    return (
      <Container className="py-4">
        <LoadingSpinner size="lg" text="Loading purchase requests..." />
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="mb-1">Purchase Requests</h2>
          <p className="text-muted mb-0">
            {user?.role === 'canvasser'
              ? 'Review purchase requests for canvassing.'
              : 'Admin view of purchase requests.'}
          </p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-primary" size="sm" onClick={loadRequests}>
            <i className="bi bi-arrow-clockwise me-2"></i>
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
            <i className="bi bi-plus-circle me-2"></i>
            New Request
          </Button>
        </div>
      </div>

      <Card>
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table striped bordered hover className="mb-0">
              <thead className="bg-light">
                <tr>
                  <th>Status</th>
                  <th>P.R. Number</th>
                  <th>Entity / Requested By</th>
                  <th>Office / Section</th>
                  <th>Date Requested</th>
                  <th>Total Amount</th>
                  <th>Remark</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      No purchase requests found
                    </td>
                  </tr>
                ) : (
                  requests.map((req) => (
                    <tr key={req.id}>
                      <td>{getStatusBadge(req.status)}</td>
                      <td className="fw-semibold">{req.pr_number}</td>
                      <td>{req.requested_by || req.entity_name}</td>
                      <td>{req.office_section}</td>
                      <td>{formatDate(req.date_created)}</td>
                      <td>
                        {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(
                          req.total_amount || 0
                        )}
                      </td>
                      <td className="d-flex justify-content-between align-items-center">
                        <span>{req.remark || 'No remarks'}</span>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="ms-2"
                          onClick={() => openUpdateModal(req)}
                        >
                          <i className="bi bi-journal-text me-1"></i>
                          Update
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* Create Purchase Request Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>New Purchase Request</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row className="mb-3">
              <Col md={6}>
                <Form.Label>Entity / Requested By</Form.Label>
                <Form.Control
                  value={formData.entity_name}
                  onChange={(e) => setFormData({ ...formData, entity_name: e.target.value })}
                  isInvalid={!!errors.entity_name}
                />
                <Form.Control.Feedback type="invalid">{errors.entity_name}</Form.Control.Feedback>
              </Col>
              <Col md={6}>
                <Form.Label>Office / Section</Form.Label>
                <Form.Control
                  value={formData.office_section}
                  onChange={(e) => setFormData({ ...formData, office_section: e.target.value })}
                  isInvalid={!!errors.office_section}
                />
                <Form.Control.Feedback type="invalid">{errors.office_section}</Form.Control.Feedback>
              </Col>
            </Row>
            <Row className="mb-3">
              <Col md={4}>
                <Form.Label>Fund Cluster</Form.Label>
                <Form.Control
                  value={formData.fund_cluster}
                  onChange={(e) => setFormData({ ...formData, fund_cluster: e.target.value })}
                />
              </Col>
              <Col md={4}>
                <Form.Label>Responsibility Center Code</Form.Label>
                <Form.Control
                  value={formData.responsibility_center_code}
                  onChange={(e) => setFormData({ ...formData, responsibility_center_code: e.target.value })}
                />
              </Col>
              <Col md={4}>
                <Form.Label>Date</Form.Label>
                <Form.Control
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </Col>
            </Row>
            <Row className="mb-3">
              <Col>
                <Form.Label>Remark</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                />
              </Col>
            </Row>

            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="mb-0">Items</h6>
              <Button variant="outline-primary" size="sm" onClick={addItemRow}>
                <i className="bi bi-plus-circle me-1"></i>
                Add Item
              </Button>
            </div>
            {errors.items && <div className="text-danger mb-2">{errors.items}</div>}
            <div className="table-responsive">
              <Table size="sm" bordered>
                <thead>
                  <tr>
                    <th style={{ width: '10%' }}>Unit</th>
                    <th>Description</th>
                    <th style={{ width: '10%' }}>Qty</th>
                    <th style={{ width: '15%' }}>Unit Cost</th>
                    <th style={{ width: '15%' }}>Total Cost</th>
                    <th style={{ width: '8%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <Form.Control
                          value={item.unit}
                          onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          value={item.item_description}
                          onChange={(e) => handleItemChange(idx, 'item_description', e.target.value)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          min={0}
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        />
                      </td>
                      <td>
                        <InputGroup>
                          <InputGroup.Text>₱</InputGroup.Text>
                          <Form.Control
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.unit_cost}
                            onChange={(e) => handleItemChange(idx, 'unit_cost', e.target.value)}
                          />
                        </InputGroup>
                      </td>
                      <td>
                        <InputGroup>
                          <InputGroup.Text>₱</InputGroup.Text>
                          <Form.Control
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.total_cost}
                            onChange={(e) => handleItemChange(idx, 'total_cost', e.target.value)}
                          />
                        </InputGroup>
                      </td>
                      <td className="text-center">
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => removeItemRow(idx)}
                          disabled={formData.items.length <= 1}
                        >
                          <i className="bi bi-trash"></i>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Toast
        show={showToast}
        message={toastMessage}
        type={toastType}
        onClose={() => setShowToast(false)}
      />

      {/* Update Purchase Request Modal */}
      <Modal show={showUpdateModal} onHide={() => setShowUpdateModal(false)} size="lg" centered>
        <Form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!selectedRequest) return;
            try {
              setSubmitting(true);
              // Update status to Approved per request
              const payload = { status: 'Approved' as const };
              await apiService.updatePurchaseRequest(selectedRequest.id, payload);
              setToastMessage('Purchase request updated to Approved');
              setToastType('success');
              setShowToast(true);
              await loadRequests();
              setShowUpdateModal(false);
            } catch (err: any) {
              console.error('Failed to update purchase request:', err);
              setToastMessage(err.response?.data?.message || 'Failed to update purchase request');
              setToastType('error');
              setShowToast(true);
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <Modal.Header closeButton>
            <Modal.Title>Update Purchase Request</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {selectedRequest ? (
              <>
                <h6 className="mb-3">List of Items</h6>
                <div className="table-responsive">
                  <Table bordered>
                    <thead>
                      <tr>
                        <th>Unit</th>
                        <th>Item Description</th>
                        <th>Quantity</th>
                        <th>Unit Cost</th>
                        <th>Total Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRequest.items.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.unit}</td>
                          <td>{item.item_description}</td>
                          <td>{item.quantity}</td>
                          <td>{item.unit_cost}</td>
                          <td>{item.total_cost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
                <Row className="mb-3">
                  <Col md={6}>
                    <Form.Label>Status</Form.Label>
                    <Form.Select value="Approved" disabled>
                      <option value="Approved">Approved</option>
                    </Form.Select>
                  </Col>
                  <Col md={6}>
                    <Form.Label>P.R. Number</Form.Label>
                    <Form.Control value={selectedRequest.pr_number} disabled />
                  </Col>
                </Row>
                <Row className="mb-3">
                  <Col md={6}>
                    <Form.Label>Ref. Number</Form.Label>
                    <Form.Control placeholder="N/A" disabled />
                  </Col>
                  <Col md={6}>
                    <Form.Label>Remark</Form.Label>
                    <Form.Control value={selectedRequest.remark || 'No remarks'} disabled />
                  </Col>
                </Row>
              </>
            ) : (
              <div className="text-muted">No request selected</div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowUpdateModal(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submitting || !selectedRequest}>
              {submitting ? 'Submitting...' : 'Submit'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default PurchaseRequestCanvasser;
