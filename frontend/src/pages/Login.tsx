import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Container, Form, InputGroup, Row } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

interface LoginFormData {
  username: string;
  password: string;
}

interface LoginErrors {
  username?: string;
  password?: string;
  general?: string;
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, loading: authLoading } = useAuth();

  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: ''
  });
  const [errors, setErrors] = useState<LoginErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, location]);

  useEffect(() => {
    if (errors.username && formData.username) {
      setErrors(prev => ({ ...prev, username: undefined }));
    }
    if (errors.password && formData.password) {
      setErrors(prev => ({ ...prev, password: undefined }));
    }
  }, [formData, errors.username, errors.password]);

  const validateForm = (): boolean => {
    const newErrors: LoginErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.trim().length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 5) {
      newErrors.password = 'Password must be at least 5 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof LoginFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) return;

    try {
      setLoading(true);
      setErrors({});
      await login(formData.username.trim(), formData.password);
    } catch (error: any) {
      if (error.response?.status === 401) {
        setErrors({ general: 'Invalid username or password. Please check your credentials.' });
      } else if (error.response?.status === 400) {
        setErrors({ general: error.response.data?.error || 'Invalid request. Please check your input.' });
      } else if (error.response?.status >= 500) {
        setErrors({ general: 'Server error. Please try again later.' });
      } else if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
        setErrors({ general: 'Network error. Please check your connection and try again.' });
      } else {
        setErrors({ general: 'Login failed. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !loading) {
      handleSubmit(event);
    }
  };

  if (authLoading) {
    return (
      <main className="login-container">
        <div className="login-loading">
          <LoadingSpinner size="lg" text="Checking authentication..." />
        </div>
      </main>
    );
  }

  return (
    <main className="login-container">
      <Container fluid className="login-shell">
        <Row className="login-grid g-0">
          <Col lg={6} className="login-brand-panel">
            <div className="login-brand-content">
              <div className="login-brand-mark">
                <i className="bi bi-shield-check" aria-hidden="true"></i>
                <span>PAMS</span>
              </div>
              <h1>Procurement control for every approval, receipt, and payment.</h1>
              <p>
                A Philippine-compliant procurement workspace built for accountable public-sector purchasing.
              </p>
              <div className="login-brand-metrics" aria-label="System highlights">
                <div>
                  <strong>PR</strong>
                  <span>approval trail</span>
                </div>
                <div>
                  <strong>PO</strong>
                  <span>issuance tracking</span>
                </div>
                <div>
                  <strong>BC</strong>
                  <span>ledger records</span>
                </div>
              </div>
            </div>
          </Col>

          <Col lg={6} className="login-form-panel">
            <div className="ph-login-wrapper">
              <Card className="ph-login-card">
                <Card.Body>
                  <div className="login-card-header">
                    <div className="ph-logo-container">
                      <i className="bi bi-shield-lock ph-logo-icon" aria-hidden="true"></i>
                    </div>
                    <div>
                      <div className="login-eyebrow">Secure access</div>
                      <h2>Sign in to PAMS</h2>
                      <p>Use your assigned account to continue.</p>
                    </div>
                  </div>

                  {errors.general && (
                    <Alert
                      variant="danger"
                      dismissible
                      onClose={() => setErrors(prev => ({ ...prev, general: undefined }))}
                      className="ph-alert"
                      role="alert"
                    >
                      <i className="bi bi-exclamation-triangle me-2" aria-hidden="true"></i>
                      {errors.general}
                    </Alert>
                  )}

                  <Form onSubmit={handleSubmit} className="ph-form" noValidate>
                    <Form.Group className="mb-3">
                      <Form.Label htmlFor="username" className="ph-form-label">
                        Username
                      </Form.Label>
                      <InputGroup className="ph-input-group">
                        <InputGroup.Text>
                          <i className="bi bi-person" aria-hidden="true"></i>
                        </InputGroup.Text>
                        <Form.Control
                          id="username"
                          type="text"
                          placeholder="Enter your username"
                          value={formData.username}
                          onChange={(event) => handleInputChange('username', event.target.value)}
                          onKeyDown={handleKeyDown}
                          isInvalid={!!errors.username}
                          aria-describedby={errors.username ? 'usernameError' : undefined}
                          disabled={loading}
                          autoComplete="username"
                          className="ph-form-control"
                          aria-required="true"
                        />
                      </InputGroup>
                      {errors.username && (
                        <div className="login-field-error" id="usernameError">
                          <i className="bi bi-exclamation-circle me-1" aria-hidden="true"></i>
                          {errors.username}
                        </div>
                      )}
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label htmlFor="password" className="ph-form-label">
                        Password
                      </Form.Label>
                      <InputGroup className="ph-input-group">
                        <InputGroup.Text>
                          <i className="bi bi-lock" aria-hidden="true"></i>
                        </InputGroup.Text>
                        <Form.Control
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter your password"
                          value={formData.password}
                          onChange={(event) => handleInputChange('password', event.target.value)}
                          onKeyDown={handleKeyDown}
                          isInvalid={!!errors.password}
                          aria-describedby={errors.password ? 'passwordError' : undefined}
                          disabled={loading}
                          autoComplete="current-password"
                          className="ph-form-control"
                          aria-required="true"
                        />
                        <Button
                          type="button"
                          variant="outline-secondary"
                          className="ph-password-toggle"
                          onClick={() => setShowPassword(prev => !prev)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          disabled={loading}
                        >
                          <i className={showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'} aria-hidden="true"></i>
                        </Button>
                      </InputGroup>
                      {errors.password && (
                        <div className="login-field-error" id="passwordError">
                          <i className="bi bi-exclamation-circle me-1" aria-hidden="true"></i>
                          {errors.password}
                        </div>
                      )}
                    </Form.Group>

                    <div className="login-form-options">
                      <Form.Check
                        type="checkbox"
                        id="remember"
                        label="Keep me signed in"
                        checked={rememberMe}
                        onChange={(event) => setRememberMe(event.target.checked)}
                        disabled={loading}
                        className="ph-checkbox"
                      />
                    </div>

                    <Button
                      type="submit"
                      className="ph-btn-primary"
                      disabled={loading}
                      aria-label="Sign in to account"
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Signing in
                        </>
                      ) : (
                        <>
                          <i className="bi bi-box-arrow-in-right me-2" aria-hidden="true"></i>
                          Sign in
                        </>
                      )}
                    </Button>
                  </Form>
                </Card.Body>
              </Card>

              <div className="ph-footer-info">
                <div>
                  <i className="bi bi-geo-alt-fill" aria-hidden="true"></i>
                  <span>Market Road, Maduya, Carmona, Cavite, 4116, Philippines</span>
                </div>
                <div>
                  <i className="bi bi-card-text" aria-hidden="true"></i>
                  <span>BIR TIN: 123-456-789-000</span>
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </Container>
    </main>
  );
};

export default Login;
