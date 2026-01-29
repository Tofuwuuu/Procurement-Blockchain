import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Container, Row, Spinner, Table } from 'react-bootstrap';
import { apiService, ConnectionsStatus, ConnectionTarget, ClientConnection } from '../services/api';

const Connections: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ConnectionsStatus | null>(null);

  const targets = useMemo<ConnectionTarget[]>(() => data?.targets ?? [], [data]);
  const clients = useMemo<ClientConnection[]>(() => data?.clients ?? [], [data]);

  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const res = await apiService.getConnectionsStatus();
      setData(res);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load connection status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    const id = window.setInterval(() => {
      fetchStatus();
    }, 5000);
    return () => window.clearInterval(id);
  }, [fetchStatus]);

  return (
    <Container className="py-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h1 className="mb-1">Connections</h1>
          <div className="text-muted small">
            Checks whether Fabric endpoints (orderer/peers) are reachable from this server.
          </div>
        </div>
        <Button variant="outline-primary" onClick={fetchStatus} disabled={loading}>
          {loading ? (
            <>
              <Spinner size="sm" className="me-2" />
              Checking…
            </>
          ) : (
            <>
              <i className="bi bi-arrow-clockwise me-2"></i>
              Refresh
            </>
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="danger" className="mb-3">
          {error}
        </Alert>
      )}

      <Row className="g-3">
        <Col md={12}>
          <Card>
            <Card.Header className="d-flex align-items-center justify-content-between">
              <div className="fw-semibold">Fabric Connectivity</div>
              <div className="text-muted small">
                Last checked: {data?.checked_at ? new Date(data.checked_at).toLocaleString() : '—'}
              </div>
            </Card.Header>
            <Card.Body>
              <Table responsive hover className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Target</th>
                    <th>Host</th>
                    <th>Port</th>
                    <th>Status</th>
                    <th>Latency</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {targets.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-muted">
                        {loading ? 'Loading…' : 'No targets returned.'}
                      </td>
                    </tr>
                  )}
                  {targets.map((t) => (
                    <tr key={`${t.name}-${t.host}-${t.port}`}>
                      <td className="fw-semibold text-capitalize">{t.name}</td>
                      <td className="font-monospace small">{t.host}</td>
                      <td>{t.port}</td>
                      <td>
                        {t.connected ? (
                          <Badge bg="success">
                            <i className="bi bi-check-circle me-1"></i>
                            Connected
                          </Badge>
                        ) : (
                          <Badge bg="danger">
                            <i className="bi bi-x-circle me-1"></i>
                            Disconnected
                          </Badge>
                        )}
                      </td>
                      <td>{typeof t.latency_ms === 'number' ? `${t.latency_ms} ms` : '—'}</td>
                      <td className="text-muted small">
                        {!t.connected ? (t.error || 'Unknown error') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mt-3">
        <Col md={12}>
          <Card>
            <Card.Header className="d-flex align-items-center justify-content-between">
              <div className="fw-semibold">Client Connections</div>
              <div className="text-muted small">
                Shows browsers that have pinged this backend in the last 60 seconds.
              </div>
            </Card.Header>
            <Card.Body>
              <Table responsive hover className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Client ID</th>
                    <th>IP</th>
                    <th>User Agent</th>
                    <th>Last Seen</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-muted">
                        {loading ? 'Waiting for client pings…' : 'No recent client connections.'}
                      </td>
                    </tr>
                  )}
                  {clients.map((c) => (
                    <tr key={c.id}>
                      <td className="font-monospace small">{c.id}</td>
                      <td className="font-monospace small">{c.ip}</td>
                      <td className="small text-truncate" style={{ maxWidth: 320 }}>
                        {c.user_agent}
                      </td>
                      <td className="small">
                        {c.last_seen ? new Date(c.last_seen).toLocaleString() : '—'}
                      </td>
                      <td>
                        {c.online ? (
                          <Badge bg="success">
                            <i className="bi bi-circle-fill me-1" />
                            Online
                          </Badge>
                        ) : (
                          <Badge bg="secondary">
                            <i className="bi bi-circle me-1" />
                            Offline
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Connections;

