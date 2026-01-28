import React, { useState, useEffect } from 'react';
import { 
  Container, Row, Col, Card, Table, Badge, 
  Form, Button, Modal, Alert, Spinner, InputGroup
} from 'react-bootstrap';
import { apiService } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';

interface BlockchainInspection {
  id: string;
  po_number: string;
  inspection_date: string;
  inspected_by: string;
  status: 'Accepted' | 'Partial' | 'Rejected';
  items: Array<{
    item_description: string;
    quantity_ordered: number;
    quantity_received: number;
    unit: string;
    condition: string;
    remarks?: string;
  }>;
  overall_remarks?: string;
  blockchain_tx_id?: string;
  blockchain_timestamp?: string;
  blockchain_recorded?: boolean;
  blockchain_data?: {
    inspectionId: string;
    timestamp: string;
    locked: boolean;
    txId: string;
    verification?: string;
  };
}

const Blockchain: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [inspections, setInspections] = useState<BlockchainInspection[]>([]);
  const [filteredInspections, setFilteredInspections] = useState<BlockchainInspection[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedInspection, setSelectedInspection] = useState<BlockchainInspection | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchBlockchainInspections();
  }, []);

  useEffect(() => {
    filterInspections();
  }, [inspections, searchTerm, statusFilter]);

  const fetchBlockchainInspections = async () => {
    try {
      setLoading(true);
      const data = await apiService.getBlockchainInspections();
      // Show ALL accepted inspections from MongoDB, with blockchain sync flags.
      // (Do not hide records just because blockchain sync failed.)
      setInspections(data);
    } catch (error: any) {
      console.error('Error fetching blockchain inspections:', error);
      setToastMessage(error.response?.data?.detail || 'Failed to fetch blockchain inspections');
      setToastType('error');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const filterInspections = () => {
    let filtered = [...inspections];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.inspected_by.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    setFilteredInspections(filtered);
  };

  const handleViewDetails = (inspection: BlockchainInspection) => {
    setSelectedInspection(inspection);
    setVerificationResult(null);
    setShowModal(true);
  };

  const handleVerify = async () => {
    if (!selectedInspection) return;

    try {
      setVerifying(true);
      const result = await apiService.verifyBlockchainInspection(selectedInspection.id);
      setVerificationResult(result);
      setToastMessage('Inspection verified successfully');
      setToastType('success');
      setShowToast(true);
    } catch (error: any) {
      console.error('Error verifying inspection:', error);
      setToastMessage(error.response?.data?.detail || 'Failed to verify inspection');
      setToastType('error');
      setShowToast(true);
    } finally {
      setVerifying(false);
    }
  };

  const handleSyncToBlockchain = async () => {
    try {
      setSyncing(true);
      const response = await apiService.syncInspectionsToBlockchain();
      setToastMessage(
        `Sync completed: ${response.synced_count} synced, ${response.failed_count} failed`
      );
      setToastType(response.failed_count === 0 ? 'success' : 'warning');
      setShowToast(true);
      // Refresh the list
      await fetchBlockchainInspections();
    } catch (error: any) {
      console.error('Error syncing to blockchain:', error);
      setToastMessage(error.response?.data?.detail || 'Failed to sync inspections to blockchain');
      setToastType('error');
      setShowToast(true);
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: 'success' | 'warning' | 'danger' } = {
      'Accepted': 'success',
      'Partial': 'warning',
      'Rejected': 'danger'
    };
    return <Badge bg={variants[status] || 'secondary'}>{status}</Badge>;
  };

  const getSyncBadge = (inspection: BlockchainInspection) => {
    if (inspection.blockchain_recorded) {
      return (
        <Badge bg="success">
          <i className="bi bi-check-circle me-1"></i>
          Synced
        </Badge>
      );
    }
    return (
      <Badge bg="warning" text="dark">
        <i className="bi bi-exclamation-circle me-1"></i>
        Pending
      </Badge>
    );
  };

  if (loading) {
    return (
      <Container className="mt-4">
        <LoadingSpinner />
      </Container>
    );
  }

  return (
    <Container fluid className="mt-4">
      <Row>
        <Col>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <div>
                <h4 className="mb-0">
                  <i className="bi bi-link-45deg me-2"></i>
                  Blockchain Inspection Records
                </h4>
                <small className="text-muted">
                  View immutable inspection records stored on the blockchain
                </small>
              </div>
            </Card.Header>
            <Card.Body>
              {/* Filters */}
              <Row className="mb-3">
                <Col md={6}>
                  <InputGroup>
                    <InputGroup.Text>
                      <i className="bi bi-search"></i>
                    </InputGroup.Text>
                    <Form.Control
                      type="text"
                      placeholder="Search by PO number, inspector, or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </InputGroup>
                </Col>
                <Col md={3}>
                  <Form.Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Status</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Partial">Partial</option>
                    <option value="Rejected">Rejected</option>
                  </Form.Select>
                </Col>
                <Col md={3} className="text-end">
                  <Button 
                    variant="success" 
                    onClick={handleSyncToBlockchain}
                    disabled={syncing}
                    className="me-2"
                  >
                    {syncing ? (
                      <>
                        <Spinner size="sm" className="me-2" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-cloud-upload me-2"></i>
                        Sync to Blockchain
                      </>
                    )}
                  </Button>
                  <Button variant="outline-primary" onClick={fetchBlockchainInspections}>
                    <i className="bi bi-arrow-clockwise me-2"></i>
                    Refresh
                  </Button>
                </Col>
              </Row>

              {/* Summary Stats */}
              <Row className="mb-3">
                <Col md={4}>
                  <Card className="bg-light">
                    <Card.Body className="py-2">
                      <small className="text-muted">Total Records</small>
                      <h5 className="mb-0">{inspections.length}</h5>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="bg-light">
                    <Card.Body className="py-2">
                      <small className="text-muted">Filtered Results</small>
                      <h5 className="mb-0">{filteredInspections.length}</h5>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="bg-light">
                    <Card.Body className="py-2">
                      <small className="text-muted">Locked Records</small>
                      <h5 className="mb-0">
                        {inspections.filter(i => i.blockchain_data?.locked).length}
                      </h5>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Table */}
              {filteredInspections.length === 0 ? (
                <Alert variant="info" className="text-center">
                  <i className="bi bi-info-circle me-2"></i>
                  No inspection records found.
                  {inspections.length === 0 && (
                    <div className="mt-2">
                      <small>Submit inspection reports to see them listed here.</small>
                    </div>
                  )}
                </Alert>
              ) : (
                <Table responsive striped hover>
                  <thead>
                    <tr>
                      <th>PO Number</th>
                      <th>Inspection Date</th>
                      <th>Inspected By</th>
                      <th>Status</th>
                      <th>Sync Status</th>
                      <th>Blockchain Timestamp</th>
                      <th>Locked</th>
                      <th>Transaction ID</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInspections.map((inspection) => (
                      <tr key={inspection.id}>
                        <td>
                          <strong>{inspection.po_number}</strong>
                        </td>
                        <td>{formatDate(inspection.inspection_date)}</td>
                        <td>{inspection.inspected_by}</td>
                        <td>{getStatusBadge(inspection.status)}</td>
                        <td>{getSyncBadge(inspection)}</td>
                        <td>
                          {inspection.blockchain_data?.timestamp 
                            ? formatDate(inspection.blockchain_data.timestamp)
                            : inspection.blockchain_timestamp 
                            ? formatDate(inspection.blockchain_timestamp)
                            : 'N/A'}
                        </td>
                        <td>
                          {inspection.blockchain_data?.locked ? (
                            <Badge bg="success">
                              <i className="bi bi-lock-fill me-1"></i>
                              Locked
                            </Badge>
                          ) : (
                            <Badge bg="secondary">
                              <i className="bi bi-unlock me-1"></i>
                              N/A
                            </Badge>
                          )}
                        </td>
                        <td>
                          <small className="font-monospace">
                            {inspection.blockchain_data?.txId || inspection.blockchain_tx_id || 'N/A'}
                          </small>
                        </td>
                        <td>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => handleViewDetails(inspection)}
                          >
                            <i className="bi bi-eye me-1"></i>
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Detail Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-link-45deg me-2"></i>
            Inspection Record Details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedInspection && (
            <>
              <Row className="mb-3">
                <Col md={6}>
                  <strong>PO Number:</strong>
                  <p>{selectedInspection.po_number}</p>
                </Col>
                <Col md={6}>
                  <strong>Inspection Date:</strong>
                  <p>{formatDate(selectedInspection.inspection_date)}</p>
                </Col>
                <Col md={6}>
                  <strong>Inspected By:</strong>
                  <p>{selectedInspection.inspected_by}</p>
                </Col>
                <Col md={6}>
                  <strong>Status:</strong>
                  <p>{getStatusBadge(selectedInspection.status)}</p>
                </Col>
                <Col md={6}>
                  <strong>Blockchain Timestamp:</strong>
                  <p>
                    {selectedInspection.blockchain_data?.timestamp 
                      ? formatDate(selectedInspection.blockchain_data.timestamp)
                      : selectedInspection.blockchain_timestamp 
                      ? formatDate(selectedInspection.blockchain_timestamp)
                      : 'N/A'}
                  </p>
                </Col>
                <Col md={6}>
                  <strong>Record Status:</strong>
                  <p>
                    {selectedInspection.blockchain_data?.locked ? (
                      <Badge bg="success">
                        <i className="bi bi-lock-fill me-1"></i>
                        Locked (Immutable)
                      </Badge>
                    ) : (
                      <Badge bg="warning">
                        <i className="bi bi-unlock me-1"></i>
                        Pending Lock
                      </Badge>
                    )}
                  </p>
                </Col>
                <Col md={12}>
                  <strong>Transaction ID:</strong>
                  <p className="font-monospace small">
                    {selectedInspection.blockchain_data?.txId || selectedInspection.blockchain_tx_id || 'N/A'}
                  </p>
                </Col>
                {selectedInspection.overall_remarks && (
                  <Col md={12}>
                    <strong>Overall Remarks:</strong>
                    <p>{selectedInspection.overall_remarks}</p>
                  </Col>
                )}
              </Row>

              <hr />

              <h6 className="mb-3">Inspection Items</h6>
              <Table striped size="sm">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty Ordered</th>
                    <th>Qty Received</th>
                    <th>Unit</th>
                    <th>Condition</th>
                    {selectedInspection.items.some(item => item.remarks) && <th>Remarks</th>}
                  </tr>
                </thead>
                <tbody>
                  {selectedInspection.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.item_description}</td>
                      <td>{item.quantity_ordered}</td>
                      <td>{item.quantity_received}</td>
                      <td>{item.unit}</td>
                      <td>
                        <Badge bg={item.condition === 'Good' ? 'success' : 'warning'}>
                          {item.condition}
                        </Badge>
                      </td>
                      {selectedInspection.items.some(i => i.remarks) && (
                        <td>{item.remarks || '-'}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </Table>

              {verificationResult && (
                <>
                  <hr />
                  <h6 className="mb-3">Verification Result</h6>
                  <Alert variant={verificationResult.verification === 'PASS' ? 'success' : 'warning'}>
                    <strong>Status:</strong> {verificationResult.verification}
                    <br />
                    <strong>Locked:</strong> {verificationResult.locked ? 'Yes' : 'No'}
                    <br />
                    <strong>Immutable:</strong> {verificationResult.isImmutable ? 'Yes' : 'No'}
                    <br />
                    <strong>History Count:</strong> {verificationResult.historyCount}
                  </Alert>
                </>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Close
          </Button>
          <Button 
            variant="primary" 
            onClick={handleVerify}
            disabled={verifying}
          >
            {verifying ? (
              <>
                <Spinner size="sm" className="me-2" />
                Verifying...
              </>
            ) : (
              <>
                <i className="bi bi-shield-check me-2"></i>
                Verify Integrity
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <Toast
        show={showToast}
        onClose={() => setShowToast(false)}
        message={toastMessage}
        type={toastType}
      />
    </Container>
  );
};

export default Blockchain;
