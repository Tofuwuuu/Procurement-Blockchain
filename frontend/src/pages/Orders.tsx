import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, Row, Col, Card, Table, Button, Badge, 
  Form, Modal, Alert, Spinner, InputGroup 
} from 'react-bootstrap';
import { apiService, PurchaseOrder, CreateOrderData, Supplier, Product, PurchaseRequest, CreatePurchaseRequestData } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';

// Mock data for demonstration
const mockSuppliers: Supplier[] = [
  {
    id: 1,
    name: "TechDistributors Inc",
    address: "123 Tech Street, Makati City",
    province: "Metro Manila",
    contact_person: "Juan Dela Cruz",
    phone: "+63 2 1234 5678",
    email: "contact@techdistributors.com",
    bir_tin: "123-456-789-000",
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z"
  },
  {
    id: 2,
    name: "ABC Supplies",
    address: "456 Supply Avenue, Quezon City",
    province: "Metro Manila",
    contact_person: "Maria Santos",
    phone: "+63 2 2345 6789",
    email: "info@abcsupplies.com",
    bir_tin: "234-567-890-000",
    is_active: true,
    created_at: "2024-01-02T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z"
  },
  {
    id: 3,
    name: "Metro Manila Electronics",
    address: "789 Electronics Road, Pasig City",
    province: "Metro Manila",
    contact_person: "Pedro Martinez",
    phone: "+63 2 3456 7890",
    email: "sales@metroelectronics.com",
    bir_tin: "345-678-901-000",
    is_active: true,
    created_at: "2024-01-03T00:00:00Z",
    updated_at: "2024-01-03T00:00:00Z"
  }
];

const mockProducts: Product[] = [
  {
    id: 1,
    name: "Office Chairs - Ergonomic",
    description: "High-quality ergonomic office chairs with adjustable features",
    unit: "pieces",
    unit_price: 2500.00,
    category: "Office Furniture",
    is_active: true
  },
  {
    id: 2,
    name: "Laptop Stands",
    description: "Adjustable laptop stands for better ergonomics",
    unit: "pieces",
    unit_price: 800.00,
    category: "Office Equipment",
    is_active: true
  },
  {
    id: 3,
    name: "Wireless Keyboards",
    description: "Bluetooth wireless keyboards with backlit keys",
    unit: "pieces",
    unit_price: 1200.00,
    category: "Computer Accessories",
    is_active: true
  },
  {
    id: 4,
    name: "Desk Organizers",
    description: "Multi-compartment desk organizers for office supplies",
    unit: "pieces",
    unit_price: 350.00,
    category: "Office Supplies",
    is_active: true
  }
];

const mockOrders: PurchaseOrder[] = [
  {
    id: 1,
    po_number: "PO-20250101-001",
    supplier_id: 1,
    supplier: mockSuppliers[0],
    delivery_address: "123 Ayala Avenue, Makati City, Philippines",
    notes: "Urgent delivery required",
    status: "Draft",
    total_amount: 60000.00,
    date_created: "2025-01-01T10:30:00Z",
    date_updated: "2025-01-01T10:30:00Z",
    items: [
      {
        id: 1,
        product_id: 1,
        product: mockProducts[0],
        quantity: 20,
        unit_price: 2500.00,
        total_price: 50000.00
      },
      {
        id: 2,
        product_id: 2,
        product: mockProducts[1],
        quantity: 10,
        unit_price: 800.00,
        total_price: 8000.00
      }
    ]
  },
  {
    id: 2,
    po_number: "PO-20250101-002",
    supplier_id: 2,
    supplier: mockSuppliers[1],
    delivery_address: "456 Supply Avenue, Quezon City, Philippines",
    notes: "Standard delivery",
    status: "Pending",
    total_amount: 45000.00,
    date_created: "2025-01-02T14:15:00Z",
    date_updated: "2025-01-02T14:15:00Z",
    items: [
      {
        id: 3,
        product_id: 3,
        product: mockProducts[2],
        quantity: 30,
        unit_price: 1200.00,
        total_price: 36000.00
      },
      {
        id: 4,
        product_id: 4,
        product: mockProducts[3],
        quantity: 25,
        unit_price: 350.00,
        total_price: 8750.00
      }
    ]
  },
  {
    id: 3,
    po_number: "PO-20250101-003",
    supplier_id: 3,
    supplier: mockSuppliers[2],
    delivery_address: "789 Electronics Road, Pasig City, Philippines",
    notes: "Premium delivery service",
    status: "Approved",
    total_amount: 75000.00,
    date_created: "2025-01-03T09:45:00Z",
    date_updated: "2025-01-03T09:45:00Z",
    items: [
      {
        id: 5,
        product_id: 1,
        product: mockProducts[0],
        quantity: 25,
        unit_price: 2500.00,
        total_price: 62500.00
      },
      {
        id: 6,
        product_id: 2,
        product: mockProducts[1],
        quantity: 15,
        unit_price: 800.00,
        total_price: 12000.00
      }
    ]
  },
  {
    id: 4,
    po_number: "PO-20250101-004",
    supplier_id: 1,
    supplier: mockSuppliers[0],
    delivery_address: "123 Ayala Avenue, Makati City, Philippines",
    notes: "Completed order",
    status: "Completed",
    total_amount: 32000.00,
    date_created: "2025-01-04T16:20:00Z",
    date_updated: "2025-01-05T10:30:00Z",
    items: [
      {
        id: 7,
        product_id: 4,
        product: mockProducts[3],
        quantity: 80,
        unit_price: 350.00,
        total_price: 28000.00
      },
      {
        id: 8,
        product_id: 2,
        product: mockProducts[1],
        quantity: 5,
        unit_price: 800.00,
        total_price: 4000.00
      }
    ]
  }
];

const Orders: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [searchTerm, setSearchTerm] = useState('');
  const [usingMockData, setUsingMockData] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [selectedRequestItems, setSelectedRequestItems] = useState<any[]>([]);

  // Form state
  const [formData, setFormData] = useState<CreateOrderData>({
    supplier_id: 0,
    delivery_address: '',
    notes: '',
    items: []
  });

  // Employee purchase request form state
  const [employeeFormData, setEmployeeFormData] = useState({
    entity_name: user?.full_name || user?.username || '',
    fund_cluster: '',
    office_section: user?.department || '',
    responsibility_center_code: '',
    date: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '/'),
    remark: '',
    items: Array(4).fill(null).map(() => ({
      unit: '',
      item_description: '',
      quantity: 0,
      unit_cost: 0.0,
      total_cost: 0.0
    }))
  });

  // Form validation
  const [errors, setErrors] = useState<{
    supplier_id?: string;
    delivery_address?: string;
    notes?: string;
    items?: string;
  }>({});

  // Convert purchase requests (from backend) into the purchase order shape
  const mapPurchaseRequestsToOrders = (purchaseRequests: PurchaseRequest[]): PurchaseOrder[] => {
    return purchaseRequests.map((pr: PurchaseRequest) => ({
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
        bir_tin: '',
        is_active: true,
        created_at: pr.date_created,
        updated_at: pr.date_updated || pr.date_created
      },
      delivery_address: pr.office_section,
      notes: pr.remark || '',
      status: pr.status === 'Pending' ? 'Pending' : pr.status === 'Approved' ? 'Approved' : 'Draft',
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
          is_active: true
        },
        quantity: item.quantity,
        unit_price: item.unit_cost,
        total_price: item.total_cost
      }))
    }));
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Update employee form data when user changes
    if (user) {
      setEmployeeFormData({
        ...employeeFormData,
        entity_name: user.full_name || user.username || '',
        office_section: user.department || '',
        date: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '/')
      });
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Try to fetch from API first
      try {
        if (user?.role === 'employee') {
          // For employees, fetch purchase requests
          console.log('📥 Fetching purchase requests for employee...');
          const purchaseRequests = await apiService.getPurchaseRequests(true);
          console.log('✅ Fetched purchase requests:', purchaseRequests);
          // Convert purchase requests to purchase orders format for display
          const convertedOrders: PurchaseOrder[] = mapPurchaseRequestsToOrders(purchaseRequests);
          setOrders(convertedOrders);
          setUsingMockData(false);
        } else {
          // For other roles, fetch purchase orders
          const [ordersData, suppliersData, productsData] = await Promise.all([
            apiService.getOrders(),
            apiService.getSuppliers(),
            apiService.getProducts()
          ]);
          setOrders(ordersData);
          setSuppliers(suppliersData);
          setProducts(productsData);
          setUsingMockData(false);
        }
      } catch (apiError) {
        console.log('API not available, using mock data...', apiError);
        // Use mock data if API fails
        setOrders(mockOrders);
        setSuppliers(mockSuppliers);
        setProducts(mockProducts);
        setUsingMockData(true);
        
        // No toast notification needed
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      // Fallback to mock data
      setOrders(mockOrders);
      setSuppliers(mockSuppliers);
      setProducts(mockProducts);
      setUsingMockData(true);
      
      // No toast notification needed
    } finally {
      setLoading(false);
    }
  };

  // Helper function to hash string to number
  const hashString = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  };

  const validateForm = (): boolean => {
    const newErrors: {
      supplier_id?: string;
      delivery_address?: string;
      notes?: string;
      items?: string;
    } = {};

    if (!formData.supplier_id) {
      newErrors.supplier_id = 'Supplier is required';
    }

    if (!formData.delivery_address.trim()) {
      newErrors.delivery_address = 'Delivery address is required';
    }

    if (formData.items.length === 0) {
      newErrors.items = 'At least one item is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Handle employee purchase request form
    if (user?.role === 'employee') {
      try {
        // Calculate total from employee form items
        const totalAmount = employeeFormData.items.reduce((sum, item) => sum + item.total_cost, 0);
        
        // Prepare purchase request data
        const purchaseRequestData: CreatePurchaseRequestData = {
          entity_name: employeeFormData.entity_name,
          fund_cluster: employeeFormData.fund_cluster,
          office_section: employeeFormData.office_section,
          responsibility_center_code: employeeFormData.responsibility_center_code,
          date: employeeFormData.date,
          remark: employeeFormData.remark || employeeFormData.fund_cluster || 'No remarks',
          items: employeeFormData.items
            .filter(item => item.item_description && item.quantity > 0)
            .map(item => ({
              unit: item.unit,
              item_description: item.item_description,
              quantity: item.quantity,
              unit_cost: item.unit_cost,
              total_cost: item.total_cost
            }))
        };

        if (usingMockData) {
          // Simulate API call for mock data
          const year = new Date().getFullYear();
          const prCount = orders.filter(o => o.po_number.startsWith(`PR-${year}-`)).length + 1;
          const prNumber = `PR-${year}-${String(prCount).padStart(3, '0')}`;
          
          const newOrder: PurchaseOrder = {
            id: orders.length + 1,
            po_number: prNumber,
            supplier_id: 0,
            supplier: { id: 0, name: employeeFormData.entity_name, address: '', province: '', contact_person: '', phone: '', bir_tin: '', is_active: true, created_at: '', updated_at: '' },
            delivery_address: employeeFormData.office_section,
            notes: employeeFormData.fund_cluster || 'No remarks',
            status: 'Pending',
            total_amount: totalAmount,
            date_created: new Date().toISOString(),
            date_updated: new Date().toISOString(),
            items: purchaseRequestData.items.map((item, index) => ({
              id: index + 1,
              product_id: index + 1,
              product: { id: index + 1, name: item.item_description, unit: item.unit, unit_price: item.unit_cost, category: '', is_active: true },
              quantity: item.quantity,
              unit_price: item.unit_cost,
              total_price: item.total_cost
            }))
          };

          setOrders([...orders, newOrder]);
          setToastMessage('Purchase request submitted successfully (Demo)');
        } else {
          // Real API call - save to purchase_requests collection
          console.log('📤 Submitting purchase request to backend:', purchaseRequestData);
          const createdPR = await apiService.createPurchaseRequest(purchaseRequestData);
          console.log('✅ Purchase request created successfully:', createdPR);
          setToastMessage('Purchase request submitted successfully');
          // Refresh the list to show the new request
          await fetchData();
        }
        
        setToastType('success');
        setShowToast(true);
        setShowModal(false);
        resetForm();
      } catch (error: any) {
        console.error('Failed to submit purchase request:', error);
        setToastMessage(error.response?.data?.message || 'Failed to submit purchase request');
        setToastType('error');
        setShowToast(true);
      }
      return;
    }
    
    // Original form validation and submission for non-employee roles
    if (!validateForm()) return;

    try {
      if (usingMockData) {
        // Simulate API call for mock data
        const newOrder: PurchaseOrder = {
          id: orders.length + 1,
          po_number: `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(orders.length + 1).padStart(3, '0')}`,
          supplier_id: formData.supplier_id,
          supplier: suppliers.find(s => s.id === formData.supplier_id)!,
          delivery_address: formData.delivery_address,
          notes: formData.notes || '',
          status: 'Draft',
          total_amount: formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0),
          date_created: new Date().toISOString(),
          date_updated: new Date().toISOString(),
          items: formData.items.map((item, index) => ({
            id: index + 1,
            product_id: item.product_id,
            product: products.find(p => p.id === item.product_id)!,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.quantity * item.unit_price
          }))
        };

        if (editingOrder) {
          setOrders(orders.map(order => order.id === editingOrder.id ? { ...newOrder, id: editingOrder.id } : order));
          setToastMessage('Purchase order updated successfully (Demo)');
        } else {
          setOrders([...orders, newOrder]);
          setToastMessage('Purchase order created successfully (Demo)');
        }
      } else {
        // Real API call
        if (editingOrder) {
          await apiService.updateOrder(editingOrder.id, formData);
          setToastMessage('Purchase order updated successfully');
        } else {
          await apiService.createOrder(formData);
          setToastMessage('Purchase order created successfully');
        }
        fetchData();
      }
      
      setToastType('success');
      setShowToast(true);
      setShowModal(false);
      resetForm();
    } catch (error: any) {
      console.error('Failed to save order:', error);
      setToastMessage(error.response?.data?.message || 'Failed to save order');
      setToastType('error');
      setShowToast(true);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      if (usingMockData) {
        // Simulate approval for mock data
        setOrders(orders.map(order => 
          order.id === id ? { ...order, status: 'Approved' as const } : order
        ));
        setToastMessage('Purchase order approved successfully (Demo)');
      } else {
        await apiService.approveOrder(id);
        setToastMessage('Purchase order approved successfully');
        fetchData();
      }
      setToastType('success');
      setShowToast(true);
    } catch (error: any) {
      console.error('Failed to approve order:', error);
      setToastMessage(error.response?.data?.message || 'Failed to approve order');
      setToastType('error');
      setShowToast(true);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this purchase order?')) return;

    try {
      if (usingMockData) {
        // Simulate deletion for mock data
        setOrders(orders.filter(order => order.id !== id));
        setToastMessage('Purchase order deleted successfully (Demo)');
      } else {
        await apiService.deleteOrder(id);
        setToastMessage('Purchase order deleted successfully');
        fetchData();
      }
      setToastType('success');
      setShowToast(true);
    } catch (error: any) {
      console.error('Failed to delete order:', error);
      setToastMessage(error.response?.data?.message || 'Failed to delete order');
      setToastType('error');
      setShowToast(true);
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { product_id: 0, quantity: 1, unit_price: 0 }]
    });
  };

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const resetForm = () => {
    setFormData({
      supplier_id: 0,
      delivery_address: '',
      notes: '',
      items: []
    });
    setEmployeeFormData({
      entity_name: user?.full_name || user?.username || '',
      fund_cluster: '',
      office_section: user?.department || '',
      responsibility_center_code: '',
      date: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '/'),
      remark: '',
      items: Array(4).fill(null).map(() => ({
        unit: '',
        item_description: '',
        quantity: 0,
        unit_cost: 0.0,
        total_cost: 0.0
      }))
    });
    setErrors({});
    setEditingOrder(null);
  };

  const handleShowModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
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

  const filteredOrders = orders.filter(order =>
    order.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Container>
        <LoadingSpinner size="lg" text="Loading orders..." />
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
              <h1 className="h2 mb-1">
                {user?.role === 'employee' ? 'Purchase Requests' : 'Purchase Orders'}
              </h1>
              <p className="text-muted mb-0">
                {user?.role === 'employee' 
                  ? 'Manage purchase requests and track procurement activities'
                  : 'Manage purchase orders and track procurement activities'
                }
              </p>
            </div>
            <Button 
              variant="primary" 
              onClick={handleShowModal}
              aria-label="Create new purchase order"
            >
              <i className="bi bi-plus-circle me-2"></i>
              {user?.role === 'employee' ? 'New Request' : 'New Order'}
            </Button>
          </div>
        </Col>
      </Row>

      {/* Employee Purchase Request List */}
      {user?.role === 'employee' ? (
        <Card>
          <Card.Body className="p-0">
            <div className="table-responsive">
              <Table striped bordered className="mb-0">
                <thead className="bg-light">
                  <tr>
                    <th>
                      STATUS
                      <i className="bi bi-arrow-up-down ms-2"></i>
                    </th>
                    <th>
                      DATE REQUESTED
                      <i className="bi bi-arrow-up-down ms-2"></i>
                    </th>
                    <th>
                      REQUESTED BY
                      <i className="bi bi-arrow-up-down ms-2"></i>
                    </th>
                    <th>
                      P.R. NUMBER
                      <i className="bi bi-arrow-up-down ms-2"></i>
                    </th>
                    <th>
                      REMARK
                      <i className="bi bi-arrow-up-down ms-2"></i>
                    </th>
                    <th>DETAILS</th>
                  </tr>
                </thead>
                <tbody>
                  {orders
                    .filter(order => order.po_number.startsWith('PR-') || user?.role === 'employee')
                    .map((order) => {
                      // Determine status based on order status
                      let statusBadge = <Badge bg="warning">Pending</Badge>;
                      if (order.status === 'Approved') {
                        statusBadge = <Badge bg="success">Approved</Badge>;
                      } else if (order.status === 'Draft' || order.status === 'Pending') {
                        statusBadge = <Badge bg="warning">Pending</Badge>;
                      } else if (order.status === 'Completed') {
                        statusBadge = <Badge bg="info">For Canvass</Badge>;
                      }
                      
                      // Format date as YYYY-MM-DD
                      const dateRequested = new Date(order.date_created).toISOString().split('T')[0];
                      
                      // P.R. Number - use po_number if it starts with PR, otherwise N/A
                      const prNumber = order.po_number.startsWith('PR-') ? order.po_number : 'N/A';
                      
                      // Remark from notes - extract if it contains "Fund Cluster" or use as-is
                      let remark = order.notes || 'No remarks';
                      if (remark.includes('Fund Cluster:')) {
                        // Extract the part after "Fund Cluster:" or use the whole note
                        remark = remark.split('Fund Cluster:')[1]?.split(',')[0]?.trim() || remark;
                      }
                      
                      // Requested by - use supplier name if it's the entity name, otherwise use current user
                      const requestedBy = order.supplier.name === employeeFormData.entity_name 
                        ? employeeFormData.entity_name 
                        : (user?.full_name || user?.username || 'N/A');
                      
                      return (
                        <tr key={order.id}>
                          <td>{statusBadge}</td>
                          <td>{dateRequested}</td>
                          <td>{requestedBy}</td>
                          <td>{prNumber}</td>
                          <td>
                            <span className="text-danger">{remark}</span>
                          </td>
                          <td>
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => {
                                setSelectedRequestItems(order.items || []);
                                setShowItemsModal(true);
                              }}
                            >
                              <i className="bi bi-file-earmark-text me-1"></i>
                              View
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-4 text-muted">
                        No purchase requests found
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      ) : (
        <>
          {/* Search */}
          <Row className="mb-4">
            <Col md={6}>
              <InputGroup>
                <InputGroup.Text>
                  <i className="bi bi-search"></i>
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  aria-label="Search orders"
                />
              </InputGroup>
            </Col>
          </Row>

          {/* Orders Table */}
          <Card>
            <Card.Header>
              <h5 className="mb-0">Purchase Orders</h5>
            </Card.Header>
            <Card.Body className="p-0">
              {filteredOrders.length > 0 ? (
                <div className="table-responsive">
                  <Table striped bordered className="mb-0">
                    <thead>
                      <tr>
                        <th>PO Number</th>
                        <th>Supplier</th>
                        <th>Date Created</th>
                        <th>Status</th>
                        <th>Total Amount</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((order) => (
                        <tr key={order.id}>
                          <td>
                            <strong>{order.po_number}</strong>
                          </td>
                          <td>{order.supplier.name}</td>
                          <td>{formatDate(order.date_created)}</td>
                          <td>{getStatusBadge(order.status)}</td>
                          <td>
                            <strong>{formatCurrency(order.total_amount)}</strong>
                          </td>
                          <td>
                            <div className="d-flex gap-1">
                              <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => navigate(`/orders/${order.id}`)}
                                aria-label={`View ${order.po_number}`}
                              >
                                <i className="bi bi-eye"></i>
                              </Button>
                              {order.status === 'Draft' && (
                                <Button
                                  variant="outline-success"
                                  size="sm"
                                  onClick={() => handleApprove(order.id)}
                                  aria-label={`Approve ${order.po_number}`}
                                >
                                  <i className="bi bi-check"></i>
                                </Button>
                              )}
                              {user?.is_admin && order.status === 'Draft' && (
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={() => handleDelete(order.id)}
                                  aria-label={`Delete ${order.po_number}`}
                                >
                                  <i className="bi bi-trash"></i>
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-4">
                  <i className="bi bi-cart text-muted" style={{ fontSize: '2rem' }}></i>
                  <p className="text-muted mt-2">
                    {searchTerm ? 'No orders found matching your search' : 'No purchase orders found'}
                  </p>
                </div>
              )}
            </Card.Body>
          </Card>
        </>
      )}

      {/* Order Modal */}
      <Modal show={showModal} onHide={handleCloseModal} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>
            {editingOrder 
              ? `Edit ${user?.role === 'employee' ? 'Purchase Request' : 'Purchase Order'}`
              : `Create New ${user?.role === 'employee' ? 'Purchase Request' : 'Purchase Order'}`
            }
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            {user?.role === 'employee' ? (
              <>
                {/* PURCHASE REQUEST Section */}
                <Card className="mb-4">
                  <Card.Header className="bg-primary text-white">
                    <h5 className="mb-0 fw-bold">PURCHASE REQUEST</h5>
                  </Card.Header>
                  <Card.Body>
                    <Row className="g-3">
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="fw-bold">ENTITY NAME</Form.Label>
                          <Form.Control
                            type="text"
                            value={employeeFormData.entity_name}
                            onChange={(e) => setEmployeeFormData({ ...employeeFormData, entity_name: e.target.value })}
                            readOnly
                            className="bg-light"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="fw-bold">FUND CLUSTER</Form.Label>
                          <Form.Control
                            type="text"
                            value={employeeFormData.fund_cluster}
                            onChange={(e) => setEmployeeFormData({ ...employeeFormData, fund_cluster: e.target.value })}
                            placeholder="Enter fund cluster"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="fw-bold">OFFICE / SECTION</Form.Label>
                          <Form.Control
                            type="text"
                            value={employeeFormData.office_section}
                            onChange={(e) => setEmployeeFormData({ ...employeeFormData, office_section: e.target.value })}
                            readOnly
                            className="bg-light"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="fw-bold">RESPONSIBILITY CENTER CODE</Form.Label>
                          <Form.Control
                            type="text"
                            value={employeeFormData.responsibility_center_code}
                            onChange={(e) => setEmployeeFormData({ ...employeeFormData, responsibility_center_code: e.target.value })}
                            placeholder="Enter responsibility center code"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="fw-bold">DATE</Form.Label>
                          <InputGroup>
                            <Form.Control
                              type="text"
                              value={employeeFormData.date}
                              onChange={(e) => setEmployeeFormData({ ...employeeFormData, date: e.target.value })}
                              placeholder="MM/DD/YYYY"
                            />
                            <InputGroup.Text>
                              <i className="bi bi-calendar"></i>
                            </InputGroup.Text>
                          </InputGroup>
                        </Form.Group>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>

                {/* LIST OF ITEMS Section */}
                <Card>
                  <Card.Header className="bg-primary text-white">
                    <h5 className="mb-0 fw-bold">LIST OF ITEMS</h5>
                  </Card.Header>
                  <Card.Body className="p-0">
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                      <Table striped bordered className="mb-0">
                        <thead className="bg-light sticky-top">
                          <tr>
                            <th className="fw-bold">UNIT</th>
                            <th className="fw-bold">ITEM DESCRIPTION</th>
                            <th className="fw-bold">QUANTITY</th>
                            <th className="fw-bold">UNIT COST</th>
                            <th className="fw-bold">TOTAL COST</th>
                          </tr>
                        </thead>
                        <tbody>
                          {employeeFormData.items.map((item, index) => (
                            <tr key={index}>
                              <td>
                                <Form.Control
                                  type="text"
                                  value={item.unit}
                                  onChange={(e) => {
                                    const newItems = [...employeeFormData.items];
                                    newItems[index].unit = e.target.value;
                                    setEmployeeFormData({ ...employeeFormData, items: newItems });
                                  }}
                                  placeholder="Unit"
                                />
                              </td>
                              <td>
                                <Form.Control
                                  type="text"
                                  value={item.item_description}
                                  onChange={(e) => {
                                    const newItems = [...employeeFormData.items];
                                    newItems[index].item_description = e.target.value;
                                    setEmployeeFormData({ ...employeeFormData, items: newItems });
                                  }}
                                  placeholder="Item description"
                                />
                              </td>
                              <td>
                                <Form.Control
                                  type="number"
                                  min="0"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const newItems = [...employeeFormData.items];
                                    const qty = Number(e.target.value) || 0;
                                    newItems[index].quantity = qty;
                                    newItems[index].total_cost = qty * newItems[index].unit_cost;
                                    setEmployeeFormData({ ...employeeFormData, items: newItems });
                                  }}
                                />
                              </td>
                              <td>
                                <Form.Control
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.unit_cost}
                                  onChange={(e) => {
                                    const newItems = [...employeeFormData.items];
                                    const cost = Number(e.target.value) || 0;
                                    newItems[index].unit_cost = cost;
                                    newItems[index].total_cost = newItems[index].quantity * cost;
                                    setEmployeeFormData({ ...employeeFormData, items: newItems });
                                  }}
                                />
                              </td>
                              <td>
                                <Form.Control
                                  type="text"
                                  value={item.total_cost.toFixed(2)}
                                  readOnly
                                  className="bg-light"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  </Card.Body>
                </Card>
              </>
            ) : (
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label htmlFor="supplier">Supplier *</Form.Label>
                    <Form.Select
                      id="supplier"
                      value={formData.supplier_id}
                      onChange={(e) => setFormData({ ...formData, supplier_id: Number(e.target.value) })}
                      isInvalid={!!errors.supplier_id}
                      aria-describedby="supplierError"
                    >
                      <option value={0}>Select Supplier</option>
                      {suppliers.map(supplier => (
                        <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                      ))}
                    </Form.Select>
                    <Form.Control.Feedback type="invalid" id="supplierError">
                      {errors.supplier_id}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>

                <Col md={12}>
                  <Form.Group>
                    <Form.Label htmlFor="delivery_address">Delivery Address *</Form.Label>
                    <Form.Control
                      id="delivery_address"
                      as="textarea"
                      rows={2}
                      value={formData.delivery_address}
                      onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                      isInvalid={!!errors.delivery_address}
                      aria-describedby="deliveryAddressError"
                    />
                    <Form.Control.Feedback type="invalid" id="deliveryAddressError">
                      {errors.delivery_address}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>

                <Col md={12}>
                  <Form.Group>
                    <Form.Label htmlFor="notes">Notes</Form.Label>
                    <Form.Control
                      id="notes"
                      as="textarea"
                      rows={2}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </Form.Group>
                </Col>

              <Col md={12}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6>Order Items</h6>
                  <Button type="button" variant="outline-primary" size="sm" onClick={addItem}>
                    <i className="bi bi-plus me-1"></i>
                    Add Item
                  </Button>
                </div>

                {formData.items.map((item, index) => (
                  <Card key={index} className="mb-3">
                    <Card.Body>
                      <Row className="g-2">
                        <Col md={4}>
                          <Form.Group>
                            <Form.Label>Product</Form.Label>
                            <Form.Select
                              value={item.product_id}
                              onChange={(e) => updateItem(index, 'product_id', Number(e.target.value))}
                            >
                              <option value={0}>Select Product</option>
                              {products.map(product => (
                                <option key={product.id} value={product.id}>{product.name}</option>
                              ))}
                            </Form.Select>
                          </Form.Group>
                        </Col>
                        <Col md={2}>
                          <Form.Group>
                            <Form.Label>Quantity</Form.Label>
                            <Form.Control
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={3}>
                          <Form.Group>
                            <Form.Label>Unit Price</Form.Label>
                            <Form.Control
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unit_price}
                              onChange={(e) => updateItem(index, 'unit_price', Number(e.target.value))}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={2}>
                          <Form.Group>
                            <Form.Label>Total</Form.Label>
                            <Form.Control
                              type="text"
                              value={formatCurrency(item.quantity * item.unit_price)}
                              readOnly
                              className="bg-light"
                            />
                          </Form.Group>
                        </Col>
                        <Col md={1}>
                          <Form.Group>
                            <Form.Label>&nbsp;</Form.Label>
                            <Button
                              type="button"
                              variant="outline-danger"
                              size="sm"
                              onClick={() => removeItem(index)}
                              className="w-100"
                              aria-label="Remove item"
                            >
                              <i className="bi bi-trash"></i>
                            </Button>
                          </Form.Group>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                ))}

                {formData.items.length > 0 && (
                  <Alert variant="info">
                    <strong>Total: {formatCurrency(
                      formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
                    )}</strong>
                  </Alert>
                )}
              </Col>
            </Row>
            )}
          </Modal.Body>
          <Modal.Footer>
            {user?.role === 'employee' ? (
              <>
                <Button variant="danger" onClick={handleCloseModal}>
                  CANCEL
                </Button>
                <Button variant="success" type="submit">
                  SUBMIT
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  {editingOrder ? 'Update Order' : 'Create Order'}
                </Button>
              </>
            )}
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Items View Modal for Employees */}
      <Modal show={showItemsModal} onHide={() => setShowItemsModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>LIST OF ITEMS</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="table-responsive">
            <Table striped bordered className="mb-0">
              <thead className="bg-light">
                <tr>
                  <th className="fw-bold">UNIT</th>
                  <th className="fw-bold">ITEM DESCRIPTION</th>
                  <th className="fw-bold">QUANTITY</th>
                  <th className="fw-bold">UNIT COST</th>
                  <th className="fw-bold">TOTAL COST</th>
                </tr>
              </thead>
              <tbody>
                {selectedRequestItems.length > 0 ? (
                  selectedRequestItems.map((item: any, index: number) => (
                    <tr key={index}>
                      <td>{item.product?.unit || item.unit || 'N/A'}</td>
                      <td>{item.product?.name || item.item_description || 'N/A'}</td>
                      <td>{item.quantity || 0}</td>
                      <td>{item.unit_price?.toFixed(2) || item.unit_cost?.toFixed(2) || '0.00'}</td>
                      <td>{item.total_price?.toFixed(2) || item.total_cost?.toFixed(2) || '0.00'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-muted">
                      No items found
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowItemsModal(false)}>
            Close
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

export default Orders;
