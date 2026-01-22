import React, { useEffect, useState } from 'react';
import { Container, Table, Card, Badge, Button, Modal, Row, Col } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { apiService, PurchaseRequest, Supplier } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';

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

  useEffect(() => {
    loadRequests();
  }, []);

  // Reload requests when modal opens to get latest data
  useEffect(() => {
    if (showDetailModal) {
      loadRequests();
    }
  }, [showDetailModal]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      // Canvasser should see all requests; backend enforces auth via JWT
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

  const openDetailModal = (request: PurchaseRequest) => {
    // Fetch the latest PR data to ensure we have any recently added suppliers
    const latestRequest = requests.find(r => r.id === request.id);
    if (latestRequest) {
      setSelectedRequest(latestRequest);
    } else {
      setSelectedRequest(request);
    }
    setSelectedSupplier(null); // Reset supplier selection
    setShowDetailModal(true);
  };

  const handleSubmitCanvass = async () => {
    if (!selectedRequest) return;
    try {
      setSubmitting(true);
      // Update status to indicate canvassing is complete
      // This might need to be a different status or create a canvass record
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

  // Generate mock supplier-item-price entries for demonstration
  const getSupplierCanvassItems = (request: PurchaseRequest) => {
    const items: string[] = [];
    if ((request as any).suppliers && (request as any).suppliers.length > 0) {
      (request as any).suppliers.forEach((supplier: any) => {
        request.items.forEach((item) => {
          items.push(`${supplier.name} | ${item.item_description} | ${supplier.unit_price || item.unit_cost}`);
        });
      });
    }
    return items;
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

  if (loading) {
    return (
      <Container className="py-4">
        <LoadingSpinner size="lg" text="Loading abstract of canvass..." />
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="mb-1">Abstract of Canvass</h2>
          <p className="text-muted mb-0">
            {user?.role === 'canvasser' ? 'Review purchase requests for canvassing.' : 'Admin view of purchase requests.'}
          </p>
        </div>
        <Button variant="outline-primary" size="sm" onClick={loadRequests}>
          <i className="bi bi-arrow-clockwise me-2"></i>
          Refresh
        </Button>
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
                      <td>
                        <div className="d-flex justify-content-between align-items-center">
                          <span>{req.remark || 'No remarks'}</span>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="ms-2"
                            onClick={() => openDetailModal(req)}
                          >
                            <i className="bi bi-eye me-1"></i>
                            Details
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* Abstract of Canvass Detail Modal */}
      <Modal 
        show={showDetailModal} 
        onHide={() => setShowDetailModal(false)} 
        size="xl" 
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Abstract of Canvass</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedRequest && (
            <>
              {/* PR Details Section */}
              <Row className="mb-4">
                <Col md={6}>
                  <div className="border rounded p-3">
                    <div className="row mb-2">
                      <div className="col-6 fw-bold">Reference No.</div>
                      <div className="col-6">{selectedRequest.ref_number || 'N/A'}</div>
                    </div>
                    <div className="row mb-2">
                      <div className="col-6 fw-bold">PR No.</div>
                      <div className="col-6">{selectedRequest.pr_number}</div>
                    </div>
                    <div className="row mb-2">
                      <div className="col-6 fw-bold">Date Requested</div>
                      <div className="col-6">{formatDate(selectedRequest.date_created)}</div>
                    </div>
                    <div className="row mb-2">
                      <div className="col-6 fw-bold">Date Approved</div>
                      <div className="col-6">{selectedRequest.date_updated ? formatDate(selectedRequest.date_updated) : 'N/A'}</div>
                    </div>
                    <div className="row mb-2">
                      <div className="col-6 fw-bold">Requested by</div>
                      <div className="col-6">{selectedRequest.requested_by || selectedRequest.entity_name}</div>
                    </div>
                    <div className="row mb-2">
                      <div className="col-6 fw-bold">Designation</div>
                      <div className="col-6">Staff</div>
                    </div>
                    <div className="row">
                      <div className="col-6 fw-bold">Office/Section</div>
                      <div className="col-6">{selectedRequest.office_section}</div>
                    </div>
                  </div>
                </Col>
              </Row>

              {/* List of Items Section */}
              <h6 className="fw-bold mb-3">LIST OF ITEM</h6>
              <div className="table-responsive mb-4">
                <Table bordered striped size="sm">
                  <thead className="bg-light">
                    <tr>
                      <th>Stock/ Property No.</th>
                      <th>Unit</th>
                      <th>Item Description</th>
                      <th>Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRequest.items.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.unit}</td>
                        <td>{item.unit}</td>
                        <td>{item.item_description}</td>
                        <td>{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {/* Choose Suppliers Section */}
              <h6 className="fw-bold mb-3">Choose Suppliers</h6>
              <Row>
                {(selectedRequest as any).suppliers && (selectedRequest as any).suppliers.length > 0 ? (
                  (selectedRequest as any).suppliers.slice(0, 3).map((supplier: any, idx: number) => (
                    <Col md={4} key={idx} className="mb-3">
                      <Card 
                        className={`h-100 cursor-pointer ${selectedSupplier === idx ? 'border-success border-3' : 'border-1'}`}
                        onClick={() => setSelectedSupplier(idx)}
                        style={{ 
                          cursor: 'pointer', 
                          transition: 'all 0.2s ease',
                          backgroundColor: selectedSupplier === idx ? '#f0f8ff' : 'white'
                        }}
                        onMouseEnter={(e) => {
                          if (selectedSupplier !== idx) {
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = '';
                        }}
                      >
                        <Card.Body>
                          <div className="d-flex justify-content-between align-items-start mb-3">
                            <h6 className="fw-bold mb-0">Supplier {idx + 1}</h6>
                            {selectedSupplier === idx && (
                              <Badge bg="success">
                                <i className="bi bi-check-circle me-1"></i>
                                Selected
                              </Badge>
                            )}
                          </div>
                          <div className="mb-3">
                            <label className="text-muted small">Name</label>
                            <div className="form-control-plaintext fw-semibold">{supplier.name || 'Unknown'}</div>
                          </div>
                          <div className="mb-3">
                            <label className="text-muted small">Unit Price</label>
                            <div className="form-control-plaintext fw-semibold">
                              {new Intl.NumberFormat('en-PH', { 
                                style: 'currency', 
                                currency: 'PHP',
                                minimumFractionDigits: 2 
                              }).format(supplier.unit_price || 0)}
                            </div>
                          </div>
                          <div className="mb-3">
                            <label className="text-muted small">Item Description</label>
                            <div className="form-control-plaintext fw-semibold text-break">{supplier.item_description || 'N/A'}</div>
                          </div>
                          <div>
                            <label className="text-muted small">Source</label>
                            <div className="form-control-plaintext fw-semibold">{supplier.source || 'Web Scraping'}</div>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))
                ) : (
                  <Col md={12}>
                    <div className="alert alert-info">
                      <i className="bi bi-info-circle me-2"></i>
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
          <Button variant="success" onClick={handleSubmitCanvass} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit'}
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
