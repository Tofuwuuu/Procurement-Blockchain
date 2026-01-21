import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, Row, Col, Card, Table, Button, Badge, 
  Form, Modal, InputGroup 
} from 'react-bootstrap';
import { apiService, PurchaseOrder, PurchaseRequest } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';

interface InspectionItem {
  item_description: string;
  quantity_ordered: number;
  quantity_received: number;
  unit: string;
  unit_price: number;
  condition: 'Good' | 'Defective' | 'Damaged';
  remarks: string;
}

interface InspectionReport {
  po_number: string;
  inspection_date: string;
  inspected_by: string;
  items: InspectionItem[];
  overall_remarks: string;
  status: 'Accepted' | 'Partial' | 'Rejected';
}

const Inspection: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // Debug: Log component mount
  useEffect(() => {
    console.log('✅ Inspection component mounted successfully');
    return () => {
      console.log('🔍 Inspection component unmounting');
    };
  }, []);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  
  const [inspectionReport, setInspectionReport] = useState<InspectionReport>({
    po_number: '',
    inspection_date: new Date().toISOString().split('T')[0],
    inspected_by: user?.full_name || user?.username || '',
    items: [],
    overall_remarks: '',
    status: 'Accepted'
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (user) {
      setInspectionReport(prev => ({
        ...prev,
        inspected_by: user.full_name || user.username || ''
      }));
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      
      // Fetch purchase requests that are completed (from canvasser) - ready for inspection
      const purchaseRequests = await apiService.getPurchaseRequests(false);
      const readyForInspection = purchaseRequests.filter(pr => 
        pr.status === 'Completed'
      );
      
      console.log('📋 Purchase requests ready for inspection:', readyForInspection);
      
      // Convert to PurchaseOrder format with real supplier data
      const convertedOrders: PurchaseOrder[] = readyForInspection.map((pr: PurchaseRequest) => {
        // Get selected supplier from the suppliers array
        let selectedSupplier = null;
        if (pr.suppliers && pr.suppliers.length > 0) {
          if (pr.selected_supplier_ids && pr.selected_supplier_ids.length > 0) {
            // Find supplier by matching supplier_id with selected_supplier_ids
            selectedSupplier = pr.suppliers.find(s => 
              pr.selected_supplier_ids?.includes(s.supplier_id || '')
            );
          }
          // If no match or no selected_supplier_ids, use first supplier
          if (!selectedSupplier) {
            selectedSupplier = pr.suppliers[0];
          }
        }
        
        // Build supplier object with real data
        const supplierData = selectedSupplier || {
          name: pr.entity_name || pr.requested_by || 'N/A',
          address: '',
          contact_person: '',
          phone: '',
          email: ''
        };
        
        return {
          id: parseInt(pr.id) || hashString(pr.id),
          po_number: pr.pr_number || pr.id,
          supplier_id: selectedSupplier?.supplier_id ? hashString(selectedSupplier.supplier_id) : 0,
          supplier: {
            id: selectedSupplier?.supplier_id ? hashString(selectedSupplier.supplier_id) : 0,
            name: selectedSupplier?.name || supplierData.name || 'N/A',
            address: selectedSupplier?.address || supplierData.address || '',
            province: '',
            contact_person: selectedSupplier?.contact_person || supplierData.contact_person || '',
            phone: selectedSupplier?.phone || supplierData.phone || '',
            email: selectedSupplier?.email || supplierData.email || '',
            bir_tin: '',
            is_active: true,
            created_at: pr.date_created,
            updated_at: pr.date_updated || pr.date_created
          },
          delivery_address: pr.office_section || '',
          notes: pr.remark || '',
          status: 'Completed' as const,
          total_amount: pr.total_amount,
          date_created: pr.date_created,
          date_updated: pr.date_updated || pr.date_created,
          items: pr.items.map((item, index) => ({
            id: index + 1,
            product_id: index + 1,
            product: {
              id: index + 1,
              name: item.item_description,
              unit: item.unit,
              unit_price: item.unit_cost,
              category: '',
              is_active: true,
              description: ''
            },
            quantity: item.quantity,
            unit_price: item.unit_cost,
            total_price: item.total_cost
          }))
        };
      });
      
      console.log('✅ Converted orders for inspection:', convertedOrders);
      setOrders(convertedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const hashString = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  };

  const handleCreateInspection = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setInspectionReport({
      po_number: order.po_number,
      inspection_date: new Date().toISOString().split('T')[0],
      inspected_by: user?.full_name || user?.username || '',
      items: order.items.map(item => ({
        item_description: item.product.name,
        quantity_ordered: item.quantity,
        quantity_received: item.quantity,
        unit: item.product.unit,
        unit_price: item.unit_price,
        condition: 'Good' as const,
        remarks: ''
      })),
      overall_remarks: '',
      status: 'Accepted'
    });
    setShowModal(true);
  };

  const handleUpdateItem = (index: number, field: keyof InspectionItem, value: any) => {
    const updatedItems = [...inspectionReport.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setInspectionReport({ ...inspectionReport, items: updatedItems });
  };

  const handleSubmitInspection = async () => {
    if (!selectedOrder) return;

    try {
      // TODO: Submit inspection report to backend API
      // await apiService.createInspectionReport(inspectionReport);
      
      setToastMessage('Inspection and Acceptance Report created successfully');
      setToastType('success');
      setShowToast(true);
      setShowModal(false);
      
      // Refresh orders list
      await fetchOrders();
    } catch (error: any) {
      console.error('Error submitting inspection:', error);
      setToastMessage(error.response?.data?.message || 'Failed to create inspection report');
      setToastType('error');
      setShowToast(true);
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
      month: 'short',
      day: 'numeric',
    });
  };

  const filteredOrders = orders.filter(order =>
    order.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.supplier.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Container className="py-4">
        <LoadingSpinner size="lg" text="Loading orders..." />
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
              <h2 className="mb-1">Inspection and Acceptance Report</h2>
              <p className="text-muted mb-0">
                Create inspection reports for received purchase orders
              </p>
            </div>
          </div>
        </Col>
      </Row>

      {/* Search */}
      <Row className="mb-4">
        <Col md={6}>
          <InputGroup>
            <InputGroup.Text>
              <i className="bi bi-search"></i>
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Search by PO number or supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
        </Col>
      </Row>

      {/* Orders Table */}
      <Card>
        <Card.Header>
          <h5 className="mb-0">Purchase Orders Ready for Inspection</h5>
        </Card.Header>
        <Card.Body className="p-0">
          {filteredOrders.length > 0 ? (
            <div className="table-responsive">
              <Table striped bordered hover className="mb-0">
                <thead>
                  <tr>
                    <th>PO/PR Number</th>
                    <th>Supplier/Entity</th>
                    <th>Date Created</th>
                    <th>Total Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id}>
                      <td><strong>{order.po_number}</strong></td>
                      <td>{order.supplier.name}</td>
                      <td>{formatDate(order.date_created)}</td>
                      <td>{formatCurrency(order.total_amount)}</td>
                      <td>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleCreateInspection(order)}
                        >
                          <i className="bi bi-clipboard-check me-1"></i>
                          Create Report
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-5">
              <i className="bi bi-clipboard-check text-muted" style={{ fontSize: '3rem' }}></i>
              <p className="text-muted mt-3">
                {searchTerm 
                  ? 'No orders found matching your search' 
                  : 'No purchase orders ready for inspection'}
              </p>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Inspection Report Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="xl" centered>
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title>
            <i className="bi bi-clipboard-check me-2"></i>
            Inspection and Acceptance Report
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedOrder && (
            <>
              {/* Order Information */}
              <Card className="mb-3">
                <Card.Body>
                  <Row>
                    <Col md={6}>
                      <p className="mb-2"><strong>PO/PR Number:</strong> {selectedOrder.po_number}</p>
                      <p className="mb-2"><strong>Supplier/Entity:</strong> {selectedOrder.supplier.name}</p>
                    </Col>
                    <Col md={6}>
                      <p className="mb-2"><strong>Date Created:</strong> {formatDate(selectedOrder.date_created)}</p>
                      <p className="mb-2"><strong>Total Amount:</strong> {formatCurrency(selectedOrder.total_amount)}</p>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {/* Inspection Details */}
              <Card className="mb-3">
                <Card.Header className="bg-light">
                  <h6 className="mb-0">Inspection Details</h6>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Inspection Date *</Form.Label>
                        <Form.Control
                          type="date"
                          value={inspectionReport.inspection_date}
                          onChange={(e) => setInspectionReport({ ...inspectionReport, inspection_date: e.target.value })}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Inspected By *</Form.Label>
                        <Form.Control
                          type="text"
                          value={inspectionReport.inspected_by}
                          onChange={(e) => setInspectionReport({ ...inspectionReport, inspected_by: e.target.value })}
                          required
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {/* Items Inspection */}
              <Card className="mb-3">
                <Card.Header className="bg-light">
                  <h6 className="mb-0">Items Inspection</h6>
                </Card.Header>
                <Card.Body className="p-0">
                  <div className="table-responsive">
                    <Table striped bordered className="mb-0">
                      <thead>
                        <tr>
                          <th>Item Description</th>
                          <th>Unit</th>
                          <th>Qty Ordered</th>
                          <th>Qty Received</th>
                          <th>Condition</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inspectionReport.items.map((item, index) => (
                          <tr key={index}>
                            <td>{item.item_description}</td>
                            <td>{item.unit}</td>
                            <td>{item.quantity_ordered}</td>
                            <td>
                              <Form.Control
                                type="number"
                                min="0"
                                max={item.quantity_ordered}
                                value={item.quantity_received}
                                onChange={(e) => handleUpdateItem(index, 'quantity_received', Number(e.target.value))}
                                style={{ width: '100px' }}
                              />
                            </td>
                            <td>
                              <Form.Select
                                value={item.condition}
                                onChange={(e) => handleUpdateItem(index, 'condition', e.target.value)}
                                style={{ minWidth: '120px' }}
                              >
                                <option value="Good">Good</option>
                                <option value="Defective">Defective</option>
                                <option value="Damaged">Damaged</option>
                              </Form.Select>
                            </td>
                            <td>
                              <Form.Control
                                type="text"
                                value={item.remarks}
                                onChange={(e) => handleUpdateItem(index, 'remarks', e.target.value)}
                                placeholder="Remarks..."
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </Card.Body>
              </Card>

              {/* Overall Remarks and Status */}
              <Card>
                <Card.Header className="bg-light">
                  <h6 className="mb-0">Overall Assessment</h6>
                </Card.Header>
                <Card.Body>
                  <Form.Group className="mb-3">
                    <Form.Label>Overall Remarks</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={inspectionReport.overall_remarks}
                      onChange={(e) => setInspectionReport({ ...inspectionReport, overall_remarks: e.target.value })}
                      placeholder="Enter overall inspection remarks..."
                    />
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Inspection Status *</Form.Label>
                    <Form.Select
                      value={inspectionReport.status}
                      onChange={(e) => setInspectionReport({ ...inspectionReport, status: e.target.value as any })}
                      required
                    >
                      <option value="Accepted">Accepted</option>
                      <option value="Partial">Partial</option>
                      <option value="Rejected">Rejected</option>
                    </Form.Select>
                  </Form.Group>
                </Card.Body>
              </Card>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmitInspection}>
            <i className="bi bi-check-circle me-2"></i>
            Submit Inspection Report
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

export default Inspection;
