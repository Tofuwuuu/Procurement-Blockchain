import React, { useState, useEffect } from 'react';
import { 
  Container, Row, Col, Card, Table, Button, Badge, 
  Form, Modal, Alert, InputGroup 
} from 'react-bootstrap';
import { apiService, Inventory as InventoryItem, Product } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';

// Realistic mock data for inventory
const mockProducts: Product[] = [
  {
    id: 1,
    name: 'Office Chairs - Ergonomic',
    description: 'High-quality ergonomic office chairs with adjustable features',
    unit: 'pieces',
    unit_price: 8500.00,
    category: 'Office Furniture',
    is_active: true
  },
  {
    id: 2,
    name: 'Laptop Stands',
    description: 'Adjustable laptop stands for better ergonomics',
    unit: 'pieces',
    unit_price: 1200.00,
    category: 'Office Accessories',
    is_active: true
  },
  {
    id: 3,
    name: 'Wireless Keyboards',
    description: 'Bluetooth wireless keyboards with backlit keys',
    unit: 'pieces',
    unit_price: 2500.00,
    category: 'Computer Peripherals',
    is_active: true
  },
  {
    id: 4,
    name: 'Desk Organizers',
    description: 'Multi-compartment desk organizers for office supplies',
    unit: 'pieces',
    unit_price: 800.00,
    category: 'Office Accessories',
    is_active: true
  },
  {
    id: 5,
    name: 'LED Desk Lamps',
    description: 'Adjustable LED desk lamps with USB charging ports',
    unit: 'pieces',
    unit_price: 1500.00,
    category: 'Office Accessories',
    is_active: true
  },
  {
    id: 6,
    name: 'Filing Cabinets',
    description: '4-drawer metal filing cabinets with lock',
    unit: 'pieces',
    unit_price: 12000.00,
    category: 'Office Furniture',
    is_active: true
  },
  {
    id: 7,
    name: 'Whiteboards',
    description: 'Large magnetic whiteboards for conference rooms',
    unit: 'pieces',
    unit_price: 3500.00,
    category: 'Office Equipment',
    is_active: true
  },
  {
    id: 8,
    name: 'Projector Screens',
    description: 'Retractable projector screens for presentations',
    unit: 'pieces',
    unit_price: 8000.00,
    category: 'Office Equipment',
    is_active: true
  },
  {
    id: 9,
    name: 'Coffee Makers',
    description: 'Commercial coffee makers for office use',
    unit: 'pieces',
    unit_price: 15000.00,
    category: 'Office Equipment',
    is_active: true
  },
  {
    id: 10,
    name: 'Air Purifiers',
    description: 'HEPA air purifiers for office air quality',
    unit: 'pieces',
    unit_price: 12000.00,
    category: 'Office Equipment',
    is_active: true
  }
];

const mockInventory: InventoryItem[] = [
  {
    id: 1,
    product_id: 1,
    quantity: 75,
    unit_price: 8500.00,
    total_value: 637500.00,
    last_updated: '2025-01-15T10:30:00Z',
    product: {
      id: 1,
      name: 'Office Chairs - Ergonomic',
      description: 'High-quality ergonomic office chairs with adjustable features',
      unit: 'pieces',
      unit_price: 8500.00,
      category: 'Office Furniture',
      is_active: true
    }
  },
  {
    id: 2,
    product_id: 2,
    quantity: 45,
    unit_price: 1200.00,
    total_value: 54000.00,
    last_updated: '2025-01-15T11:15:00Z',
    product: {
      id: 2,
      name: 'Laptop Stands',
      description: 'Adjustable laptop stands for better ergonomics',
      unit: 'pieces',
      unit_price: 1200.00,
      category: 'Office Accessories',
      is_active: true
    }
  },
  {
    id: 3,
    product_id: 3,
    quantity: 120,
    unit_price: 2500.00,
    total_value: 300000.00,
    last_updated: '2025-01-15T12:00:00Z',
    product: {
      id: 3,
      name: 'Wireless Keyboards',
      description: 'Bluetooth wireless keyboards with backlit keys',
      unit: 'pieces',
      unit_price: 2500.00,
      category: 'Computer Peripherals',
      is_active: true
    }
  },
  {
    id: 4,
    product_id: 4,
    quantity: 200,
    unit_price: 800.00,
    total_value: 160000.00,
    last_updated: '2025-01-15T13:45:00Z',
    product: {
      id: 4,
      name: 'Desk Organizers',
      description: 'Multi-compartment desk organizers for office supplies',
      unit: 'pieces',
      unit_price: 800.00,
      category: 'Office Accessories',
      is_active: true
    }
  },
  {
    id: 5,
    product_id: 5,
    quantity: 60,
    unit_price: 1500.00,
    total_value: 90000.00,
    last_updated: '2025-01-15T14:20:00Z',
    product: {
      id: 5,
      name: 'LED Desk Lamps',
      description: 'Adjustable LED desk lamps with USB charging ports',
      unit: 'pieces',
      unit_price: 1500.00,
      category: 'Office Accessories',
      is_active: true
    }
  },
  {
    id: 6,
    product_id: 6,
    quantity: 25,
    unit_price: 12000.00,
    total_value: 300000.00,
    last_updated: '2025-01-15T15:10:00Z',
    product: {
      id: 6,
      name: 'Filing Cabinets',
      description: '4-drawer metal filing cabinets with lock',
      unit: 'pieces',
      unit_price: 12000.00,
      category: 'Office Furniture',
      is_active: true
    }
  },
  {
    id: 7,
    product_id: 7,
    quantity: 15,
    unit_price: 3500.00,
    total_value: 52500.00,
    last_updated: '2025-01-15T16:30:00Z',
    product: {
      id: 7,
      name: 'Whiteboards',
      description: 'Large magnetic whiteboards for conference rooms',
      unit: 'pieces',
      unit_price: 3500.00,
      category: 'Office Equipment',
      is_active: true
    }
  },
  {
    id: 8,
    product_id: 8,
    quantity: 8,
    unit_price: 8000.00,
    total_value: 64000.00,
    last_updated: '2025-01-15T17:15:00Z',
    product: {
      id: 8,
      name: 'Projector Screens',
      description: 'Retractable projector screens for presentations',
      unit: 'pieces',
      unit_price: 8000.00,
      category: 'Office Equipment',
      is_active: true
    }
  },
  {
    id: 9,
    product_id: 9,
    quantity: 12,
    unit_price: 15000.00,
    total_value: 180000.00,
    last_updated: '2025-01-15T18:00:00Z',
    product: {
      id: 9,
      name: 'Coffee Makers',
      description: 'Commercial coffee makers for office use',
      unit: 'pieces',
      unit_price: 15000.00,
      category: 'Office Equipment',
      is_active: true
    }
  },
  {
    id: 10,
    product_id: 10,
    quantity: 18,
    unit_price: 12000.00,
    total_value: 216000.00,
    last_updated: '2025-01-15T19:30:00Z',
    product: {
      id: 10,
      name: 'Air Purifiers',
      description: 'HEPA air purifiers for office air quality',
      unit: 'pieces',
      unit_price: 12000.00,
      category: 'Office Equipment',
      is_active: true
    }
  }
];
void mockProducts;
void mockInventory;

const Inventory: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [searchTerm, setSearchTerm] = useState('');
  const [usingMockData, setUsingMockData] = useState(false);

  // Form state
  const [adjustmentData, setAdjustmentData] = useState({
    product_id: 0,
    adjustment: 0,
    reason: ''
  });

  // Form validation
  const [errors, setErrors] = useState<{ adjustment?: string; reason?: string }>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Try to fetch from API first
      try {
        const [inventoryData, productsData] = await Promise.all([
          apiService.getInventory(),
          apiService.getProducts()
        ]);
        
        // Transform inventory data to match frontend expectations
        const transformedInventory = inventoryData.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_value: item.total_value,
          last_updated: item.last_updated,
          product: {
            id: item.product_id,
            name: item.product_name,
            description: item.product_description,
            unit: item.product_unit,
            unit_price: item.unit_price,
            category: item.product_category,
            is_active: true
          }
        }));
        
        setInventory(transformedInventory);
        setProducts(productsData);
        setUsingMockData(false);
      } catch (apiError) {
        console.error('Inventory endpoint is not available:', apiError);
        setInventory([]);
        setProducts([]);
        setUsingMockData(false);
        setToastMessage('Inventory management is coming soon. The backend endpoint is not available yet.');
        setToastType('info');
        setShowToast(true);
      }
    } catch (error) {
      console.error('Failed to fetch inventory data:', error);
      setInventory([]);
      setProducts([]);
      setUsingMockData(false);
      setToastMessage('Inventory management is coming soon. The backend endpoint is not available yet.');
      setToastType('info');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { adjustment?: string; reason?: string } = {};

    if (adjustmentData.adjustment === 0) {
      newErrors.adjustment = 'Adjustment quantity cannot be zero';
    }

    if (!adjustmentData.reason.trim()) {
      newErrors.reason = 'Reason is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      if (usingMockData) {
        setToastMessage('Inventory adjustments are coming soon. The backend endpoint is not available yet.');
        setToastType('warning');
        setShowToast(true);
        return;
      } else {
        await apiService.adjustInventory(adjustmentData);
        setToastMessage('Inventory adjusted successfully');
        setToastType('success');
        setShowToast(true);
        setShowAdjustModal(false);
        resetForm();
        fetchData();
      }
    } catch (error: any) {
      console.error('Failed to adjust inventory:', error);
      setToastMessage(error.response?.data?.message || error.message || 'Failed to adjust inventory');
      setToastType('error');
      setShowToast(true);
    }
  };

  const handleShowAdjustModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setAdjustmentData({
      product_id: item.product_id,
      adjustment: 0,
      reason: ''
    });
    setShowAdjustModal(true);
  };

  const resetForm = () => {
    setAdjustmentData({
      product_id: 0,
      adjustment: 0,
      reason: ''
    });
    setErrors({});
    setSelectedItem(null);
  };

  const handleCloseModal = () => {
    setShowAdjustModal(false);
    resetForm();
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-PH');
  };

  const getStockLevelBadge = (quantity: number): { variant: string; text: string } => {
    if (quantity <= 0) {
      return { variant: 'danger', text: 'Out of Stock' };
    } else if (quantity <= 10) {
      return { variant: 'warning', text: 'Low Stock' };
    } else if (quantity <= 50) {
      return { variant: 'info', text: 'Medium Stock' };
    } else {
      return { variant: 'success', text: 'In Stock' };
    }
  };

  const filteredInventory = inventory.filter(item =>
    item.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Container>
        <LoadingSpinner size="lg" text="Loading inventory..." />
      </Container>
    );
  }

  return (
    <Container>
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <h1 className="h2 mb-0">Inventory Management</h1>
              </div>
              <p className="text-muted mb-0">
                Track stock levels and manage inventory adjustments
              </p>
            </div>
            <div className="d-flex gap-2">
              <Button 
                variant="outline-primary" 
                onClick={() => window.print()}
                aria-label="Print inventory report"
              >
                <i className="bi bi-printer me-2"></i>
                Print Report
              </Button>
            </div>
          </div>
        </Col>
      </Row>

      {/* Inventory Stats */}
      <Row className="g-3 mb-4">
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <h3 className="text-primary mb-1">{inventory.length}</h3>
              <p className="text-muted mb-0">Total Items</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <h3 className="text-success mb-1">
                {inventory.filter(item => item.quantity > 50).length}
              </h3>
              <p className="text-muted mb-0">In Stock</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <h3 className="text-warning mb-1">
                {inventory.filter(item => item.quantity <= 10 && item.quantity > 0).length}
              </h3>
              <p className="text-muted mb-0">Low Stock</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <h3 className="text-danger mb-1">
                {inventory.filter(item => item.quantity <= 0).length}
              </h3>
              <p className="text-muted mb-0">Out of Stock</p>
            </Card.Body>
          </Card>
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
              placeholder="Search inventory..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search inventory"
            />
          </InputGroup>
        </Col>
      </Row>

      {/* Inventory Table */}
      <Card>
        <Card.Header>
          <h5 className="mb-0">Inventory List</h5>
        </Card.Header>
        <Card.Body className="p-0">
          {filteredInventory.length > 0 ? (
            <div className="table-responsive">
              <Table striped bordered className="mb-0">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Total Value</th>
                    <th>Stock Level</th>
                    <th>Last Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item) => {
                    const stockLevel = getStockLevelBadge(item.quantity);
                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.product.name}</strong>
                          {item.product.description && (
                            <div className="small text-muted">{item.product.description}</div>
                          )}
                        </td>
                        <td>{item.product.category}</td>
                        <td>
                          <strong>{item.quantity}</strong>
                          <div className="small text-muted">{item.product.unit}</div>
                        </td>
                        <td>{formatCurrency(item.unit_price)}</td>
                        <td>
                          <strong>{formatCurrency(item.total_value)}</strong>
                        </td>
                        <td>
                          <Badge bg={stockLevel.variant}>{stockLevel.text}</Badge>
                        </td>
                        <td>{formatDate(item.last_updated)}</td>
                        <td>
                          <div className="d-flex gap-1">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleShowAdjustModal(item)}
                              aria-label={`Adjust ${item.product.name}`}
                            >
                              <i className="bi bi-pencil"></i>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-4">
              <i className="bi bi-box-seam text-muted" style={{ fontSize: '2rem' }}></i>
              <p className="text-muted mt-2">
                {searchTerm ? 'No inventory items found matching your search' : 'No inventory items found'}
              </p>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Adjustment Modal */}
      <Modal show={showAdjustModal} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title>Adjust Inventory</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleAdjustment}>
          <Modal.Body>
            {selectedItem && (
              <Alert variant="info">
                <strong>Current Stock:</strong> {selectedItem.quantity} {selectedItem.product.unit}
                <br />
                <strong>Product:</strong> {selectedItem.product.name}
              </Alert>
            )}

            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label htmlFor="adjustment">Adjustment Quantity *</Form.Label>
                  <Form.Control
                    id="adjustment"
                    type="number"
                    value={adjustmentData.adjustment}
                    onChange={(e) => setAdjustmentData({ ...adjustmentData, adjustment: Number(e.target.value) })}
                    isInvalid={!!errors.adjustment}
                    aria-describedby="adjustmentError"
                    placeholder="Enter positive or negative value"
                  />
                  <Form.Text className="text-muted">
                    Use positive values to add stock, negative to remove
                  </Form.Text>
                  <Form.Control.Feedback type="invalid" id="adjustmentError">
                    {errors.adjustment}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>

              <Col md={12}>
                <Form.Group>
                  <Form.Label htmlFor="reason">Reason for Adjustment *</Form.Label>
                  <Form.Select
                    id="reason"
                    value={adjustmentData.reason}
                    onChange={(e) => setAdjustmentData({ ...adjustmentData, reason: e.target.value })}
                    isInvalid={!!errors.reason}
                    aria-describedby="reasonError"
                  >
                    <option value="">Select Reason</option>
                    <option value="Received from supplier">Received from supplier</option>
                    <option value="Damaged goods">Damaged goods</option>
                    <option value="Expired items">Expired items</option>
                    <option value="Theft/Loss">Theft/Loss</option>
                    <option value="Physical count adjustment">Physical count adjustment</option>
                    <option value="Other">Other</option>
                  </Form.Select>
                  <Form.Control.Feedback type="invalid" id="reasonError">
                    {errors.reason}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>

              {adjustmentData.reason === 'Other' && (
                <Col md={12}>
                  <Form.Group>
                    <Form.Label htmlFor="customReason">Custom Reason</Form.Label>
                    <Form.Control
                      id="customReason"
                      as="textarea"
                      rows={2}
                      value={adjustmentData.reason === 'Other' ? '' : adjustmentData.reason}
                      onChange={(e) => setAdjustmentData({ ...adjustmentData, reason: e.target.value })}
                      placeholder="Please specify the reason for adjustment"
                    />
                  </Form.Group>
                </Col>
              )}
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Adjust Inventory
            </Button>
          </Modal.Footer>
        </Form>
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

export default Inventory;
