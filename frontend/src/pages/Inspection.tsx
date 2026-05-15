import React, { useState, useEffect } from 'react';
import { 
  Container, Row, Col, Card, Table, Button,
  Form, Modal, InputGroup 
} from 'react-bootstrap';
import { apiService, PurchaseOrder } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import './Inspection.css';

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

const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

const Inspection: React.FC = () => {
  const { user } = useAuth();
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
  const [inspectedPOs, setInspectedPOs] = useState<Set<string>>(new Set());
  
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
    loadInspectedPOs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadInspectedPOs = async () => {
    try {
      const inspected = await apiService.getInspected();
      const inspectedSet = new Set(inspected.map((item: any) => item.po_number));
      setInspectedPOs(inspectedSet);
    } catch (error) {
      console.error('Error loading inspected POs:', error);
    }
  };

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
      
      // Fetch inspections from the inspection database (confirmed purchase orders)
      console.log('🔍 Fetching inspections from API...');
      const inspections = await apiService.getInspections();
      
      console.log('📋 Inspections from database:', inspections);
      console.log('📊 Number of inspections:', inspections?.length || 0);
      
      if (!inspections || inspections.length === 0) {
        console.log('⚠️ No inspections found in database');
        setOrders([]);
        return;
      }
      
      // Convert to PurchaseOrder format
      const convertedOrders: PurchaseOrder[] = inspections.map((inspection: any) => {
        // Handle missing or invalid data
        if (!inspection.items || !Array.isArray(inspection.items)) {
          console.warn('⚠️ Inspection missing items array:', inspection);
          inspection.items = [];
        }
        
        return {
          id: parseInt(inspection.id) || hashString(inspection.id || inspection.po_number),
          po_number: inspection.po_number || inspection.pr_number || 'N/A',
          supplier_id: inspection.supplier_id ? hashString(inspection.supplier_id) : 0,
          supplier: {
            id: inspection.supplier_id ? hashString(inspection.supplier_id) : 0,
            name: inspection.supplier_name || 'N/A',
            address: inspection.supplier_address || '',
            province: '',
            contact_person: inspection.supplier_contact || '',
            phone: inspection.supplier_phone || '',
            email: '',
            bir_tin: inspection.supplier_bir_tin || '',
            is_active: true,
            created_at: inspection.date_created || new Date().toISOString(),
            updated_at: inspection.date_updated || inspection.date_created || new Date().toISOString()
          },
          delivery_address: inspection.delivery_address || '',
          notes: inspection.notes || '',
          status: 'Completed' as const,
          total_amount: inspection.total_amount || 0,
          date_created: inspection.date_created || new Date().toISOString(),
          date_updated: inspection.date_updated || inspection.date_created || new Date().toISOString(),
          items: inspection.items.map((item: any, index: number) => ({
            id: index + 1,
            product_id: index + 1,
            product: {
              id: index + 1,
              name: item.item_description || 'Unknown Item',
              unit: item.unit || 'pcs',
              unit_price: item.unit_cost || 0,
              category: '',
              is_active: true,
              description: ''
            },
            quantity: item.quantity || 0,
            unit_price: item.unit_cost || 0,
            total_price: item.total_cost || 0
          }))
        };
      });
      
      console.log('✅ Converted orders for inspection:', convertedOrders);
      console.log('📊 Number of converted orders:', convertedOrders.length);
      setOrders(convertedOrders);
    } catch (error: any) {
      console.error('❌ Error fetching inspections:', error);
      console.error('Error details:', error.response?.data || error.message);
      setToastMessage(error.response?.data?.detail || error.message || 'Failed to fetch inspections. Please try again.');
      setToastType('error');
      setShowToast(true);
      setOrders([]);
    } finally {
      setLoading(false);
    }
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
      // Submit inspection report to backend API
      const reportData = {
        po_number: inspectionReport.po_number,
        inspection_date: inspectionReport.inspection_date,
        inspected_by: inspectionReport.inspected_by,
        items: inspectionReport.items.map(item => ({
          item_description: item.item_description,
          quantity_ordered: item.quantity_ordered,
          quantity_received: item.quantity_received,
          unit: item.unit,
          unit_price: item.unit_price,
          condition: item.condition,
          remarks: item.remarks || ''
        })),
        overall_remarks: inspectionReport.overall_remarks || '',
        status: inspectionReport.status
      };

      // The backend creates the accepted inspected record automatically.
      await apiService.createInspectionReport(reportData);
      
      // Mark as inspected
      setInspectedPOs(prev => {
        const newSet = new Set(prev);
        newSet.add(inspectionReport.po_number);
        return newSet;
      });
      
      let message = 'Inspection and Acceptance Report created successfully';
      
      // If status is "Accepted", custodian slip is automatically created by backend
      if (inspectionReport.status === 'Accepted') {
        message += '. Inventory Custodian Slip has been automatically created.';
      }
      
      setToastMessage(message);
      setToastType('success');
      setShowToast(true);
      setShowModal(false);
      
      // Refresh orders list
      await fetchOrders();
      await loadInspectedPOs();
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

  const inspectedCount = orders.filter(order => inspectedPOs.has(order.po_number)).length;
  const readyCount = orders.length - inspectedCount;
  const totalReadyValue = orders
    .filter(order => !inspectedPOs.has(order.po_number))
    .reduce((sum, order) => sum + (order.total_amount || 0), 0);
  const itemCount = orders.reduce((sum, order) => sum + order.items.length, 0);

  const getConditionClass = (condition: InspectionItem['condition']) => {
    if (condition === 'Good') return 'is-good';
    if (condition === 'Defective') return 'is-defective';
    return 'is-damaged';
  };

  if (loading) {
    return (
      <Container fluid className="inspection-page py-4">
        <div className="inspection-loading">
          <LoadingSpinner size="lg" text="Loading inspection queue..." />
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="inspection-page py-4">
      <section className="inspection-hero mb-4">
        <div className="inspection-hero-copy">
          <span className="inspection-eyebrow">Receiving control</span>
          <h1>Inspection and Acceptance Report</h1>
          <p>Create acceptance records for received purchase orders and keep every item ready for audit.</p>
        </div>
      </section>

      <Row className="g-3 mb-4">
        <Col md={6} xl={3}>
          <Card className="inspection-stat-card">
            <Card.Body>
              <span>Ready for inspection</span>
              <strong>{readyCount}</strong>
              <small>Purchase orders awaiting review</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} xl={3}>
          <Card className="inspection-stat-card">
            <Card.Body>
              <span>Already inspected</span>
              <strong>{inspectedCount}</strong>
              <small>Reports already submitted</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} xl={3}>
          <Card className="inspection-stat-card">
            <Card.Body>
              <span>Queue value</span>
              <strong>{formatCurrency(totalReadyValue)}</strong>
              <small>Uninspected order amount</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} xl={3}>
          <Card className="inspection-stat-card">
            <Card.Body>
              <span>Line items</span>
              <strong>{itemCount}</strong>
              <small>Items across the queue</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Orders Table */}
      <Card className="inspection-table-card shadow-sm">
        <Card.Header>
          <div>
            <h5>Purchase orders ready for inspection</h5>
            <p>{filteredOrders.length} of {orders.length} records shown</p>
          </div>
          <InputGroup className="inspection-search">
            <InputGroup.Text>
              <i className="bi bi-search" aria-hidden="true"></i>
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Search PO/PR number or supplier"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
        </Card.Header>
        <Card.Body>
          {filteredOrders.length > 0 ? (
            <div className="table-responsive">
              <Table hover className="inspection-table">
                <thead>
                  <tr>
                    <th>PO/PR Number</th>
                    <th>Supplier/Entity</th>
                    <th>Date Created</th>
                    <th>Items</th>
                    <th>Total Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className={inspectedPOs.has(order.po_number) ? 'is-inspected' : ''}>
                      <td><strong className="inspection-number">{order.po_number}</strong></td>
                      <td>
                        <div className="inspection-supplier">{order.supplier.name}</div>
                        {order.delivery_address && <small>{order.delivery_address}</small>}
                      </td>
                      <td>{formatDate(order.date_created)}</td>
                      <td>{order.items.length}</td>
                      <td><strong>{formatCurrency(order.total_amount)}</strong></td>
                      <td>
                        <span className={`inspection-status ${inspectedPOs.has(order.po_number) ? 'is-done' : 'is-ready'}`}>
                          {inspectedPOs.has(order.po_number) ? 'Inspected' : 'Ready'}
                        </span>
                      </td>
                      <td>
                        <Button
                          size="sm"
                          className="inspection-action-btn"
                          onClick={() => handleCreateInspection(order)}
                          disabled={inspectedPOs.has(order.po_number)}
                        >
                          <i className="bi bi-clipboard-check" aria-hidden="true"></i>
                          {inspectedPOs.has(order.po_number) ? 'Completed' : 'Create Report'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <div className="inspection-empty-state">
              <i className="bi bi-clipboard-check" aria-hidden="true"></i>
              <h5>No inspection queue records found</h5>
              <p>
                {searchTerm 
                  ? 'Try another search term or clear the search field.' 
                  : 'No purchase orders are ready for inspection yet.'}
              </p>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Inspection Report Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="xl" centered className="inspection-modal">
        <Modal.Header closeButton>
          <Modal.Title>
            <span>Create document</span>
            <strong>Inspection and Acceptance Report</strong>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedOrder && (
            <>
              {/* Order Information */}
              <div className="inspection-document-heading">
                <div>
                  <span>PO/PR Number</span>
                  <h3>{selectedOrder.po_number}</h3>
                  <p>{selectedOrder.supplier.name}</p>
                </div>
                <span className="inspection-status is-ready">Ready for inspection</span>
              </div>

              <Row className="g-3 mb-4">
                <Col md={4}>
                  <div className="inspection-detail-tile">
                    <span>Date Created</span>
                    <strong>{formatDate(selectedOrder.date_created)}</strong>
                  </div>
                </Col>
                <Col md={4}>
                  <div className="inspection-detail-tile">
                    <span>Total Amount</span>
                    <strong>{formatCurrency(selectedOrder.total_amount)}</strong>
                  </div>
                </Col>
                <Col md={4}>
                  <div className="inspection-detail-tile">
                    <span>Line Items</span>
                    <strong>{selectedOrder.items.length}</strong>
                  </div>
                </Col>
              </Row>

              {/* Inspection Details */}
              <Card className="inspection-form-card mb-3">
                <Card.Body>
                  <div className="inspection-form-section">
                    <h6>Inspection details</h6>
                    <p>Record who inspected the delivery and when it was reviewed.</p>
                  </div>
                  <Row className="g-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label className="inspection-form-label">Inspection Date *</Form.Label>
                        <Form.Control
                          type="date"
                          value={inspectionReport.inspection_date}
                          onChange={(e) => setInspectionReport({ ...inspectionReport, inspection_date: e.target.value })}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label className="inspection-form-label">Inspected By *</Form.Label>
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
              <Card className="inspection-items-card mb-3">
                <Card.Header>
                  <div>
                    <h6>Items inspection</h6>
                    <p>Confirm received quantities, item condition, and item-level remarks.</p>
                  </div>
                </Card.Header>
                <Card.Body>
                  <div className="table-responsive">
                    <Table className="inspection-detail-table">
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
                            <td className="text-center">{item.quantity_ordered}</td>
                            <td>
                              <Form.Control
                                type="number"
                                min="0"
                                max={item.quantity_ordered}
                                value={item.quantity_received}
                                onChange={(e) => handleUpdateItem(index, 'quantity_received', Number(e.target.value))}
                                className="inspection-qty-input"
                              />
                            </td>
                            <td>
                              <Form.Select
                                value={item.condition}
                                onChange={(e) => handleUpdateItem(index, 'condition', e.target.value)}
                                className={`inspection-condition-select ${getConditionClass(item.condition)}`}
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
              <Card className="inspection-form-card">
                <Card.Body>
                  <div className="inspection-form-section">
                    <h6>Overall assessment</h6>
                    <p>Choose the final acceptance status and add remarks for the record.</p>
                  </div>
                  <Form.Group className="mb-3">
                    <Form.Label className="inspection-form-label">Overall Remarks</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={inspectionReport.overall_remarks}
                      onChange={(e) => setInspectionReport({ ...inspectionReport, overall_remarks: e.target.value })}
                      placeholder="Enter overall inspection remarks..."
                    />
                  </Form.Group>
                  <Form.Group>
                    <Form.Label className="inspection-form-label">Inspection Status *</Form.Label>
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
          <Button variant="outline-secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button 
            className="inspection-submit-btn"
            onClick={handleSubmitInspection}
            disabled={inspectedPOs.has(inspectionReport.po_number)}
          >
            <i className="bi bi-check-circle" aria-hidden="true"></i>
            {inspectedPOs.has(inspectionReport.po_number) ? 'Already Inspected' : 'Submit Inspection Report'}
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
