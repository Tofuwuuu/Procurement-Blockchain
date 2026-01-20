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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadRequests();
    loadSuppliers();
  }, []);

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

  const loadSuppliers = async () => {
    try {
      const data = await apiService.getSuppliers();
      setSuppliers(data);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
      // Continue without suppliers - use mock data if needed
    }
  };

  const openDetailModal = (request: PurchaseRequest) => {
    setSelectedRequest(request);
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
    suppliers.slice(0, 3).forEach((supplier) => {
      request.items.forEach((item) => {
        // Mock price variation (80% to 120% of original unit cost)
        const priceVariation = 0.8 + Math.random() * 0.4;
        const canvassPrice = (item.unit_cost * priceVariation).toFixed(2);
        items.push(`${supplier.name} | ${item.item_description} | ${canvassPrice}`);
      });
    });
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
        size="lg" 
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Abstract of Canvass</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedRequest && (
            <>
              {/* List of Items Section */}
              <h6 className="fw-bold mb-3">LIST OF ITEMS</h6>
              <div className="table-responsive mb-4">
                <Table bordered>
                  <thead>
                    <tr>
                      <th>UNIT</th>
                      <th>ITEM DESCRIPTION</th>
                      <th>QUANTITY</th>
                      <th>UNIT COST</th>
                      <th>TOTAL COST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRequest.items.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.unit}</td>
                        <td>{item.item_description}</td>
                        <td>{item.quantity}</td>
                        <td>
                          {new Intl.NumberFormat('en-PH', { 
                            style: 'currency', 
                            currency: 'PHP',
                            minimumFractionDigits: 2 
                          }).format(item.unit_cost)}
                        </td>
                        <td>
                          {new Intl.NumberFormat('en-PH', { 
                            style: 'currency', 
                            currency: 'PHP',
                            minimumFractionDigits: 2 
                          }).format(item.total_cost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {/* Supplier Section */}
              <Row>
                <Col md={12}>
                  <div className="d-flex mb-3">
                    <h6 className="fw-bold me-3">SUPPLIER</h6>
                  </div>
                  <div 
                    style={{ 
                      maxHeight: '300px', 
                      overflowY: 'auto', 
                      border: '1px solid #dee2e6',
                      padding: '10px',
                      borderRadius: '4px'
                    }}
                  >
                    {getSupplierCanvassItems(selectedRequest).map((item, idx) => (
                      <div key={idx} className="mb-2" style={{ fontSize: '0.9rem' }}>
                        {item}
                      </div>
                    ))}
                    {suppliers.length === 0 && (
                      <div className="text-muted text-center py-3">
                        No suppliers available. Loading supplier data...
                      </div>
                    )}
                  </div>
                </Col>
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
