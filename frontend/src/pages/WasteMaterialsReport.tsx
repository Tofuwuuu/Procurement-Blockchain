import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Form, Modal } from 'react-bootstrap';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import './WasteMaterialsReport.css';

interface WasteItem {
  item_description: string;
  quantity: number;
  unit: string;
  or_number: string;
  or_amount: number;
  disposal_method: 'Destroyed' | 'Sold at private sale' | 'Sold at public auction' | 'Transferred' | 'Other';
  remarks?: string;
}

interface WasteMaterialsReportRecord {
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
  status: string;
}

const WasteMaterialsReport: React.FC = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<WasteMaterialsReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<WasteMaterialsReportRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [showToast, setShowToast] = useState(false);

  const [currentReport, setCurrentReport] = useState<WasteMaterialsReportRecord>({
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
    report.agency.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.place_of_storage.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (value?: string) => {
    if (!value) return 'Not set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  };

  const formatCurrency = (value?: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(value || 0);

  const getStatusClass = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === 'submitted' || normalized === 'approved') return 'is-submitted';
    if (normalized === 'draft') return 'is-draft';
    return 'is-neutral';
  };

  const draftCount = reports.filter(report => report.status.toLowerCase() === 'draft').length;
  const submittedCount = reports.filter(report =>
    ['submitted', 'approved'].includes(report.status.toLowerCase())
  ).length;
  const itemCount = reports.reduce((sum, report) => sum + report.items.length, 0);
  const totalValue = reports.reduce((sum, report) => sum + (Number(report.total_amount) || 0), 0);

  if (loading) {
    return (
      <Container fluid className="wmr-page py-4">
        <div className="wmr-loading">
          <LoadingSpinner size="lg" text="Loading Waste Materials Reports..." />
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="wmr-page py-4">
      {error && (
        <Row className="mb-3">
          <Col>
            <div className="alert alert-danger wmr-alert" role="alert">
              <i className="bi bi-exclamation-circle me-2" aria-hidden="true"></i>
              {error}
            </div>
          </Col>
        </Row>
      )}

      <section className="wmr-hero mb-4">
        <div className="wmr-hero-copy">
          <span className="wmr-eyebrow">Disposal accountability</span>
          <h1>Waste Materials Report</h1>
          <p>Document damaged or waste materials, disposal proceeds, approvals, and inspection details.</p>
        </div>
        <Button
          className="wmr-primary-action"
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
        >
          <i className="bi bi-plus-circle" aria-hidden="true"></i>
          New Report
        </Button>
      </section>

      <Row className="g-3 mb-4">
        <Col md={6} xl={3}>
          <Card className="wmr-stat-card">
            <Card.Body>
              <span>Total reports</span>
              <strong>{reports.length}</strong>
              <small>Waste material reports on file</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} xl={3}>
          <Card className="wmr-stat-card">
            <Card.Body>
              <span>Total value</span>
              <strong>{formatCurrency(totalValue)}</strong>
              <small>Recorded disposal proceeds</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} xl={3}>
          <Card className="wmr-stat-card">
            <Card.Body>
              <span>Draft reports</span>
              <strong>{draftCount}</strong>
              <small>Still being prepared</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} xl={3}>
          <Card className="wmr-stat-card">
            <Card.Body>
              <span>Disposed items</span>
              <strong>{itemCount}</strong>
              <small>{submittedCount} submitted or approved reports</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Reports Table Section */}
      <Row>
        <Col>
          <Card className="wmr-table-card shadow-sm">
            <Card.Header>
              <div>
                <h5>Waste materials reports</h5>
                <p>{filteredReports.length} of {reports.length} records shown</p>
              </div>
              <Form.Group className="wmr-search">
                <i className="bi bi-search" aria-hidden="true"></i>
                <Form.Control
                  placeholder="Search report no., agency, or storage"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </Form.Group>
            </Card.Header>
            <Card.Body>
              <div className="table-responsive">
                <Table hover className="wmr-table">
                  <thead>
                    <tr>
                      <th>Report No.</th>
                      <th>Agency</th>
                      <th>Report Date</th>
                      <th>Items</th>
                      <th className="text-end">Total Amount</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReports.length === 0 ? (
                      <tr>
                        <td colSpan={7}>
                          <div className="wmr-empty-state">
                            <i className="bi bi-inbox" aria-hidden="true"></i>
                            <h5>No waste materials reports found</h5>
                            <p>
                              {searchTerm
                                ? 'Try another search term or clear the search field.'
                                : 'Create a report when waste or damaged materials are ready for disposal documentation.'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredReports.map((report) => (
                        <tr key={report.id || report.report_number}>
                          <td>
                            <strong className="wmr-number">{report.report_number}</strong>
                          </td>
                          <td>
                            <div className="wmr-agency">{report.agency}</div>
                            {report.place_of_storage && <small>{report.place_of_storage}</small>}
                          </td>
                          <td>{formatDate(report.report_date)}</td>
                          <td>{report.items.length}</td>
                          <td className="text-end">
                            <strong className="wmr-amount">{formatCurrency(report.total_amount)}</strong>
                          </td>
                          <td>
                            <span className={`badge wmr-status ${getStatusClass(report.status)}`}>
                              {report.status}
                            </span>
                          </td>
                          <td>
                            <Button
                              size="sm"
                              className="wmr-view-btn"
                              onClick={() => {
                                setSelectedReport(report);
                                setShowViewModal(true);
                              }}
                              aria-label={`View ${report.report_number}`}
                            >
                              <i className="bi bi-eye" aria-hidden="true"></i>
                              View
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
      <Modal show={showModal} onHide={() => setShowModal(false)} size="xl" centered className="wmr-modal">
        <Modal.Header closeButton>
          <Modal.Title>
            <span>Create document</span>
            <strong>Waste Materials Report</strong>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            {/* Header Section */}
            <div className="wmr-document-banner">
              <span>Official document</span>
              <h5>Waste Materials Report</h5>
              <p>CAVITE STATE UNIVERSITY</p>
            </div>

            {/* Basic Information */}
            <Card className="wmr-form-card mb-4">
              <Card.Body>
                <div className="wmr-form-section">
                  <h6>Basic information</h6>
                  <p>Capture the agency, storage location, and report date.</p>
                </div>
                <Row className="g-3">
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="wmr-form-label">Report Number *</Form.Label>
                      <Form.Control
                        value={currentReport.report_number}
                        onChange={(e) => setCurrentReport({ ...currentReport, report_number: e.target.value })}
                        placeholder="e.g., WMR-2026-001"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="wmr-form-label">Agency/Office *</Form.Label>
                      <Form.Control
                        value={currentReport.agency}
                        onChange={(e) => setCurrentReport({ ...currentReport, agency: e.target.value })}
                        placeholder="e.g., Academic Affairs"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="wmr-form-label">Date *</Form.Label>
                      <Form.Control
                        type="date"
                        value={currentReport.report_date}
                        onChange={(e) => setCurrentReport({ ...currentReport, report_date: e.target.value })}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row className="g-3 mt-1">
                  <Col md={12}>
                    <Form.Group>
                      <Form.Label className="wmr-form-label">Place of Storage</Form.Label>
                      <Form.Control
                        value={currentReport.place_of_storage}
                        onChange={(e) => setCurrentReport({ ...currentReport, place_of_storage: e.target.value })}
                        placeholder="e.g., Building A, Room 101"
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Items Section */}
            <Card className="wmr-items-card mb-4">
              <Card.Header>
                <div>
                  <h6>Items for disposal</h6>
                  <p>List the materials, official receipt details, and disposal method.</p>
                </div>
                <span className="wmr-total-pill">
                  Total: {formatCurrency(currentReport.total_amount)}
                </span>
              </Card.Header>
              <Card.Body>
                {/* Add Item Form */}
                <div className="wmr-add-item-panel">
                  <h6>Add Item</h6>
                  <Row className="g-3 mb-3">
                    <Col md={2}>
                      <Form.Group className="mb-0">
                        <Form.Label className="wmr-form-label">Qty. *</Form.Label>
                        <Form.Control
                          type="number"
                          value={newItem.quantity}
                          onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })}
                          min="0"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group className="mb-0">
                        <Form.Label className="wmr-form-label">Unit</Form.Label>
                        <Form.Control
                          value={newItem.unit}
                          onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                          placeholder="pc, set, box"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group className="mb-0">
                        <Form.Label className="wmr-form-label">Description *</Form.Label>
                        <Form.Control
                          value={newItem.item_description}
                          onChange={(e) => setNewItem({ ...newItem, item_description: e.target.value })}
                          placeholder="Item description"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group className="mb-0">
                        <Form.Label className="wmr-form-label">O.R. No. *</Form.Label>
                        <Form.Control
                          value={newItem.or_number}
                          onChange={(e) => setNewItem({ ...newItem, or_number: e.target.value })}
                          placeholder="O.R. #"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group className="mb-0">
                        <Form.Label className="wmr-form-label">Amount</Form.Label>
                        <Form.Control
                          type="number"
                          step="0.01"
                          value={newItem.or_amount}
                          onChange={(e) => setNewItem({ ...newItem, or_amount: parseFloat(e.target.value) || 0 })}
                          min="0"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={1} className="d-flex align-items-end">
                      <Button onClick={handleAddItem} className="wmr-add-item-btn w-100">
                        <i className="bi bi-plus-lg" aria-hidden="true"></i>
                      </Button>
                    </Col>
                  </Row>

                  <Row className="g-3">
                    <Col md={12}>
                      <Form.Group>
                        <Form.Label className="wmr-form-label">Disposal Method</Form.Label>
                        <div className="wmr-method-grid">
                          {['Destroyed', 'Sold at private sale', 'Sold at public auction', 'Transferred', 'Other'].map((method) => (
                            <Form.Check
                              key={method}
                              type="radio"
                              label={method}
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
                {currentReport.items.length > 0 ? (
                  <Table size="sm" className="wmr-detail-table">
                    <thead>
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
                          <td className="text-end small fw-bold">{formatCurrency(item.or_amount)}</td>
                          <td><small className="wmr-method-pill">{item.disposal_method}</small></td>
                          <td className="text-center">
                            <Button
                              size="sm"
                              className="wmr-remove-btn"
                              onClick={() => handleRemoveItem(index)}
                              aria-label={`Remove ${item.item_description}`}
                            >
                              <i className="bi bi-trash" aria-hidden="true"></i>
                            </Button>
                          </td>
                        </tr>
                      ))}
                      <tr className="wmr-total-row">
                        <td colSpan={4} className="text-end py-2">TOTAL:</td>
                        <td className="text-end py-2">{formatCurrency(currentReport.total_amount)}</td>
                        <td></td>
                        <td></td>
                      </tr>
                    </tbody>
                  </Table>
                ) : (
                  <div className="wmr-inline-empty">
                    <i className="bi bi-box-seam" aria-hidden="true"></i>
                    <span>No disposal items added yet.</span>
                  </div>
                )}
              </Card.Body>
            </Card>

            {/* Certification Section */}
            <Card className="wmr-form-card mb-4">
              <Card.Body>
                <div className="wmr-form-section">
                  <h6>Certification</h6>
                  <p>Record the supply office certification and approval authority.</p>
                </div>
                <Row className="g-3">
                  <Col md={6}>
                    <p className="wmr-signature-caption">
                      <i className="bi bi-check2-circle" aria-hidden="true"></i>
                      Certified Correct
                    </p>
                    <Form.Group className="mb-2">
                      <Form.Label className="wmr-form-label">OIC - Supply and Property Office *</Form.Label>
                      <Form.Control
                        value={currentReport.certified_by}
                        onChange={(e) => setCurrentReport({ ...currentReport, certified_by: e.target.value })}
                        placeholder="Name"
                      />
                    </Form.Group>
                    <Form.Group>
                      <Form.Label className="wmr-form-label">Designation</Form.Label>
                      <Form.Control
                        value={currentReport.certified_by_designation}
                        onChange={(e) => setCurrentReport({ ...currentReport, certified_by_designation: e.target.value })}
                        placeholder="Title/Position"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <p className="wmr-signature-caption">
                      <i className="bi bi-check2-circle" aria-hidden="true"></i>
                      Disposal Approved
                    </p>
                    <Form.Group className="mb-2">
                      <Form.Label className="wmr-form-label">President *</Form.Label>
                      <Form.Control
                        value={currentReport.approved_by}
                        onChange={(e) => setCurrentReport({ ...currentReport, approved_by: e.target.value })}
                        placeholder="Name"
                      />
                    </Form.Group>
                    <Form.Group>
                      <Form.Label className="wmr-form-label">Designation</Form.Label>
                      <Form.Control
                        value={currentReport.approved_by_designation}
                        onChange={(e) => setCurrentReport({ ...currentReport, approved_by_designation: e.target.value })}
                        placeholder="Title/Position"
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Inspection Section */}
            <Card className="wmr-form-card">
              <Card.Body>
                <div className="wmr-form-section">
                  <h6>Certificate of Inspection</h6>
                  <p>I hereby certify that the property enumerated above was disposed of as follows.</p>
                </div>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="wmr-form-label">Property Inspector (Name & Signature)</Form.Label>
                      <Form.Control
                        value={currentReport.property_inspector}
                        onChange={(e) => setCurrentReport({ ...currentReport, property_inspector: e.target.value })}
                        placeholder="Inspector name"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="wmr-form-label">Witness to Disposition</Form.Label>
                      <Form.Control
                        value={currentReport.witness_to_disposition}
                        onChange={(e) => setCurrentReport({ ...currentReport, witness_to_disposition: e.target.value })}
                        placeholder="Witness name"
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button className="wmr-primary-action" onClick={handleSave}>
            <i className="bi bi-check-circle" aria-hidden="true"></i>
            Save Report
          </Button>
        </Modal.Footer>
      </Modal>

      {/* View Report Modal */}
      {selectedReport && (
        <Modal show={showViewModal} onHide={() => setShowViewModal(false)} size="lg" centered className="wmr-modal">
          <Modal.Header closeButton>
            <Modal.Title>
              <span>Waste Materials Report</span>
              <strong>{selectedReport.report_number}</strong>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {/* Report Info */}
            <div className="wmr-document-heading">
              <div>
                <span>Agency</span>
                <h3>{selectedReport.agency}</h3>
                <p>{selectedReport.place_of_storage || 'Storage location not set'}</p>
              </div>
              <span className={`badge wmr-status ${getStatusClass(selectedReport.status)}`}>
                {selectedReport.status}
              </span>
            </div>

            <Row className="g-3 mb-4">
              <Col md={4}>
                <div className="wmr-detail-tile">
                  <span>Report No.</span>
                  <strong>{selectedReport.report_number}</strong>
                </div>
              </Col>
              <Col md={4}>
                <div className="wmr-detail-tile">
                  <span>Report Date</span>
                  <strong>{formatDate(selectedReport.report_date)}</strong>
                </div>
              </Col>
              <Col md={4}>
                <div className="wmr-detail-tile">
                  <span>Total Amount</span>
                  <strong>{formatCurrency(selectedReport.total_amount)}</strong>
                </div>
              </Col>
            </Row>

            {/* Items */}
            <div className="wmr-section-title">
              <h6>Waste Items</h6>
              <span>{selectedReport.items.length} listed</span>
            </div>
            <div className="table-responsive mb-4">
              <Table size="sm" className="wmr-detail-table">
                <thead>
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
                      <td className="text-end small">{formatCurrency(item.or_amount)}</td>
                      <td><small className="wmr-method-pill">{item.disposal_method}</small></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            {/* Certification Info */}
            <div className="wmr-section-title">
              <h6>Certification</h6>
            </div>
            <Row className="g-4 mb-4">
              <Col md={6}>
                <div className="wmr-person-panel">
                  <span>Certified By</span>
                  <strong>{selectedReport.certified_by || 'Not set'}</strong>
                  <small>{selectedReport.certified_by_designation || 'Designation not set'}</small>
                </div>
              </Col>
              <Col md={6}>
                <div className="wmr-person-panel">
                  <span>Approved By</span>
                  <strong>{selectedReport.approved_by || 'Not set'}</strong>
                  <small>{selectedReport.approved_by_designation || 'Designation not set'}</small>
                </div>
              </Col>
            </Row>

            {/* Inspection Info */}
            <div className="wmr-section-title">
              <h6>Inspection</h6>
            </div>
            <Row className="g-4">
              <Col md={6}>
                <div className="wmr-person-panel">
                  <span>Property Inspector</span>
                  <strong>{selectedReport.property_inspector || 'Not set'}</strong>
                </div>
              </Col>
              <Col md={6}>
                <div className="wmr-person-panel">
                  <span>Witness to Disposition</span>
                  <strong>{selectedReport.witness_to_disposition || 'Not set'}</strong>
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
