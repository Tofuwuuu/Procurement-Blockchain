import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Badge, Spinner } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { 
  apiService, 
  SystemSettings, 
  UserPreferences, 
  UpdateSystemSettingsData, 
  UpdateUserPreferencesData
} from '../services/api';
import Toast from '../components/Toast';

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  });

  // Form states
  const [systemForm, setSystemForm] = useState<UpdateSystemSettingsData>({});
  const [preferencesForm, setPreferencesForm] = useState<UpdateUserPreferencesData>({});

  useEffect(() => {
    if (user?.is_admin) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Load system settings
      try {
        const settings = await apiService.getSystemSettings();
        setSystemSettings(settings);
        setSystemForm({
          company_name: settings.company_name,
          company_address: settings.company_address,
          company_phone: settings.company_phone,
          company_email: settings.company_email,
          bir_tin: settings.bir_tin,
          system_language: settings.system_language,
          timezone: settings.timezone,
          currency: settings.currency,
          date_format: settings.date_format,
          notifications_enabled: settings.notifications_enabled,
          email_notifications: settings.email_notifications,
          audit_logging: settings.audit_logging,
          maintenance_mode: settings.maintenance_mode,
        });
      } catch (error) {
        console.error('System settings endpoint is not available:', error);
        setSystemSettings(null);
        setSystemForm({});
      }

      // Load user preferences
      try {
        const preferences = await apiService.getUserPreferences();
        setUserPreferences(preferences);
        setPreferencesForm({
          language: preferences.language,
          theme: preferences.theme,
          email_notifications: preferences.email_notifications,
          order_updates: preferences.order_updates,
          system_alerts: preferences.system_alerts,
          dashboard_layout: preferences.dashboard_layout,
        });
      } catch (error) {
        console.error('User preferences endpoint is not available:', error);
        setUserPreferences(null);
        setPreferencesForm({});
      }

      // Load system info
      try {
        const info = await apiService.getSystemInfo();
        setSystemInfo(info);
      } catch (error) {
        console.error('System info endpoint is not available:', error);
        setSystemInfo(null);
      }


    } catch (error) {
      console.error('Failed to load settings:', error);
      setToast({
        show: true,
        message: 'Failed to load settings',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSystemSettingsSave = async () => {
    try {
      setSaving(true);
      await apiService.updateSystemSettings(systemForm);
      setToast({
        show: true,
        message: 'System settings updated successfully',
        type: 'success'
      });
      await loadSettings(); // Reload to get updated data
    } catch (error) {
      console.error('Failed to update system settings:', error);
      setToast({
        show: true,
        message: 'Failed to update system settings',
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePreferencesSave = async () => {
    try {
      setSaving(true);
      await apiService.updateUserPreferences(preferencesForm);
      setToast({
        show: true,
        message: 'User preferences updated successfully',
        type: 'success'
      });
      await loadSettings(); // Reload to get updated data
    } catch (error) {
      console.error('Failed to update user preferences:', error);
      setToast({
        show: true,
        message: 'Failed to update user preferences',
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSystemFormChange = (field: keyof UpdateSystemSettingsData, value: any) => {
    setSystemForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePreferencesFormChange = (field: keyof UpdateUserPreferencesData, value: any) => {
    setPreferencesForm(prev => ({
      ...prev,
      [field]: value
    }));
  };



  if (!user?.is_admin) {
    return (
      <Container className="py-4">
        <Alert variant="danger">
          <h4>Access Denied</h4>
          <p>You need administrator privileges to access the Settings page.</p>
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container className="py-4 text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-3">Loading settings...</p>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">System Settings</h1>
        <div>
          <Button variant="outline-secondary" className="me-2">
            <i className="bi bi-download me-2"></i>
            Export
          </Button>
          <Button variant="outline-secondary">
            <i className="bi bi-upload me-2"></i>
            Import
          </Button>
        </div>
      </div>

      {!systemSettings && !userPreferences && !systemInfo && (
        <Alert variant="info" className="mb-4">
          <i className="bi bi-info-circle me-2"></i>
          Settings management is coming soon. The backend settings endpoints are not available yet.
        </Alert>
      )}

      <Row>
        {/* System Settings */}
        <Col lg={8}>
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">
                <i className="bi bi-gear me-2"></i>
                System Configuration
              </h5>
            </Card.Header>
            <Card.Body>
              <Form>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Company Name *</Form.Label>
                      <Form.Control
                        type="text"
                        value={systemForm.company_name || ''}
                        onChange={(e) => handleSystemFormChange('company_name', e.target.value)}
                        placeholder="Company Name"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>BIR TIN *</Form.Label>
                      <Form.Control
                        type="text"
                        value={systemForm.bir_tin || ''}
                        onChange={(e) => handleSystemFormChange('bir_tin', e.target.value)}
                        placeholder="123-456-789-000"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Company Phone</Form.Label>
                      <Form.Control
                        type="text"
                        value={systemForm.company_phone || ''}
                        onChange={(e) => handleSystemFormChange('company_phone', e.target.value)}
                        placeholder="+63 2 1234 5678"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Company Email</Form.Label>
                      <Form.Control
                        type="email"
                        value={systemForm.company_email || ''}
                        onChange={(e) => handleSystemFormChange('company_email', e.target.value)}
                        placeholder="procurement@example.com"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label>Company Address</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={systemForm.company_address || ''}
                    onChange={(e) => handleSystemFormChange('company_address', e.target.value)}
                    placeholder="Company Address"
                  />
                </Form.Group>

                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>System Language</Form.Label>
                      <Form.Select
                        value={systemForm.system_language || 'en'}
                        onChange={(e) => handleSystemFormChange('system_language', e.target.value)}
                      >
                        <option value="en">English</option>
                        <option value="fil">Filipino</option>
                        <option value="es">Spanish</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Timezone</Form.Label>
                      <Form.Select
                        value={systemForm.timezone || 'Asia/Manila'}
                        onChange={(e) => handleSystemFormChange('timezone', e.target.value)}
                      >
                        <option value="Asia/Manila">Asia/Manila (UTC+8)</option>
                        <option value="UTC">UTC</option>
                        <option value="America/New_York">America/New_York (UTC-5)</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Currency</Form.Label>
                      <Form.Select
                        value={systemForm.currency || 'PHP'}
                        onChange={(e) => handleSystemFormChange('currency', e.target.value)}
                      >
                        <option value="PHP">Philippine Peso (₱)</option>
                        <option value="USD">US Dollar ($)</option>
                        <option value="EUR">Euro (€)</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Date Format</Form.Label>
                      <Form.Select
                        value={systemForm.date_format || 'MM/DD/YYYY'}
                        onChange={(e) => handleSystemFormChange('date_format', e.target.value)}
                      >
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Maintenance Mode</Form.Label>
                      <div className="mt-2">
                        <Form.Check
                          type="switch"
                          id="maintenance-mode"
                          checked={systemForm.maintenance_mode || false}
                          onChange={(e) => handleSystemFormChange('maintenance_mode', e.target.checked)}
                          label="Enable maintenance mode"
                        />
                      </div>
                    </Form.Group>
                  </Col>
                </Row>

                <div className="d-flex gap-2">
                  <Button 
                    variant="primary" 
                    onClick={handleSystemSettingsSave}
                    disabled={saving || !systemSettings}
                  >
                    {saving ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-2"></i>
                        Save System Settings
                      </>
                    )}
                  </Button>
                  <Button variant="outline-secondary" onClick={loadSettings}>
                    <i className="bi bi-arrow-clockwise me-2"></i>
                    Reset
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>

          {/* User Preferences */}
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">
                <i className="bi bi-person-gear me-2"></i>
                User Preferences
              </h5>
            </Card.Header>
            <Card.Body>
              <Form>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Language</Form.Label>
                      <Form.Select
                        value={preferencesForm.language || 'en'}
                        onChange={(e) => handlePreferencesFormChange('language', e.target.value)}
                      >
                        <option value="en">English</option>
                        <option value="fil">Filipino</option>
                        <option value="es">Spanish</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Theme</Form.Label>
                      <Form.Select
                        value={preferencesForm.theme || 'light'}
                        onChange={(e) => handlePreferencesFormChange('theme', e.target.value)}
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="auto">Auto</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Dashboard Layout</Form.Label>
                      <Form.Select
                        value={preferencesForm.dashboard_layout || 'default'}
                        onChange={(e) => handlePreferencesFormChange('dashboard_layout', e.target.value)}
                      >
                        <option value="default">Default</option>
                        <option value="compact">Compact</option>
                        <option value="detailed">Detailed</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label>Notifications</Form.Label>
                  <div className="mt-2">
                    <Form.Check
                      type="checkbox"
                      id="email-notifications"
                      checked={preferencesForm.email_notifications || false}
                      onChange={(e) => handlePreferencesFormChange('email_notifications', e.target.checked)}
                      label="Email notifications"
                      className="mb-2"
                    />
                    <Form.Check
                      type="checkbox"
                      id="order-updates"
                      checked={preferencesForm.order_updates || false}
                      onChange={(e) => handlePreferencesFormChange('order_updates', e.target.checked)}
                      label="Order updates"
                      className="mb-2"
                    />
                    <Form.Check
                      type="checkbox"
                      id="system-alerts"
                      checked={preferencesForm.system_alerts || false}
                      onChange={(e) => handlePreferencesFormChange('system_alerts', e.target.checked)}
                      label="System alerts"
                    />
                  </div>
                </Form.Group>

                <div className="d-flex gap-2">
                  <Button 
                    variant="primary" 
                    onClick={handlePreferencesSave}
                    disabled={saving || !userPreferences}
                  >
                    {saving ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-2"></i>
                        Save Preferences
                      </>
                    )}
                  </Button>
                  <Button variant="outline-secondary" onClick={loadSettings}>
                    <i className="bi bi-arrow-clockwise me-2"></i>
                    Reset
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* System Information */}
        <Col lg={4}>
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">
                <i className="bi bi-info-circle me-2"></i>
                System Information
              </h5>
            </Card.Header>
            <Card.Body>
              {systemInfo && (
                <div>
                  <div className="mb-3">
                    <strong>Version:</strong>
                    <Badge bg="primary" className="ms-2">{systemInfo.version}</Badge>
                  </div>
                  <div className="mb-3">
                    <strong>Environment:</strong>
                    <Badge bg={systemInfo.environment === 'production' ? 'success' : 'warning'} className="ms-2">
                      {systemInfo.environment}
                    </Badge>
                  </div>
                  <div className="mb-3">
                    <strong>Database:</strong>
                    <span className="ms-2">{systemInfo.database}</span>
                  </div>
                  <div className="mb-3">
                    <strong>Uptime:</strong>
                    <span className="ms-2">{Math.floor(systemInfo.uptime / 3600)}h {Math.floor((systemInfo.uptime % 3600) / 60)}m</span>
                  </div>
                  <div className="mb-3">
                    <strong>Last Backup:</strong>
                    <span className="ms-2">{systemInfo.last_backup}</span>
                  </div>
                </div>
              )}
              
              <hr />
              
              <div className="d-grid gap-2">
                <Button variant="outline-info" size="sm">
                  <i className="bi bi-database me-2"></i>
                  Backup Database
                </Button>
                <Button variant="outline-warning" size="sm">
                  <i className="bi bi-arrow-clockwise me-2"></i>
                  Clear Cache
                </Button>
                <Button variant="outline-danger" size="sm">
                  <i className="bi bi-trash me-2"></i>
                  Clear Logs
                </Button>
              </div>
            </Card.Body>
          </Card>


        </Col>
      </Row>

      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, show: false })}
      />
    </Container>
  );
};

export default Settings;
