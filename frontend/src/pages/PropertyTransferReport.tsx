import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Form, Modal } from 'react-bootstrap';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';

const PropertyTransferReport: React.FC = () => {
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
      // const response = await fetch('/api/property-transfers');
      // const data = await response.json();
      // setTransfers(data);
      setTransfers([]);
    } catch (err) {
      setError('Failed to load property transfer reports');
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
    return <LoadingSpinner size="lg" text="Loading property transfer reports..." />;
  }

  return (
    <Container fluid className="py-4">
      {error && <Toast message={error} type="error" show={!!error} onClose={() => setError(null)} />}

      <Row className="mb-4">
        <Col>
          <h1 className="mb-2">Property Transfer Report</h1>
          <p className="text-muted">View and manage property transfer reports</p>
        </Col>
        <Col md="auto" className="d-flex align-items-center gap-2">
          <Button variant="primary" onClick={() => setShowModal(true)}>
            <i className="bi bi-plus-lg me-2"></i>
            New Transfer
          </Button>
        </Col>
      </Row>

      <Card>
        <Card.Header>
          <Form.Group className="mb-0">
            <Form.Control
              placeholder="Search by ID, from, or to..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              type="text"
            />
          </Form.Group>
        </Card.Header>
        <Card.Body>
          {filteredTransfers.length === 0 ? (
            <div className="text-center py-5">
              <p className="text-muted">No property transfer reports found</p>
            </div>
          ) : (
            <Table hover responsive>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Date</th>
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
                    <td>
                      <span className={`badge bg-${transfer.status === 'completed' ? 'success' : 'warning'}`}>
                        {transfer.status}
                      </span>
                    </td>
                    <td>
                      <Button variant="info" size="sm">
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

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>New Property Transfer</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>From</Form.Label>
              <Form.Control type="text" placeholder="Enter property from" />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>To</Form.Label>
              <Form.Control type="text" placeholder="Enter property to" />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Date</Form.Label>
              <Form.Control type="date" />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={() => setShowModal(false)}>
            Save Transfer
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default PropertyTransferReport;
