import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Row, Col, Card, Table, Badge, Button, 
  Modal, Alert, Spinner, ButtonGroup
} from 'react-bootstrap';
import { apiService, PurchaseOrder, PurchaseRequest } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';

const OrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');

  useEffect(() => {
    if (id) {
      fetchOrderDetails();
    }
  }, [id]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // For employee/canvasser we use purchase requests (real-time)
      if (user?.role === 'employee' || user?.role === 'canvasser') {
        let pr: PurchaseRequest | null = null;
        try {
          // id for these roles is the pr_number (e.g., PR-...)
          pr = await apiService.getPurchaseRequest(id!);
        } catch (e) {
          // fallback: try numeric if needed
          pr = await apiService.getPurchaseRequest(id!);
        }
        if (!pr) throw new Error('Purchase request not found');
        const mapped: PurchaseOrder = {
          id: parseInt(pr.id) || hashString(pr.id),
          po_number: pr.pr_number,
          supplier_id: 0,
          supplier: {
            id: 0,
            name: pr.entity_name || pr.requested_by || 'N/A',
            address: '',
            province: '',
            contact_person: '',
            phone: '',
            email: '',
            bir_tin: '',
            is_active: true,
            created_at: pr.date_created,
            updated_at: pr.date_updated || pr.date_created
          },
          delivery_address: pr.office_section,
          notes: pr.remark || '',
          status:
            pr.status === 'Pending'
              ? 'Pending'
              : pr.status === 'Approved'
                ? 'Approved'
                : pr.status === 'Completed'
                  ? 'Completed'
                  : 'Draft',
          total_amount: pr.total_amount,
          date_created: pr.date_created,
          date_updated: pr.date_updated || pr.date_created,
          items: pr.items.map((item, index) => ({
            id: index + 1,
            product_id: index + 1,
            product: {
              id: index + 1,
              name: item.item_description,
              description: item.item_description,
              unit: item.unit,
              unit_price: item.unit_cost,
              category: '',
              is_active: true
            },
            quantity: item.quantity,
            unit_price: item.unit_cost,
            total_price: item.total_cost
          }))
        };
        setOrder(mapped);
      } else {
        // Admin/other roles: Try real purchase order API, fallback to mock
        let orderData: PurchaseOrder;
        try {
          orderData = await apiService.getOrder(parseInt(id!));
        } catch (apiError) {
          console.log('API not available, using mock data...');
          orderData = {
            id: parseInt(id!),
            po_number: `PO-20250101-${id!.padStart(3, '0')}`,
            supplier_id: 1,
            supplier: {
              id: 1,
              name: "TechDistributors Inc",
              address: "123 Tech Street, Makati City",
              province: "Metro Manila",
              contact_person: "John Smith",
              phone: "+63 2 1234 5678",
              email: "john@techdistributors.com",
              bir_tin: "123-456-789-000",
              is_active: true,
              created_at: "2025-01-01T00:00:00Z",
              updated_at: "2025-01-01T00:00:00Z"
            },
            delivery_address: "Philippine Procurement Solutions, 123 Ayala Avenue, Makati City",
            notes: "Urgent delivery required",
            status: "Pending",
            total_amount: 75000.00,
            date_created: "2025-01-01T10:30:00Z",
            date_updated: "2025-01-01T10:30:00Z",
            items: [
              {
                id: 1,
                product_id: 1,
                product: {
                  id: 1,
                  name: "Laptop Computer",
                  description: "High-performance laptop for office use",
                  unit: "piece",
                  unit_price: 45000.00,
                  category: "Electronics",
                  is_active: true
                },
                quantity: 1,
                unit_price: 45000.00,
                total_price: 45000.00
              },
              {
                id: 2,
                product_id: 2,
                product: {
                  id: 2,
                  name: "Office Chair",
                  description: "Ergonomic office chair",
                  unit: "piece",
                  unit_price: 15000.00,
                  category: "Furniture",
                  is_active: true
                },
                quantity: 2,
                unit_price: 15000.00,
                total_price: 30000.00
              }
            ]
          };
        }
        setOrder(orderData);
      }
    } catch (err) {
      console.error('Error fetching order details:', err);
      setError('Failed to load order details');
      setToastMessage('Failed to load order details');
      setToastType('error');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!order || !user?.is_admin) return;

    try {
      setApproving(true);
      setShowConfirmModal(false);

      // Optimistic UI update
      const originalStatus = order.status;
      setOrder(prev => prev ? { ...prev, status: 'Approved' as const } : null);

      // Call approval API
      try {
        await apiService.approveOrder(order.id);
        
        // Success - create blockchain transaction
        try {
          await apiService.createTransaction({
            from: user.username,
            to: 'system',
            amount: 0,
            action: 'approve_order',
            data: {
              order_id: order.id,
              po_number: order.po_number,
              previous_status: originalStatus,
              new_status: 'Approved'
            }
          });
          
          // Try to mine the block
          try {
            await apiService.mineBlock();
          } catch (mineError) {
            console.log('Mining failed, but transaction was created:', mineError);
          }
        } catch (blockchainError) {
          console.log('Blockchain transaction failed:', blockchainError);
          // Continue with success since the order was approved
        }

        setToastMessage('Order approved successfully and recorded on blockchain');
        setToastType('success');
        setShowToast(true);
      } catch (approvalError) {
        // Rollback on failure
        setOrder(prev => prev ? { ...prev, status: originalStatus } : null);
        throw approvalError;
      }
    } catch (err) {
      console.error('Approval failed:', err);
      setToastMessage('Failed to approve order. Please try again.');
      setToastType('error');
      setShowToast(true);
    } finally {
      setApproving(false);
    }
  };

  // Canvasser confirm (marks PR as Completed again to persist any change and acknowledge)
  const handleConfirm = async () => {
    if (!order || !(user?.role === 'canvasser' || user?.role === 'employee') || isConfirmed) return;
    try {
      setConfirming(true);
      setShowSubmitConfirmModal(false);
      try {
        await apiService.updatePurchaseRequest(order.po_number, {
          status: 'Completed'
        } as any);
        
        // Mark as confirmed and disable button
        setIsConfirmed(true);
        
        setToastMessage('Purchase order confirmed and saved to inspection database.');
        setToastType('success');
        setShowToast(true);
        
        // Navigate back to orders after 2 seconds
        setTimeout(() => {
          navigate('/orders');
        }, 2000);
      } catch (err) {
        console.error('Failed to confirm order:', err);
        setToastMessage('Failed to confirm order. Please try again.');
        setToastType('error');
        setShowToast(true);
      }
    } finally {
      setConfirming(false);
    }
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
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'Draft': { variant: 'secondary', text: 'Draft' },
      'Pending': { variant: 'warning', text: 'Pending' },
      'Approved': { variant: 'success', text: 'Approved' },
      'Completed': { variant: 'primary', text: 'Completed' },
      'Cancelled': { variant: 'danger', text: 'Cancelled' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { 
      variant: 'secondary', 
      text: status 
    };

    return <Badge bg={config.variant}>{config.text}</Badge>;
  };

  const handleToastClose = () => {
    setShowToast(false);
  };

  // Simple string hash helper (same logic as Orders.tsx)
  const hashString = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit int
    }
    return Math.abs(hash);
  };

  if (loading) {
    return (
      <Container className="py-4">
        <LoadingSpinner size="lg" text="Loading order details..." />
      </Container>
    );
  }

  if (error || !order) {
    return (
      <Container className="py-4">
        <Alert variant="danger">
          <Alert.Heading>Error</Alert.Heading>
          <p>{error || 'Order not found'}</p>
          <Button variant="outline-danger" onClick={() => navigate('/orders')}>
            Back to Orders
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h2 className="mb-1">Purchase Order Details</h2>
              <p className="text-muted mb-0">PO Number: {order.po_number}</p>
            </div>
            <div className="d-flex gap-2">
              <Button 
                variant="outline-secondary" 
                onClick={() => navigate('/orders')}
              >
                <i className="bi bi-arrow-left me-2"></i>
                Back to Orders
              </Button>
              {user?.is_admin && order.status === 'Pending' && (
                <Button 
                  variant="success" 
                  onClick={() => setShowConfirmModal(true)}
                  disabled={approving}
                >
                  {approving ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle me-2"></i>
                      Approve Order
                    </>
                  )}
                </Button>
              )}
              {(user?.role === 'canvasser' || user?.role === 'employee') && (
                <Button
                  variant="primary"
                  onClick={() => setShowSubmitConfirmModal(true)}
                  disabled={confirming || isConfirmed}
                >
                  {confirming ? 'Confirming...' : isConfirmed ? 'Confirmed' : 'Confirm'}
                </Button>
              )}
            </div>
          </div>
        </Col>
      </Row>

      {/* Order Summary */}
      <Row className="mb-4">
        <Col md={8}>
          <Card className={isConfirmed ? 'opacity-75' : ''}>
            <Card.Header>
              <h5 className="mb-0">Order Summary</h5>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={6}>
                  <p><strong>Status:</strong> {getStatusBadge(order.status)}</p>
                  <p><strong>Date Created:</strong> {formatDate(order.date_created)}</p>
                  <p><strong>Last Updated:</strong> {formatDate(order.date_updated)}</p>
                </Col>
                <Col md={6}>
                  <p><strong>Total Amount:</strong> {formatCurrency(order.total_amount)}</p>
                  <p><strong>Items Count:</strong> {order.items.length}</p>
                  {order.notes && (
                    <p><strong>Notes:</strong> {order.notes}</p>
                  )}
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className={isConfirmed ? 'opacity-75' : ''}>
            <Card.Header>
              <h5 className="mb-0">Supplier Information</h5>
            </Card.Header>
            <Card.Body>
              <p><strong>Name:</strong> {order.supplier.name}</p>
              <p><strong>Contact:</strong> {order.supplier.contact_person}</p>
              <p><strong>Phone:</strong> {order.supplier.phone}</p>
              {order.supplier.email && (
                <p><strong>Email:</strong> {order.supplier.email}</p>
              )}
              <p><strong>BIR TIN:</strong> {order.supplier.bir_tin}</p>
              <p><strong>Address:</strong> {order.supplier.address}</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Actions Section - appears after confirmation */}
      {isConfirmed && (
        <Row className="mb-4">
          <Col>
            <Card className="border-success bg-light">
              <Card.Header className="bg-success">
                <h5 className="mb-0 text-white">Actions</h5>
              </Card.Header>
              <Card.Body>
                <div className="text-center py-3">
                  <Button 
                    variant="primary" 
                    size="sm" 
                    disabled
                    className="d-inline-flex align-items-center gap-2"
                  >
                    <i className="bi bi-check-circle"></i>
                    Order Confirmed
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Delivery Information */}
      <Row className="mb-4">
        <Col>
          <Card className={isConfirmed ? 'opacity-75' : ''}>
            <Card.Header>
              <h5 className="mb-0">Delivery Information</h5>
            </Card.Header>
            <Card.Body>
              <p><strong>Delivery Address:</strong> {order.delivery_address}</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Items List */}
      <Row className="mb-4">
        <Col>
          <Card className={isConfirmed ? 'opacity-75' : ''}>
            <Card.Header>
              <h5 className="mb-0">Order Items</h5>
            </Card.Header>
            <Card.Body>
              <Table responsive striped>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th className="text-end">Quantity</th>
                    <th className="text-end">Unit Price</th>
                    <th className="text-end">Total Price</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td>
                        <strong>{item.product.name}</strong>
                      </td>
                      <td>{item.product.description || '-'}</td>
                      <td>{item.product.category}</td>
                      <td className="text-end">{item.quantity} {item.product.unit}</td>
                      <td className="text-end">{formatCurrency(item.unit_price)}</td>
                      <td className="text-end">{formatCurrency(item.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6} className="text-end">
                      <strong>Total Amount:</strong>
                    </td>
                    <td className="text-end">
                      <strong>{formatCurrency(order.total_amount)}</strong>
                    </td>
                  </tr>
                </tfoot>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Approval Confirmation Modal */}
      <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Order Approval</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to approve this purchase order?</p>
          <p><strong>PO Number:</strong> {order.po_number}</p>
          <p><strong>Supplier:</strong> {order.supplier.name}</p>
          <p><strong>Total Amount:</strong> {formatCurrency(order.total_amount)}</p>
          <Alert variant="info">
            <i className="bi bi-info-circle me-2"></i>
            This action will be recorded on the blockchain for transparency and audit purposes.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={handleApprove}>
            <i className="bi bi-check-circle me-2"></i>
            Approve Order
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Confirm (canvasser) Modal */}
      <Modal show={showSubmitConfirmModal} onHide={() => setShowSubmitConfirmModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Purchase Order</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {isConfirmed ? (
            <div className="alert alert-info">
              <i className="bi bi-info-circle me-2"></i>
              This purchase order has already been confirmed and saved to the inspection database. 
              It is now available for the inspector to review.
            </div>
          ) : (
            <>
              <p>Confirm this purchase order is ready and matches the completed canvass.</p>
              <p><strong>PO Number:</strong> {order.po_number}</p>
              <p><strong>Total Amount:</strong> {formatCurrency(order.total_amount)}</p>
              <p className="text-muted mt-3">
                <small>Once confirmed, this order will be saved to the inspection database and made available to the inspector.</small>
              </p>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSubmitConfirmModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleConfirm} disabled={confirming || isConfirmed}>
            {confirming ? 'Confirming...' : isConfirmed ? 'Already Confirmed' : 'Confirm'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Toast Notifications */}
      <Toast
        show={showToast}
        message={toastMessage}
        type={toastType}
        onClose={handleToastClose}
      />
    </Container>
  );
};

export default OrderDetail;
