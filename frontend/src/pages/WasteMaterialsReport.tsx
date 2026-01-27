import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Form, Modal, Badge, InputGroup } from 'react-bootstrap';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';

interface WasteItem {
  item_description: string;
  quantity: number;
  unit: string;
  or_number: string;
  or_amount: number;
  disposal_method: 'Destroyed' | 'Sold at private sale' | 'Sold at public auction' | 'Transferred' | 'Other';
  remarks?: string;
}

interface WasteMaterialsReport {
  id?: string;
  report_number: string;
  agency: string;
  place_of_storage: string;
  report_date: string;
  items: WasteItem[];
  total_amount: number;
  certified_by: string;
  certified_by_designation: string;
  approved_by: string;
  approved_by_designation: string;
  property_inspector: string;
  witness_to_disposition: string;
  status: 'Draft' | 'Submitted';
}

const WasteMaterialsReport: React.FC = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<WasteMaterialsReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<WasteMaterialsReport | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [showToast, setShowToast] = useState(false);

  const [currentReport, setCurrentReport] = useState<WasteMaterialsReport>({
    report_number: '',
    agency: '',
    place_of_storage: '',
    report_date: new Date().toISOString().split('T')[0],
    items: [],
    total_amount: 0,
    certified_by: user?.full_name || '',
    certified_by_designation: '',
    approved_by: '',
    approved_by_designation: '',
    property_inspector: '',
    witness_to_disposition: '',
    status: 'Draft'
  });

  const [newItem, setNewItem] = useState<WasteItem>({
    item_description: '',
    quantity: 0,
    unit: '',
    or_number: '',
    or_amount: 0,
    disposal_method: 'Destroyed',
    remarks: ''
  });

  useEffect(() => {
    fetchWasteMaterialsReports();
  }, []);

  const fetchWasteMaterialsReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getWasteMaterialsReports();
      setReports(data || []);
    } catch (err) {
      setError('Failed to load waste materials reports');
      console.error(err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    if (!newItem.item_description || !newItem.or_number) {
      setToastMessage('Please fill in item description and O.R. number');
      setToastType('warning');
      setShowToast(true);
      return;
    }

    setCurrentReport({
      ...currentReport,
      items: [...currentReport.items, newItem],
      total_amount: currentReport.total_amount + newItem.or_amount
    });

    setNewItem({
      item_description: '',
      quantity: 0,
      unit: '',
      or_number: '',
      or_amount: 0,
      disposal_method: 'Destroyed',
      remarks: ''
    });
  };

  const handleRemoveItem = (index: number) => {
    const removedItem = currentReport.items[index];
    setCurrentReport({
      ...currentReport,
      items: currentReport.items.filter((_, i) => i !== index),
      total_amount: currentReport.total_amount - removedItem.or_amount
    });
  };

  const handleSave = async () => {
    try {
      if (!currentReport.report_number || !currentReport.agency) {
        setToastMessage('Please fill in all required fields');
        setToastType('warning');
        setShowToast(true);
        return;
      }

      if (currentReport.items.length === 0) {
        setToastMessage('Please add at least one item');
        setToastType('warning');
        setShowToast(true);
        return;
      }

      if (!currentReport.certified_by || !currentReport.approved_by) {
        setToastMessage('Please fill in Certified By and Approved By fields');
        setToastType('warning');
        setShowToast(true);
        return;
      }

      const { id, ...reportDataToSend } = currentReport;
      await apiService.createWasteMaterialsReport(reportDataToSend);

      setToastMessage('Waste Materials Report saved successfully');
      setToastType('success');
      setShowToast(true);
      setShowModal(false);
      
      setCurrentReport({
        report_number: '',
        agency: '',
        place_of_storage: '',
        report_date: new Date().toISOString().split('T')[0],
        items: [],
        total_amount: 0,
        certified_by: user?.full_name || '',
        certified_by_designation: '',
        approved_by: '',
        approved_by_designation: '',
        property_inspector: '',
        witness_to_disposition: '',
        status: 'Draft'
      });

      setNewItem({
        item_description: '',
        quantity: 0,
        unit: '',
        or_number: '',
        or_amount: 0,
        disposal_method: 'Destroyed',
        remarks: ''
      });

      fetchWasteMaterialsReports();
    } catch (err) {
      setToastMessage('Failed to save waste materials report');
      setToastType('error');
      setShowToast(true);
    }
  };

  const filteredReports = reports.filter(report =>
    report.report_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.agency.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <LoadingSpinner size="lg" text="Loading Waste Materials Reports..." />;

  return (
    <Container fluid className="py-5">
      {error && (
        <Row className="mb-4">
          <Col>
            <div className="alert alert-danger alert-dismissible fade show" role="alert">
              <i className="bi bi-exclamation-circle me-2"></i>
              {error}
            </div>
          </Col>
        </Row>
      )}

      {/* Header Section */}
      <Row className="mb-5">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h1 className="fw-bold text-dark mb-2">
                <i className="bi bi-exclamation-triangle text-warning me-3"></i>
                Waste Materials Report
              </h1>
              <p className="text-muted fs-6">Manage and track disposal of waste materials and damaged items</p>
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                setCurrentReport({
                  report_number: '',
                  agency: '',
                  place_of_storage: '',
                  report_date: new Date().toISOString().split('T')[0],
                  items: [],
                  total_amount: 0,
                  certified_by: user?.full_name || '',
                  certified_by_designation: '',
                  approved_by: '',
                  approved_by_designation: '',
                  property_inspector: '',
                  witness_to_disposition: '',
                  status: 'Draft'
                });
                setNewItem({
                  item_description: '',
                  quantity: 0,
                  unit: '',
                  or_number: '',
                  or_amount: 0,
                  disposal_method: 'Destroyed',
                  remarks: ''
                });
                setShowModal(true);
              }}
              className="px-4 py-2"
            >
              <i className="bi bi-plus-circle me-2"></i>
              New Report
            </Button>
          </div>
        </Col>
      </Row>

      {/* Search Section */}
      <Row className="mb-4">
        <Col md={6}>
          <InputGroup>
            <InputGroup.Text className="bg-light border-light">
              <i className="bi bi-search"></i>
            </InputGroup.Text>
            <Form.Control
              placeholder="Search by report number or agency..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-light"
            />
          </InputGroup>
        </Col>
      </Row>

      {/* Reports Table Section */}
      <Row>
        <Col>
          <Card className="border-0 shadow-sm rounded-lg overflow-hidden">
            <Card.Body className="p-0">
              <div style={{ overflowX: 'auto' }}>
                <Table hover className="mb-0 table-striped">
                  <thead className="bg-light border-bottom">
                    <tr>
                      <th className="fw-bold text-dark">Report No.</th>
                      <th className="fw-bold text-dark">Agency</th>
                      <th className="fw-bold text-dark">Report Date</th>
                      <th className="fw-bold text-dark text-end">Total Amount</th>
                      <th className="fw-bold text-dark text-center">Status</th>
                      <th className="fw-bold text-dark text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReports.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-5 text-muted">
                          <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                          <span>No waste materials reports found</span>
                        </td>
                      </tr>
                    ) : (
                      filteredReports.map((report) => (
                        <tr key={report.id} className="align-middle">
                          <td className="fw-bold text-primary">{report.report_number}</td>
                          <td>{report.agency}</td>
                          <td>
                            <small>{new Date(report.report_date).toLocaleDateString()}</small>
                          </td>
                          <td className="text-end">
                            <span className="fw-bold text-success">₱{report.total_amount.toFixed(2)}</span>
                          </td>
                          <td className="text-center">
                            <Badge bg={report.status === 'Submitted' ? 'success' : 'warning'} className="px-3 py-2">
                              {report.status}
                            </Badge>
                          </td>
                          <td className="text-center">
                            <Button
                              variant="outline-info"
                              size="sm"
                              onClick={() => {
                                setSelectedReport(report);
                                setShowViewModal(true);
                              }}
                              className="rounded-circle"
                              style={{ width: '36px', height: '36px', padding: 0 }}
                            >
                              <i className="bi bi-eye"></i>
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Create Report Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="xl" centered>
        <Modal.Header closeButton className="bg-light border-bottom">
          <Modal.Title className="fw-bold">
            <i className="bi bi-file-earmark-plus text-primary me-2"></i>
            New Waste Materials Report
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <Form>
            {/* Header Section */}
            <div className="text-center mb-4 pb-3 border-bottom">
              <h5 className="fw-bold text-dark mb-1">WASTE MATERIALS REPORT</h5>
              <p className="text-muted small mb-0">CAVITE STATE UNIVERSITY</p>
            </div>

            {/* Basic Information */}
            <Card className="mb-4 border-0 bg-light">
              <Card.Body>
                <h6 className="fw-bold mb-3 text-dark">
                  <i className="bi bi-info-circle me-2 text-primary"></i>
                  Basic Information
                </h6>
                <Row className="g-3">
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="fw-bold small">Report Number *</Form.Label>
                      <Form.Control
                        value={currentReport.report_number}
                        onChange={(e) => setCurrentReport({ ...currentReport, report_number: e.target.value })}
                        placeholder="e.g., WMR-2026-001"
                        size="sm"
                        className="border-light"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="fw-bold small">Agency/Office *</Form.Label>
                      <Form.Control
                        value={currentReport.agency}
                        onChange={(e) => setCurrentReport({ ...currentReport, agency: e.target.value })}
                        placeholder="e.g., Academic Affairs"
                        size="sm"
                        className="border-light"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="fw-bold small">Date *</Form.Label>
                      <Form.Control
                        type="date"
                        value={currentReport.report_date}
                        onChange={(e) => setCurrentReport({ ...currentReport, report_date: e.target.value })}
                        size="sm"
                        className="border-light"
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row className="g-3 mt-1">
                  <Col md={12}>
                    <Form.Group>
                      <Form.Label className="fw-bold small">Place of Storage</Form.Label>
                      <Form.Control
                        value={currentReport.place_of_storage}
                        onChange={(e) => setCurrentReport({ ...currentReport, place_of_storage: e.target.value })}
                        placeholder="e.g., Building A, Room 101"
                        size="sm"
                        className="border-light"
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Items Section */}
            <Card className="mb-4 border-0">
              <Card.Header className="bg-primary text-white border-0 d-flex justify-content-between align-items-center">
                <h6 className="mb-0 fw-bold">
                  <i className="bi bi-box me-2"></i>
                  Items for Disposal
                </h6>
                <span className="badge bg-light text-primary fw-bold">
                  Total: ₱{currentReport.total_amount.toFixed(2)}
                </span>
              </Card.Header>
              <Card.Body className="bg-light">
                {/* Add Item Form */}
                <div className="mb-4 p-3 bg-white rounded border border-light">
                  <h6 className="fw-bold mb-3">Add Item</h6>
                  <Row className="g-2 mb-3">
                    <Col md={2}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small fw-bold">Qty. *</Form.Label>
                        <Form.Control
                          type="number"
                          value={newItem.quantity}
                          onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })}
                          size="sm"
                          min="0"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small fw-bold">Unit</Form.Label>
                        <Form.Control
                          value={newItem.unit}
                          onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                          placeholder="pc, set, box"
                          size="sm"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small fw-bold">Description *</Form.Label>
                        <Form.Control
                          value={newItem.item_description}
                          onChange={(e) => setNewItem({ ...newItem, item_description: e.target.value })}
                          placeholder="Item description"
                          size="sm"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small fw-bold">O.R. No. *</Form.Label>
                        <Form.Control
                          value={newItem.or_number}
                          onChange={(e) => setNewItem({ ...newItem, or_number: e.target.value })}
                          placeholder="O.R. #"
                          size="sm"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small fw-bold">Amount</Form.Label>
                        <Form.Control
                          type="number"
                          step="0.01"
                          value={newItem.or_amount}
                          onChange={(e) => setNewItem({ ...newItem, or_amount: parseFloat(e.target.value) || 0 })}
                          size="sm"
                          min="0"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={1} className="d-flex align-items-end">
                      <Button variant="success" size="sm" onClick={handleAddItem} className="w-100">
                        <i className="bi bi-plus-lg"></i>
                      </Button>
                    </Col>
                  </Row>

                  <Row className="g-3">
                    <Col md={12}>
                      <Form.Group>
                        <Form.Label className="small fw-bold mb-2">Disposal Method</Form.Label>
                        <div className="d-flex flex-wrap gap-3">
                          {['Destroyed', 'Sold at private sale', 'Sold at public auction', 'Transferred', 'Other'].map((method) => (
                            <Form.Check
                              key={method}
                              type="radio"
                              label={<span className="small">{method}</span>}
                              value={method}
                              checked={newItem.disposal_method === method}
                              onChange={(e) => setNewItem({ ...newItem, disposal_method: e.target.value as any })}
                              id={`method-${method}`}
                            />
                          ))}
                        </div>
                      </Form.Group>
                    </Col>
                  </Row>
                </div>

                {/* Items Table */}
                {currentReport.items.length > 0 && (
                  <Table size="sm" className="mb-0 bg-white rounded overflow-hidden">
                    <thead className="bg-primary text-white">
                      <tr>
                        <th className="text-center small fw-bold">Qty.</th>
                        <th className="small fw-bold">Unit</th>
                        <th className="small fw-bold">Description</th>
                        <th className="small fw-bold">O.R. No.</th>
                        <th className="text-end small fw-bold">Amount</th>
                        <th className="small fw-bold">Method</th>
                        <th className="text-center small fw-bold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentReport.items.map((item, index) => (
                        <tr key={index} className="border-bottom">
                          <td className="text-center small">{item.quantity}</td>
                          <td className="small">{item.unit}</td>
                          <td className="small">{item.item_description}</td>
                          <td className="small">{item.or_number}</td>
                          <td className="text-end small fw-bold">₱{item.or_amount.toFixed(2)}</td>
                          <td><small className="badge bg-info">{item.disposal_method}</small></td>
                          <td className="text-center">
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleRemoveItem(index)}
                              className="rounded-circle"
                              style={{ width: '28px', height: '28px', padding: 0 }}
                            >
                              <i className="bi bi-trash"></i>
                            </Button>
                          </td>
                        </tr>
                      ))}
                      <tr className="fw-bold bg-light border-top border-2">
                        <td colSpan={4} className="text-end py-2">TOTAL:</td>
                        <td className="text-end py-2 text-success">₱{currentReport.total_amount.toFixed(2)}</td>
                        <td></td>
                        <td></td>
                      </tr>
                    </tbody>
                  </Table>
                )}
              </Card.Body>
            </Card>

            {/* Certification Section */}
            <Card className="mb-4 border-0 bg-light">
              <Card.Body>
                <h6 className="fw-bold mb-3 text-dark">
                  <i className="bi bi-check-circle me-2 text-success"></i>
                  Certification
                </h6>
                <Row className="g-3">
                  <Col md={6}>
                    <p className="small text-muted fw-bold mb-2">✓ Certified Correct</p>
                    <Form.Group className="mb-2">
                      <Form.Label className="small fw-bold">OIC - Supply and Property Office *</Form.Label>
                      <Form.Control
                        value={currentReport.certified_by}
                        onChange={(e) => setCurrentReport({ ...currentReport, certified_by: e.target.value })}
                        placeholder="Name"
                        size="sm"
                        className="border-light"
                      />
                    </Form.Group>
                    <Form.Group>
                      <Form.Label className="small fw-bold">Designation</Form.Label>
                      <Form.Control
                        value={currentReport.certified_by_designation}
                        onChange={(e) => setCurrentReport({ ...currentReport, certified_by_designation: e.target.value })}
                        placeholder="Title/Position"
                        size="sm"
                        className="border-light"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <p className="small text-muted fw-bold mb-2">✓ Disposal Approved</p>
                    <Form.Group className="mb-2">
                      <Form.Label className="small fw-bold">President *</Form.Label>
                      <Form.Control
                        value={currentReport.approved_by}
                        onChange={(e) => setCurrentReport({ ...currentReport, approved_by: e.target.value })}
                        placeholder="Name"
                        size="sm"
                        className="border-light"
                      />
                    </Form.Group>
                    <Form.Group>
                      <Form.Label className="small fw-bold">Designation</Form.Label>
                      <Form.Control
                        value={currentReport.approved_by_designation}
                        onChange={(e) => setCurrentReport({ ...currentReport, approved_by_designation: e.target.value })}
                        placeholder="Title/Position"
                        size="sm"
                        className="border-light"
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Inspection Section */}
            <Card className="border-0 bg-light">
              <Card.Body>
                <h6 className="fw-bold mb-3 text-dark">
                  <i className="bi bi-search me-2 text-warning"></i>
                  Certificate of Inspection
                </h6>
                <p className="small text-muted mb-3">I hereby certify that the property enumerated above was disposed of as follows:</p>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="small fw-bold">Property Inspector (Name & Signature)</Form.Label>
                      <Form.Control
                        value={currentReport.property_inspector}
                        onChange={(e) => setCurrentReport({ ...currentReport, property_inspector: e.target.value })}
                        placeholder="Inspector name"
                        size="sm"
                        className="border-light"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="small fw-bold">Witness to Disposition</Form.Label>
                      <Form.Control
                        value={currentReport.witness_to_disposition}
                        onChange={(e) => setCurrentReport({ ...currentReport, witness_to_disposition: e.target.value })}
                        placeholder="Witness name"
                        size="sm"
                        className="border-light"
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Form>
        </Modal.Body>
        <Modal.Footer className="bg-light border-top">
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} className="px-4">
            <i className="bi bi-check-circle me-2"></i>
            Save Report
          </Button>
        </Modal.Footer>
      </Modal>

      {/* View Report Modal */}
      {selectedReport && (
        <Modal show={showViewModal} onHide={() => setShowViewModal(false)} size="lg" centered>
          <Modal.Header closeButton className="bg-light border-bottom">
            <Modal.Title className="fw-bold">
              <i className="bi bi-file-earmark-check text-primary me-2"></i>
              Report: {selectedReport.report_number}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4">
            {/* Report Info */}
            <Card className="mb-4 border-0 bg-light">
              <Card.Body>
                <Row className="g-4">
                  <Col md={6}>
                    <p className="small text-muted mb-1">Report Number</p>
                    <p className="fw-bold text-primary">{selectedReport.report_number}</p>
                  </Col>
                  <Col md={6}>
                    <p className="small text-muted mb-1">Agency</p>
                    <p className="fw-bold">{selectedReport.agency}</p>
                  </Col>
                  <Col md={6}>
                    <p className="small text-muted mb-1">Report Date</p>
                    <p className="fw-bold">{new Date(selectedReport.report_date).toLocaleDateString()}</p>
                  </Col>
                  <Col md={6}>
                    <p className="small text-muted mb-1">Place of Storage</p>
                    <p className="fw-bold">{selectedReport.place_of_storage}</p>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Items */}
            <h6 className="fw-bold mb-3">Waste Items ({selectedReport.items.length})</h6>
            <div style={{ overflowX: 'auto' }} className="mb-4">
              <Table size="sm" className="mb-0">
                <thead className="bg-primary text-white">
                  <tr>
                    <th className="small">Qty.</th>
                    <th className="small">Unit</th>
                    <th className="small">Description</th>
                    <th className="small">O.R. No.</th>
                    <th className="text-end small">Amount</th>
                    <th className="small">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReport.items.map((item, index) => (
                    <tr key={index} className="border-bottom">
                      <td className="small">{item.quantity}</td>
                      <td className="small">{item.unit}</td>
                      <td className="small">{item.item_description}</td>
                      <td className="small">{item.or_number}</td>
                      <td className="text-end small">₱{item.or_amount.toFixed(2)}</td>
                      <td><small className="badge bg-info">{item.disposal_method}</small></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            <Card className="mb-4 border-0 bg-light">
              <Card.Body>
                <Row>
                  <Col md={6}>
                    <p className="small text-muted mb-1">Total Amount</p>
                    <p className="fw-bold text-success fs-5">₱{selectedReport.total_amount.toFixed(2)}</p>
                  </Col>
                  <Col md={6}>
                    <p className="small text-muted mb-1">Status</p>
                    <Badge bg={selectedReport.status === 'Submitted' ? 'success' : 'warning'} className="px-3 py-2">
                      {selectedReport.status}
                    </Badge>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Certification Info */}
            <h6 className="fw-bold mb-3">Certification</h6>
            <Row className="g-4 mb-4">
              <Col md={6}>
                <div className="p-3 bg-light rounded">
                  <p className="small text-muted mb-1">Certified By</p>
                  <p className="fw-bold mb-2">{selectedReport.certified_by}</p>
                  <p className="small text-muted mb-1">Designation</p>
                  <p className="small">{selectedReport.certified_by_designation}</p>
                </div>
              </Col>
              <Col md={6}>
                <div className="p-3 bg-light rounded">
                  <p className="small text-muted mb-1">Approved By</p>
                  <p className="fw-bold mb-2">{selectedReport.approved_by}</p>
                  <p className="small text-muted mb-1">Designation</p>
                  <p className="small">{selectedReport.approved_by_designation}</p>
                </div>
              </Col>
            </Row>

            {/* Inspection Info */}
            <h6 className="fw-bold mb-3">Inspection</h6>
            <Row className="g-4">
              <Col md={6}>
                <div className="p-3 bg-light rounded">
                  <p className="small text-muted mb-1">Property Inspector</p>
                  <p className="small">{selectedReport.property_inspector}</p>
                </div>
              </Col>
              <Col md={6}>
                <div className="p-3 bg-light rounded">
                  <p className="small text-muted mb-1">Witness to Disposition</p>
                  <p className="small">{selectedReport.witness_to_disposition}</p>
                </div>
              </Col>
            </Row>
          </Modal.Body>
        </Modal>
      )}

      <Toast
        show={showToast}
        onClose={() => setShowToast(false)}
        message={toastMessage}
        type={toastType}
        delay={3000}
      />
    </Container>
  );
};

export default WasteMaterialsReport;
