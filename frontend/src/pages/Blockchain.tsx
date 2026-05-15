import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Container,
  Form,
  InputGroup,
  Modal,
  Row,
  Spinner,
  Table
} from 'react-bootstrap';
import { apiService } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';

interface ProcurementEvent {
  eventId: string;
  eventType: string;
  entityId: string;
  actor: string;
  status: string;
  payload: Record<string, any>;
  timestamp: string;
  txId: string;
  creatorMspId: string;
  locked?: boolean;
  islocked?: boolean;
}

const eventLabels: Record<string, string> = {
  INSPECTION_RECORDED: 'Inspection Recorded',
  PURCHASE_REQUEST_SUBMITTED: 'PR Submitted',
  PURCHASE_REQUEST_APPROVED: 'PR Approved',
  PURCHASE_ORDER_ISSUED: 'PO Issued',
  DELIVERY_RECEIVING_CONFIRMED: 'Delivery/Receiving',
  PAYMENT_COMPLETED: 'Payment Completed'
};

const eventVariants: Record<string, string> = {
  INSPECTION_RECORDED: 'success',
  PURCHASE_REQUEST_SUBMITTED: 'info',
  PURCHASE_REQUEST_APPROVED: 'success',
  PURCHASE_ORDER_ISSUED: 'primary',
  DELIVERY_RECEIVING_CONFIRMED: 'warning',
  PAYMENT_COMPLETED: 'success'
};

const Blockchain: React.FC = () => {
  const [events, setEvents] = useState<ProcurementEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState<ProcurementEvent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [fetchWarning, setFetchWarning] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setFetchError('');
      setFetchWarning('');
      const response = await apiService.getBlockchainEvents();
      const normalizedEvents = (response.events || []).map((event: any) => ({
        eventId: event.eventId || event.event_id || '',
        eventType: event.eventType || event.event_type || '',
        entityId: event.entityId || event.entity_id || event.details?.po_number || event.details?.inspection_id || '',
        actor: event.actor || event.performed_by || '',
        status: event.status || '',
        payload: event.payload || event.details || {},
        timestamp: event.timestamp || '',
        txId: event.txId || event.transaction_id || '',
        creatorMspId: event.creatorMspId || event.details?.creator_msp_id || '',
        locked: event.locked ?? event.details?.locked,
        islocked: event.islocked ?? event.details?.locked
      }));
      setEvents(normalizedEvents);
      setFetchWarning(response.warning || '');
    } catch (error: any) {
      console.error('Error fetching blockchain events:', error);
      setFetchError(error.response?.data?.detail || 'Blockchain events are not available right now.');
      setFetchWarning('');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return events.filter((event) => {
      const matchesType = eventTypeFilter === 'all' || event.eventType === eventTypeFilter;
      const searchableText = [
        event.eventId,
        event.eventType,
        event.entityId,
        event.actor,
        event.status,
        event.txId,
        JSON.stringify(event.payload || {})
      ].join(' ').toLowerCase();
      return matchesType && (!normalizedSearch || searchableText.includes(normalizedSearch));
    });
  }, [events, eventTypeFilter, searchTerm]);

  const eventTypes = useMemo(
    () => Array.from(new Set(events.map((event) => event.eventType).filter(Boolean))),
    [events]
  );

  const openDetails = (event: ProcurementEvent) => {
    setSelectedEvent(event);
    setVerificationResult(null);
    setShowModal(true);
  };

  const verifyEvent = async () => {
    if (!selectedEvent) return;
    try {
      setVerifying(true);
      const result = await apiService.verifyBlockchainEvent(selectedEvent.eventId);
      setVerificationResult(result);
      setToastMessage('Procurement event verified successfully');
      setToastType(result.verification === 'PASS' ? 'success' : 'warning');
      setShowToast(true);
    } catch (error: any) {
      console.error('Error verifying blockchain event:', error);
      setToastMessage(error.response?.data?.detail || 'Failed to verify procurement event');
      setToastType('error');
      setShowToast(true);
    } finally {
      setVerifying(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) return dateString;
    return parsed.toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEventBadge = (eventType: string) => (
    <Badge bg={eventVariants[eventType] || 'secondary'}>
      {eventLabels[eventType] || eventType}
    </Badge>
  );

  if (loading) {
    return (
      <Container className="mt-4">
        <LoadingSpinner />
      </Container>
    );
  }

  return (
    <Container fluid className="mt-4">
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <div>
            <h4 className="mb-0">
              <i className="bi bi-link-45deg me-2"></i>
              Blockchain Procurement Event Explorer
            </h4>
            <small className="text-muted">
              Immutable on-chain records for PR approvals, PO issuance, delivery receiving, and payments
            </small>
          </div>
          <Button variant="outline-primary" onClick={fetchEvents}>
            <i className="bi bi-arrow-clockwise me-2"></i>
            Refresh
          </Button>
        </Card.Header>

        <Card.Body>
          <Row className="g-3 mb-3">
            <Col md={6}>
              <InputGroup>
                <InputGroup.Text>
                  <i className="bi bi-search"></i>
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search event ID, entity, actor, status, transaction..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={3}>
              <Form.Select
                value={eventTypeFilter}
                onChange={(event) => setEventTypeFilter(event.target.value)}
                aria-label="Filter by procurement event type"
              >
                <option value="all">All event types</option>
                {eventTypes.map((eventType) => (
                  <option key={eventType} value={eventType}>
                    {eventLabels[eventType] || eventType}
                  </option>
                ))}
              </Form.Select>
            </Col>
          </Row>

          <Row className="g-3 mb-3">
            <Col md={3}>
              <Card className="bg-light">
                <Card.Body className="py-2">
                  <small className="text-muted">On-Chain Events</small>
                  <h5 className="mb-0">{events.length}</h5>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="bg-light">
                <Card.Body className="py-2">
                  <small className="text-muted">Filtered Results</small>
                  <h5 className="mb-0">{filteredEvents.length}</h5>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="bg-light">
                <Card.Body className="py-2">
                  <small className="text-muted">Event Types</small>
                  <h5 className="mb-0">{eventTypes.length}</h5>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="bg-light">
                <Card.Body className="py-2">
                  <small className="text-muted">Locked</small>
                  <h5 className="mb-0">{events.filter((event) => event.locked || event.islocked).length}</h5>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {fetchWarning && (
            <Alert variant="warning">
              <i className="bi bi-exclamation-triangle me-2"></i>
              {fetchWarning}
            </Alert>
          )}

          {filteredEvents.length === 0 ? (
            <Alert variant="info" className="text-center">
              <i className="bi bi-info-circle me-2"></i>
              {fetchError || 'No on-chain procurement events found.'}
            </Alert>
          ) : (
            <Table responsive striped hover>
              <thead>
                <tr>
                  <th>Event Type</th>
                  <th>Entity</th>
                  <th>Status</th>
                  <th>Actor</th>
                  <th>Timestamp</th>
                  <th>Transaction ID</th>
                  <th>Locked</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => (
                  <tr key={event.eventId}>
                    <td>{getEventBadge(event.eventType)}</td>
                    <td>
                      <strong>{event.entityId}</strong>
                      <div className="small text-muted">{event.eventId}</div>
                    </td>
                    <td>{event.status || 'N/A'}</td>
                    <td>{event.actor || 'N/A'}</td>
                    <td>{formatDate(event.timestamp)}</td>
                    <td>
                      <small className="font-monospace">{event.txId || 'N/A'}</small>
                    </td>
                    <td>
                      {event.locked || event.islocked ? (
                        <Badge bg="success">
                          <i className="bi bi-lock-fill me-1"></i>
                          Locked
                        </Badge>
                      ) : (
                        <Badge bg="secondary">N/A</Badge>
                      )}
                    </td>
                    <td>
                      <Button variant="outline-primary" size="sm" onClick={() => openDetails(event)}>
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

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Procurement Event Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedEvent && (
            <>
              <Row className="mb-3">
                <Col md={6}>
                  <strong>Event Type</strong>
                  <p>{getEventBadge(selectedEvent.eventType)}</p>
                </Col>
                <Col md={6}>
                  <strong>Entity ID</strong>
                  <p>{selectedEvent.entityId}</p>
                </Col>
                <Col md={6}>
                  <strong>Event ID</strong>
                  <p className="font-monospace small">{selectedEvent.eventId}</p>
                </Col>
                <Col md={6}>
                  <strong>Status</strong>
                  <p>{selectedEvent.status || 'N/A'}</p>
                </Col>
                <Col md={6}>
                  <strong>Actor</strong>
                  <p>{selectedEvent.actor || 'N/A'}</p>
                </Col>
                <Col md={6}>
                  <strong>Creator MSP</strong>
                  <p>{selectedEvent.creatorMspId || 'N/A'}</p>
                </Col>
                <Col md={12}>
                  <strong>Transaction ID</strong>
                  <p className="font-monospace small">{selectedEvent.txId || 'N/A'}</p>
                </Col>
              </Row>

              <h6>Payload</h6>
              <pre className="bg-light border rounded p-3 small">
                {JSON.stringify(selectedEvent.payload || {}, null, 2)}
              </pre>

              {verificationResult && (
                <Alert variant={verificationResult.verification === 'PASS' ? 'success' : 'warning'}>
                  <strong>Verification:</strong> {verificationResult.verification}
                  <br />
                  <strong>Locked:</strong> {verificationResult.locked ? 'Yes' : 'No'}
                  <br />
                  <strong>Immutable:</strong> {verificationResult.isImmutable ? 'Yes' : 'No'}
                  <br />
                  <strong>History Count:</strong> {verificationResult.historyCount}
                </Alert>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={verifyEvent} disabled={verifying || !selectedEvent}>
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
