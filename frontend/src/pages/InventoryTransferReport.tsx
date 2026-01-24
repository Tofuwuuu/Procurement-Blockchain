import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Form, Modal } from 'react-bootstrap';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';

const InventoryTransferReport: React.FC = () => {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchTransfers();
  }, []);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      setError(null);
      // TODO: Replace with actual API call
      // const response = await fetch('/api/transfers');
      // const data = await response.json();
      // setTransfers(data);
      setTransfers([]);
    } catch (err) {
      setError('Failed to load inventory transfer reports');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransfers = transfers.filter((transfer: any) =>
    transfer.id?.toString().includes(searchTerm) ||
    transfer.from?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    transfer.to?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <LoadingSpinner size="lg" text="Loading inventory transfer reports..." />;
  }

  return (
    <Container fluid className="py-4">
      {error && <Toast message={error} type="error" show={!!error} onClose={() => setError(null)} />}

      <Row className="mb-4">
        <Col>
          <h1 className="mb-2">Inventory Transfer Report</h1>
          <p className="text-muted">Manage and track inventory transfers between custodians</p>
        </Col>
        <Col xs="auto">
          <Button 
            variant="primary" 
            onClick={() => setShowModal(true)}
            className="d-flex align-items-center gap-2"
          >
            <i className="bi bi-plus-lg"></i>
            New Transfer
          </Button>
        </Col>
      </Row>

      <Card>
        <Card.Body>
          <Form className="mb-4">
            <Form.Group>
              <Form.Control
                placeholder="Search by transfer ID, from, or to..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-control-sm"
              />
            </Form.Group>
          </Form>

          {filteredTransfers.length > 0 ? (
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>Transfer ID</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransfers.map((transfer: any) => (
                  <tr key={transfer.id}>
                    <td>{transfer.id}</td>
                    <td>{transfer.from}</td>
                    <td>{transfer.to}</td>
                    <td>{transfer.date}</td>
                    <td>{transfer.items_count}</td>
                    <td>
                      <span className={`badge bg-${transfer.status === 'completed' ? 'success' : 'warning'}`}>
                        {transfer.status}
                      </span>
                    </td>
                    <td>
                      <Button variant="sm" size="sm" className="me-2">
                        View
                      </Button>
                      <Button variant="info" size="sm">
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <div className="text-center py-5">
              <i className="bi bi-inbox" style={{ fontSize: '3rem', color: '#ccc' }}></i>
              <p className="text-muted mt-3">No inventory transfer reports found. Create a new one to get started.</p>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* New Transfer Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Create New Inventory Transfer</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* TODO: Add form for creating new transfer */}
          <p>Transfer creation form will be implemented here</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => setShowModal(false)}>
            Create Transfer
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default InventoryTransferReport;
