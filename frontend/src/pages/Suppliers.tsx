import React, { useState, useEffect } from 'react';
import { 
  Container, Row, Col, Card, Table, Button, Badge, 
  Form, Modal, InputGroup 
} from 'react-bootstrap';
import { apiService, Supplier, CreateSupplierData } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';

const Suppliers: React.FC = () => {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [formData, setFormData] = useState<CreateSupplierData>({
    name: '',
    address: '',
    province: '',
    contact_person: '',
    phone: '',
    email: '',
    bir_tin: '',
    is_active: true
  });

  // Form validation
  const [errors, setErrors] = useState<Partial<CreateSupplierData>>({});

  const PHILIPPINE_PROVINCES = [
    'Metro Manila', 'Abra', 'Agusan del Norte', 'Agusan del Sur', 'Aklan',
    'Albay', 'Antique', 'Apayao', 'Aurora', 'Basilan', 'Bataan', 'Batanes',
    'Batangas', 'Benguet', 'Biliran', 'Bohol', 'Bukidnon', 'Bulacan', 'Cagayan',
    'Camarines Norte', 'Camarines Sur', 'Camiguin', 'Capiz', 'Catanduanes',
    'Cavite', 'Cebu', 'Cotabato', 'Davao de Oro', 'Davao del Norte', 'Davao del Sur',
    'Davao Occidental', 'Davao Oriental', 'Dinagat Islands', 'Eastern Samar',
    'Guimaras', 'Ifugao', 'Ilocos Norte', 'Ilocos Sur', 'Iloilo', 'Isabela',
    'Kalinga', 'La Union', 'Laguna', 'Lanao del Norte', 'Lanao del Sur',
    'Leyte', 'Maguindanao', 'Marinduque', 'Masbate', 'Misamis Occidental',
    'Misamis Oriental', 'Mountain Province', 'Negros Occidental', 'Negros Oriental',
    'Northern Samar', 'Nueva Ecija', 'Nueva Vizcaya', 'Occidental Mindoro',
    'Oriental Mindoro', 'Palawan', 'Pampanga', 'Pangasinan', 'Quezon', 'Quirino',
    'Rizal', 'Romblon', 'Samar', 'Sarangani', 'Siquijor', 'Sorsogon', 'South Cotabato',
    'Southern Leyte', 'Sultan Kudarat', 'Sulu', 'Surigao del Norte', 'Surigao del Sur',
    'Tarlac', 'Tawi-Tawi', 'Zambales', 'Zamboanga del Norte', 'Zamboanga del Sur',
    'Zamboanga Sibugay'
  ];

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const data = await apiService.getSuppliers();
      setSuppliers(data);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
      setToastMessage('Failed to load suppliers');
      setToastType('error');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<CreateSupplierData> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Supplier name is required';
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }

    if (!formData.province) {
      newErrors.province = 'Province is required';
    }

    if (!formData.contact_person.trim()) {
      newErrors.contact_person = 'Contact person is required';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^(\+63|0)?[0-9]{10}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Please enter a valid Philippine phone number';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.bir_tin.trim()) {
      newErrors.bir_tin = 'BIR TIN is required';
    } else if (!/^\d{3}-\d{3}-\d{3}-\d{3}$/.test(formData.bir_tin)) {
      newErrors.bir_tin = 'BIR TIN must be in format XXX-XXX-XXX-XXX';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      if (editingSupplier) {
        await apiService.updateSupplier(editingSupplier.id, formData);
        setToastMessage('Supplier updated successfully');
      } else {
        await apiService.createSupplier(formData);
        setToastMessage('Supplier created successfully');
      }
      
      setToastType('success');
      setShowToast(true);
      setShowModal(false);
      resetForm();
      fetchSuppliers();
    } catch (error: any) {
      console.error('Failed to save supplier:', error);
      setToastMessage(error.response?.data?.message || 'Failed to save supplier');
      setToastType('error');
      setShowToast(true);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      address: supplier.address,
      province: supplier.province,
      contact_person: supplier.contact_person,
      phone: supplier.phone,
      email: supplier.email || '',
      bir_tin: supplier.bir_tin,
      is_active: supplier.is_active
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this supplier?')) return;

    try {
      await apiService.deleteSupplier(id);
      setToastMessage('Supplier deleted successfully');
      setToastType('success');
      setShowToast(true);
      fetchSuppliers();
    } catch (error: any) {
      console.error('Failed to delete supplier:', error);
      setToastMessage(error.response?.data?.message || 'Failed to delete supplier');
      setToastType('error');
      setShowToast(true);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      province: '',
      contact_person: '',
      phone: '',
      email: '',
      bir_tin: '',
      is_active: true
    });
    setErrors({});
    setEditingSupplier(null);
  };

  const handleShowModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.contact_person.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.province.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Container>
        <LoadingSpinner size="lg" text="Loading suppliers..." />
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
              <h1 className="h2 mb-1">Suppliers</h1>
              <p className="text-muted mb-0">
                Manage supplier information and contact details
              </p>
            </div>
            <Button 
              variant="primary" 
              onClick={handleShowModal}
              aria-label="Add new supplier"
            >
              <i className="bi bi-plus-circle me-2"></i>
              Add Supplier
            </Button>
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
              placeholder="Search suppliers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search suppliers"
            />
          </InputGroup>
        </Col>
      </Row>

      {/* Suppliers Table */}
      <Card>
        <Card.Header>
          <h5 className="mb-0">Supplier List</h5>
        </Card.Header>
        <Card.Body className="p-0">
          {filteredSuppliers.length > 0 ? (
            <div className="table-responsive">
              <Table striped bordered className="mb-0">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Contact Person</th>
                    <th>Province</th>
                    <th>Phone</th>
                    <th>BIR TIN</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((supplier) => (
                    <tr key={supplier.id}>
                      <td>
                        <strong>{supplier.name}</strong>
                        {supplier.email && (
                          <div className="small text-muted">{supplier.email}</div>
                        )}
                      </td>
                      <td>{supplier.contact_person}</td>
                      <td>{supplier.province}</td>
                      <td>{supplier.phone}</td>
                      <td>
                        <code>{supplier.bir_tin}</code>
                      </td>
                      <td>
                        <Badge bg={supplier.is_active ? 'success' : 'secondary'}>
                          {supplier.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => handleEdit(supplier)}
                            aria-label={`Edit ${supplier.name}`}
                          >
                            <i className="bi bi-pencil"></i>
                          </Button>
                          {user?.is_admin && (
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDelete(supplier.id)}
                              aria-label={`Delete ${supplier.name}`}
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
              <i className="bi bi-building text-muted" style={{ fontSize: '2rem' }}></i>
              <p className="text-muted mt-2">
                {searchTerm ? 'No suppliers found matching your search' : 'No suppliers found'}
              </p>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Supplier Modal */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label htmlFor="name">Supplier Name *</Form.Label>
                  <Form.Control
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    isInvalid={!!errors.name}
                    aria-describedby="nameError"
                  />
                  <Form.Control.Feedback type="invalid" id="nameError">
                    {errors.name}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group>
                  <Form.Label htmlFor="contact_person">Contact Person *</Form.Label>
                  <Form.Control
                    id="contact_person"
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    isInvalid={!!errors.contact_person}
                    aria-describedby="contactPersonError"
                  />
                  <Form.Control.Feedback type="invalid" id="contactPersonError">
                    {errors.contact_person}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>

              <Col md={12}>
                <Form.Group>
                  <Form.Label htmlFor="address">Address *</Form.Label>
                  <Form.Control
                    id="address"
                    as="textarea"
                    rows={2}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    isInvalid={!!errors.address}
                    aria-describedby="addressError"
                  />
                  <Form.Control.Feedback type="invalid" id="addressError">
                    {errors.address}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label htmlFor="province">Province *</Form.Label>
                  <Form.Select
                    id="province"
                    value={formData.province}
                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                    isInvalid={!!errors.province}
                    aria-describedby="provinceError"
                  >
                    <option value="">Select Province</option>
                    {PHILIPPINE_PROVINCES.map(province => (
                      <option key={province} value={province}>{province}</option>
                    ))}
                  </Form.Select>
                  <Form.Control.Feedback type="invalid" id="provinceError">
                    {errors.province}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label htmlFor="phone">Phone Number *</Form.Label>
                  <Form.Control
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    isInvalid={!!errors.phone}
                    aria-describedby="phoneError"
                    placeholder="09171234567"
                  />
                  <Form.Control.Feedback type="invalid" id="phoneError">
                    {errors.phone}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label htmlFor="email">Email</Form.Label>
                  <Form.Control
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    isInvalid={!!errors.email}
                    aria-describedby="emailError"
                  />
                  <Form.Control.Feedback type="invalid" id="emailError">
                    {errors.email}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label htmlFor="bir_tin">BIR TIN *</Form.Label>
                  <Form.Control
                    id="bir_tin"
                    type="text"
                    value={formData.bir_tin}
                    onChange={(e) => setFormData({ ...formData, bir_tin: e.target.value })}
                    isInvalid={!!errors.bir_tin}
                    aria-describedby="birTinError"
                    placeholder="123-456-789-000"
                  />
                  <Form.Control.Feedback type="invalid" id="birTinError">
                    {errors.bir_tin}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>

              <Col md={12}>
                <Form.Group>
                  <Form.Check
                    type="checkbox"
                    id="is_active"
                    label="Active Supplier"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {editingSupplier ? 'Update Supplier' : 'Add Supplier'}
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

export default Suppliers;
