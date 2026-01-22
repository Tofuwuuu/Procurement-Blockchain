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

      // Create inspection report
      const createdReport = await apiService.createInspectionReport(reportData);
      
      // Save to Inspected collection
      await apiService.createInspected(reportData);
      
      // Mark as inspected
      setInspectedPOs(prev => {
        const newSet = new Set(prev);
        newSet.add(inspectionReport.po_number);
        return newSet;
      });
      
      let message = 'Inspection and Acceptance Report created successfully and saved to Inspected collection';
      
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
          <Button 
            variant="primary" 
            onClick={handleSubmitInspection}
            disabled={inspectedPOs.has(inspectionReport.po_number)}
          >
            <i className="bi bi-check-circle me-2"></i>
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
