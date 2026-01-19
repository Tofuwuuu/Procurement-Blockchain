import React, { useEffect, useState } from 'react';
import { Container, Table, Card, Badge, Button } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { apiService, PurchaseRequest } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';

/**
 * Abstract of Canvass view for canvassers and admins.
 * Fetches purchase requests from the backend (MongoDB) in real time.
 */
const AbstractOfCanvass: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      // Canvasser should see all requests; backend enforces auth via JWT
      const data = await apiService.getPurchaseRequests(false);
      setRequests(data);
    } catch (err: any) {
      console.error('Failed to load purchase requests for canvass:', err);
      setToastMessage(err.response?.data?.message || 'Failed to load purchase requests');
      setToastType('error');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: string; text: string }> = {
      Pending: { variant: 'warning', text: 'Pending' },
      Approved: { variant: 'success', text: 'Approved' },
      Draft: { variant: 'secondary', text: 'Draft' },
      Completed: { variant: 'primary', text: 'Completed' },
    };
    const config = statusConfig[status] || { variant: 'secondary', text: status };
    return <Badge bg={config.variant}>{config.text}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <Container className="py-4">
        <LoadingSpinner size="lg" text="Loading abstract of canvass..." />
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="mb-1">Abstract of Canvass</h2>
          <p className="text-muted mb-0">
            {user?.role === 'canvasser' ? 'Review purchase requests for canvassing.' : 'Admin view of purchase requests.'}
          </p>
        </div>
        <Button variant="outline-primary" size="sm" onClick={loadRequests}>
          <i className="bi bi-arrow-clockwise me-2"></i>
          Refresh
        </Button>
      </div>

      <Card>
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table striped bordered hover className="mb-0">
              <thead className="bg-light">
                <tr>
                  <th>Status</th>
                  <th>P.R. Number</th>
                  <th>Entity / Requested By</th>
                  <th>Office / Section</th>
                  <th>Date Requested</th>
                  <th>Total Amount</th>
                  <th>Remark</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      No purchase requests found
                    </td>
                  </tr>
                ) : (
                  requests.map((req) => (
                    <tr key={req.id}>
                      <td>{getStatusBadge(req.status)}</td>
                      <td className="fw-semibold">{req.pr_number}</td>
                      <td>{req.requested_by || req.entity_name}</td>
                      <td>{req.office_section}</td>
                      <td>{formatDate(req.date_created)}</td>
                      <td>
                        {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(
                          req.total_amount || 0
                        )}
                      </td>
                      <td>{req.remark || 'No remarks'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      <Toast
        show={showToast}
        message={toastMessage}
        type={toastType}
        onClose={() => setShowToast(false)}
      />
    </Container>
  );
};

export default AbstractOfCanvass;
