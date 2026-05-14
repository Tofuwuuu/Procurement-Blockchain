import React, { useEffect, useMemo, useState } from 'react';
import { Container, Table, Card, Badge, Button, Modal, Row, Col, Form, InputGroup } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { apiService, PurchaseRequest } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import './AbstractOfCanvass.css';

/**
 * Abstract of Canvass view for canvassers and admins.
 * Fetches purchase requests from the backend (MongoDB) in real time.
 */
const AbstractOfCanvass: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    if (showDetailModal) {
      loadRequests();
    }
  }, [showDetailModal]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await apiService.getPurchaseRequests(false);
      setRequests(data);
    } catch (err: any) {
      console.error('Failed to load purchase requests for canvass:', err);
      setToastMessage(err.response?.data?.message || 'Failed to load purchase requests');
      setToastType('error');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const getSuppliers = (request: PurchaseRequest | null) =>
    ((request as any)?.suppliers || []) as Array<{
      name?: string;
      address?: string;
      unit_price?: number;
      item_description?: string;
      source?: string;
    }>;

  const openDetailModal = (request: PurchaseRequest) => {
    const latestRequest = requests.find(r => r.id === request.id);
    setSelectedRequest(latestRequest || request);
    setSelectedSupplier(null);
    setShowDetailModal(true);
  };

  const handleSubmitCanvass = async () => {
    if (!selectedRequest) return;
    try {
      setSubmitting(true);
      await apiService.updatePurchaseRequest(selectedRequest.id, { status: 'Completed' });
      setToastMessage('Abstract of Canvass submitted successfully');
      setToastType('success');
      setShowToast(true);
      await loadRequests();
      setShowDetailModal(false);
    } catch (err: any) {
      console.error('Failed to submit canvass:', err);
      setToastMessage(err.response?.data?.message || 'Failed to submit abstract of canvass');
      setToastType('error');
      setShowToast(true);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { className: string; text: string }> = {
      Pending: { className: 'aoc-status-badge aoc-status-pending', text: 'Pending' },
      Approved: { className: 'aoc-status-badge aoc-status-approved', text: 'Approved' },
      Draft: { className: 'aoc-status-badge aoc-status-draft', text: 'Draft' },
      Completed: { className: 'aoc-status-badge aoc-status-completed', text: 'Completed' },
    };
    const config = statusConfig[status] || { className: 'aoc-status-badge aoc-status-draft', text: status };
    return <Badge className={config.className}>{config.text}</Badge>;
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount || 0);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const requestStats = useMemo(() => {
    const readyForCanvass = requests.filter(req => req.status === 'Approved' && getSuppliers(req).length > 0).length;
    const missingSuppliers = requests.filter(req => req.status === 'Approved' && getSuppliers(req).length === 0).length;
    const completed = requests.filter(req => req.status === 'Completed').length;
    const totalValue = requests.reduce((sum, req) => sum + (req.total_amount || 0), 0);
    return { readyForCanvass, missingSuppliers, completed, totalValue };
  }, [requests]);

  const statusOptions = useMemo(
    () => ['All', ...Array.from(new Set(requests.map(req => req.status).filter(Boolean)))],
    [requests]
  );

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return requests.filter(req => {
      const matchesStatus = statusFilter === 'All' || req.status === statusFilter;
      const searchableText = [
        req.pr_number,
        req.requested_by,
        req.entity_name,
        req.office_section,
        req.remark,
        req.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesStatus && (!normalizedSearch || searchableText.includes(normalizedSearch));
    });
  }, [requests, searchTerm, statusFilter]);

  if (loading) {
    return (
      <Container fluid className="abstract-canvass-page py-4">
        <LoadingSpinner size="lg" text="Loading abstract of canvass..." />
      </Container>
    );
  }

  const selectedSuppliers = getSuppliers(selectedRequest);

  return (
    <Container fluid className="abstract-canvass-page py-4">
      <div className="aoc-page-header">
        <div>
          <div className="aoc-eyebrow">Supplier Evaluation</div>
          <h2 className="mb-1">Abstract of Canvass</h2>
          <p className="aoc-page-subtitle mb-0">
            {user?.role === 'canvasser'
              ? 'Compare supplier quotations and complete canvass records for approved purchase requests.'
              : 'Review canvass readiness, supplier coverage, and completed purchase request comparisons.'}
          </p>
        </div>
        <Button variant="outline-primary" onClick={loadRequests}>
          <i className="bi bi-arrow-clockwise me-2"></i>
          Refresh
        </Button>
      </div>

      <Row className="g-3 mb-3">
        <Col sm={6} lg={3}>
          <Card className="aoc-stat-card accent-success">
            <Card.Body>
              <span>Ready for Canvass</span>
              <strong>{requestStats.readyForCanvass}</strong>
            </Card.Body>
          </Card>
        </Col>
        <Col sm={6} lg={3}>
          <Card className="aoc-stat-card accent-warning">
            <Card.Body>
              <span>Needs Suppliers</span>
              <strong>{requestStats.missingSuppliers}</strong>
            </Card.Body>
          </Card>
        </Col>
        <Col sm={6} lg={3}>
          <Card className="aoc-stat-card accent-primary">
            <Card.Body>
              <span>Completed</span>
              <strong>{requestStats.completed}</strong>
            </Card.Body>
          </Card>
        </Col>
        <Col sm={6} lg={3}>
          <Card className="aoc-stat-card">
            <Card.Body>
              <span>Total PR Value</span>
              <strong>{formatCurrency(requestStats.totalValue)}</strong>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="aoc-list-card">
        <Card.Body className="p-0">
          <div className="aoc-list-toolbar">
            <div>
              <h5>Canvass Register</h5>
              <span>{filteredRequests.length} of {requests.length} purchase requests shown</span>
            </div>
            <div className="aoc-list-controls">
              <InputGroup className="aoc-search-control">
                <InputGroup.Text>
                  <i className="bi bi-search"></i>
                </InputGroup.Text>
                <Form.Control
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search PR number, requester, office..."
                />
              </InputGroup>
              <Form.Select
                className="aoc-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                {statusOptions.map(status => (
                  <option key={status} value={status}>
                    {status === 'All' ? 'All statuses' : status}
                  </option>
                ))}
              </Form.Select>
            </div>
          </div>

          <div className="table-responsive">
            <Table hover className="aoc-table mb-0">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>P.R. Number</th>
                  <th>Entity / Requested By</th>
                  <th>Office / Section</th>
                  <th>Date Requested</th>
                  <th>Total Amount</th>
                  <th>Suppliers</th>
                  <th>Remark</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="aoc-empty-state">
                      <i className="bi bi-clipboard-data"></i>
                      <strong>No purchase requests found</strong>
                      <span>Try clearing search or changing the status filter.</span>
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map(req => {
                    const supplierCount = getSuppliers(req).length;
                    const isReady = req.status === 'Approved' && supplierCount > 0;
                    return (
                      <tr key={req.id}>
                        <td>{getStatusBadge(req.status)}</td>
                        <td className="fw-semibold text-nowrap">{req.pr_number}</td>
                        <td>{req.requested_by || req.entity_name}</td>
                        <td>{req.office_section}</td>
                        <td className="text-nowrap">{formatDate(req.date_created)}</td>
                        <td className="aoc-amount">{formatCurrency(req.total_amount || 0)}</td>
                        <td>
                          <Badge className={`aoc-supplier-count ${supplierCount > 0 ? 'ready' : ''}`}>
                            {supplierCount} supplier{supplierCount === 1 ? '' : 's'}
                          </Badge>
                        </td>
                        <td className="aoc-remark">{req.remark || 'No remarks'}</td>
                        <td className="text-end">
                          <Button
                            variant={isReady ? 'primary' : 'outline-primary'}
                            size="sm"
                            className="aoc-row-action"
                            onClick={() => openDetailModal(req)}
                          >
                            <i className="bi bi-eye me-1"></i>
                            Review
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      <Modal
        show={showDetailModal}
        onHide={() => setShowDetailModal(false)}
        size="xl"
        centered
        className="aoc-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <span>Abstract of Canvass</span>
            <small>Review request details and supplier quotations.</small>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedRequest && (
            <>
              <div className="aoc-review-summary mb-4">
                <div>
                  <span>P.R. Number</span>
                  <strong>{selectedRequest.pr_number}</strong>
                </div>
                <div>
                  <span>Requester</span>
                  <strong>{selectedRequest.requested_by || selectedRequest.entity_name}</strong>
                </div>
                <div>
                  <span>Status</span>
                  {getStatusBadge(selectedRequest.status)}
                </div>
                <div>
                  <span>Total Amount</span>
                  <strong>{formatCurrency(selectedRequest.total_amount || 0)}</strong>
                </div>
              </div>

              <Row className="g-3 mb-4">
                <Col lg={7}>
                  <Card className="aoc-detail-card">
                    <Card.Body>
                      <h6>Request Details</h6>
                      <div className="aoc-detail-grid">
                        <span>Reference No.</span>
                        <strong>{selectedRequest.ref_number || 'N/A'}</strong>
                        <span>Date Requested</span>
                        <strong>{formatDate(selectedRequest.date_created)}</strong>
                        <span>Date Approved</span>
                        <strong>{selectedRequest.date_updated ? formatDate(selectedRequest.date_updated) : 'N/A'}</strong>
                        <span>Office / Section</span>
                        <strong>{selectedRequest.office_section}</strong>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col lg={5}>
                  <Card className="aoc-detail-card">
                    <Card.Body>
                      <h6>Canvass Readiness</h6>
                      <div className="aoc-readiness">
                        <i className={selectedSuppliers.length > 0 ? 'bi bi-check-circle-fill' : 'bi bi-exclamation-circle-fill'}></i>
                        <div>
                          <strong>
                            {selectedSuppliers.length > 0
                              ? `${selectedSuppliers.length} supplier quotation${selectedSuppliers.length === 1 ? '' : 's'} attached`
                              : 'No suppliers attached yet'}
                          </strong>
                          <span>
                            {selectedSuppliers.length > 0
                              ? 'Select a supplier card below before submitting the canvass.'
                              : 'Add suppliers from Supplier Search before completing the canvass.'}
                          </span>
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              <h6 className="aoc-section-heading">Requested Items</h6>
              <div className="table-responsive mb-4">
                <Table className="aoc-detail-table">
                  <thead>
                    <tr>
                      <th>Stock / Property No.</th>
                      <th>Unit</th>
                      <th>Item Description</th>
                      <th>Quantity</th>
                      <th>Estimated Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRequest.items.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.unit || 'N/A'}</td>
                        <td>{item.unit || 'N/A'}</td>
                        <td>{item.item_description}</td>
                        <td>{item.quantity}</td>
                        <td>{formatCurrency(item.total_cost || item.unit_cost || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              <h6 className="aoc-section-heading">Supplier Quotations</h6>
              <Row className="g-3">
                {selectedSuppliers.length > 0 ? (
                  selectedSuppliers.slice(0, 3).map((supplier, idx) => (
                    <Col md={4} key={`${supplier.name || 'supplier'}-${idx}`}>
                      <button
                        type="button"
                        className={`aoc-supplier-card ${selectedSupplier === idx ? 'selected' : ''}`}
                        onClick={() => setSelectedSupplier(idx)}
                      >
                        <div className="aoc-supplier-card-header">
                          <span>Supplier {idx + 1}</span>
                          {selectedSupplier === idx && (
                            <Badge className="aoc-selected-badge">
                              <i className="bi bi-check-circle me-1"></i>
                              Selected
                            </Badge>
                          )}
                        </div>
                        <strong>{supplier.name || 'Unknown supplier'}</strong>
                        <dl>
                          <dt>Unit Price</dt>
                          <dd>{formatCurrency(supplier.unit_price || 0)}</dd>
                          <dt>Item</dt>
                          <dd>{supplier.item_description || 'N/A'}</dd>
                          <dt>Source</dt>
                          <dd>{supplier.source || 'Web Scraping'}</dd>
                        </dl>
                      </button>
                    </Col>
                  ))
                ) : (
                  <Col md={12}>
                    <div className="aoc-empty-suppliers">
                      <i className="bi bi-info-circle"></i>
                      No suppliers available. Please add suppliers from Supplier Search.
                    </div>
                  </Col>
                )}
              </Row>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailModal(false)} disabled={submitting}>
            Close
          </Button>
          <Button
            variant="success"
            onClick={handleSubmitCanvass}
            disabled={submitting || selectedSuppliers.length === 0}
          >
            {submitting ? 'Submitting...' : 'Submit Canvass'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Toast
        show={showToast}
        message={toastMessage}
        type={toastType}
        onClose={() => setShowToast(false)}
      />
    </Container>
  );
};

export default AbstractOfCanvass;
