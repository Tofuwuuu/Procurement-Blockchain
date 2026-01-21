import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Table, InputGroup } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { apiService, PurchaseRequest } from '../services/api';
import Toast from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';

interface SearchResult {
  no: number;
  category: string;
  itemDescription: string;
  unitPrice: number;
  supplierName: string;
  selected: boolean;
}

interface ApprovedPurchaseRequestRow extends PurchaseRequest {
  selected: boolean;
}

const SupplierSearch: React.FC = () => {
  const { user } = useAuth();
  const [urls, setUrls] = useState<string[]>(['www.website1.com/', 'www.website2.com/', 'www.website3.com/', 'www.website4.com/']);
  const [newUrl, setNewUrl] = useState('');
  const [formData, setFormData] = useState({
    stockPropertyNo: '',
    unit: '',
    itemDescription: '',
    quantity: '',
    unitCost: ''
  });
  const [approvedPRs, setApprovedPRs] = useState<ApprovedPurchaseRequestRow[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([
    { no: 1, category: 'Computer', itemDescription: 'Brand X Printer', unitPrice: 4700.00, supplierName: 'Company Name 1', selected: true },
    { no: 2, category: 'Computer', itemDescription: 'Brand Y Printer', unitPrice: 4899.00, supplierName: 'Company Name 2', selected: false },
    { no: 3, category: 'Computer', itemDescription: 'Epson Printer', unitPrice: 5000.00, supplierName: 'Company Name 3', selected: false },
    { no: 4, category: 'Computer', itemDescription: 'Brand Z Printer', unitPrice: 14299.00, supplierName: 'Company Name 4', selected: true },
  ]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [loading, setLoading] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [loadingApprovedPRs, setLoadingApprovedPRs] = useState(false);

  // Load saved results on mount
  useEffect(() => {
    loadSavedResults();
    loadApprovedPurchaseRequests();
  }, []);

  const loadSavedResults = async () => {
    try {
      setLoadingResults(true);
      const results = await apiService.getSupplierSearchResults({ limit: 100 });
      const formattedResults = results.map((r: any, index: number) => ({
        no: index + 1,
        category: r.category || 'General',
        itemDescription: r.item_description || '',
        unitPrice: r.unit_price || 0,
        supplierName: r.supplier_name || 'Unknown',
        selected: false
      }));
      setSearchResults(formattedResults);
    } catch (error: any) {
      console.error('Failed to load saved results:', error);
      // Keep mock data if API fails
    } finally {
      setLoadingResults(false);
    }
  };

  const loadApprovedPurchaseRequests = async () => {
    try {
      setLoadingApprovedPRs(true);
      const prs = await apiService.getPurchaseRequests(false);
      const approved = prs
        .filter((pr) => pr.status?.toLowerCase() === 'approved')
        .map((pr) => ({ ...pr, selected: false }));
      setApprovedPRs(approved);
    } catch (error) {
      console.error('Failed to load approved purchase requests:', error);
      setApprovedPRs([]);
    } finally {
      setLoadingApprovedPRs(false);
    }
  };

  const handleAddUrl = () => {
    if (newUrl.trim()) {
      setUrls([...urls, newUrl.trim()]);
      setNewUrl('');
    }
  };

  const handleRemoveUrl = (index: number) => {
    setUrls(urls.filter((_, i) => i !== index));
  };

  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSearch = async () => {
    try {
      setLoading(true);
      
      // Prepare search data
      const searchData = {
        urls: urls.filter(url => url.trim()),
        stock_property_no: formData.stockPropertyNo || undefined,
        unit: formData.unit || undefined,
        item_description: formData.itemDescription || undefined,
        quantity: formData.quantity ? parseInt(formData.quantity) : undefined,
        unit_cost: formData.unitCost ? parseFloat(formData.unitCost) : undefined
      };

      // Call API to search and scrape
      const results = await apiService.searchSuppliers(searchData);
      
      // Format results for display
      const formattedResults = results.map((r: any, index: number) => ({
        no: index + 1,
        category: r.category || 'General',
        itemDescription: r.item_description || '',
        unitPrice: r.unit_price || 0,
        supplierName: r.supplier_name || 'Unknown',
        selected: false
      }));

      setSearchResults(formattedResults);
      setToastMessage(`Found ${formattedResults.length} supplier result(s)`);
      setToastType('success');
      setShowToast(true);
    } catch (error: any) {
      console.error('Search error:', error);
      setToastMessage(error.response?.data?.detail || 'Failed to search suppliers');
      setToastType('error');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setSearchResults(results => results.map(r => ({ ...r, selected: checked })));
  };

  const handleSelectRow = (index: number) => {
    const newResults = [...searchResults];
    newResults[index].selected = !newResults[index].selected;
    setSearchResults(newResults);
  };

  const handleAddSelected = () => {
    const selected = searchResults.filter(r => r.selected);
    if (selected.length === 0) {
      setToastMessage('Please select at least one item');
      setToastType('warning');
      setShowToast(true);
      return;
    }
    // TODO: Implement add to abstract of canvass
    setToastMessage(`Added ${selected.length} item(s) to Abstract of Canvass`);
    setToastType('success');
    setShowToast(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const filteredResults = searchResults.filter(result =>
    result.itemDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
    result.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    result.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const allSelected = searchResults.length > 0 && searchResults.every(r => r.selected);

  return (
    <Container fluid className="py-4">
      <Row>
        <Col>
          <h2 className="mb-4">Supplier Search</h2>
        </Col>
      </Row>

      <Row>
        <Col md={4}>
          <Card className="mb-3">
            <Card.Header>
              <div className="d-flex justify-content-between align-items-center">
                <Form.Label className="fw-semibold mb-0">URL</Form.Label>
                <Button variant="primary" size="sm" onClick={handleAddUrl}>
                  Add
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              {urls.map((url, index) => (
                <InputGroup key={index} className="mb-2">
                  <Form.Control
                    value={url}
                    onChange={(e) => handleUrlChange(index, e.target.value)}
                    placeholder="www.example.com/"
                  />
                  <Button variant="outline-danger" onClick={() => handleRemoveUrl(index)}>
                    <i className="bi bi-x"></i>
                  </Button>
                </InputGroup>
              ))}
              <InputGroup>
                <Form.Control
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="www.example.com/"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                />
                <Button variant="primary" onClick={handleAddUrl}>
                  Add
                </Button>
              </InputGroup>

              {/* Approved PR mini list */}
              <div className="mt-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <Form.Label className="fw-semibold mb-0">Approved Purchase Requests</Form.Label>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={loadApprovedPurchaseRequests}
                    disabled={loadingApprovedPRs}
                  >
                    <i className="bi bi-arrow-clockwise"></i>
                  </Button>
                </div>
                <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: 4, padding: 8 }}>
                  {loadingApprovedPRs ? (
                    <div className="text-center py-2">
                      <LoadingSpinner size="sm" text="Loading..." />
                    </div>
                  ) : approvedPRs.length === 0 ? (
                    <div className="text-muted">No approved purchase requests</div>
                  ) : (
                    approvedPRs.map((pr) => (
                      <Form.Check
                        key={pr.id}
                        type="checkbox"
                        checked={pr.selected}
                        onChange={() =>
                          setApprovedPRs((rows) =>
                            rows.map((r) => (r.id === pr.id ? { ...r, selected: !r.selected } : r))
                          )
                        }
                        label={`${pr.pr_number} • ${pr.entity_name || ''}`}
                        className="mb-1"
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="mt-3">
                <Button 
                  variant="success" 
                  size="lg" 
                  className="w-100"
                  onClick={handleSearch} 
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Searching...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-search me-2"></i>
                      Search
                    </>
                  )}
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={8}>
          <Card>
            <Card.Header>
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Results</h5>
              </div>
            </Card.Header>
            <Card.Body>
              {/* Search Bar */}
              <InputGroup className="mb-3">
                <InputGroup.Text>
                  <i className="bi bi-search"></i>
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>

              {loadingResults && (
                <div className="text-center py-4">
                  <LoadingSpinner size="sm" text="Loading results..." />
                </div>
              )}

              {/* Results Table */}
              {!loadingResults && (
              <div className="table-responsive">
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th style={{ width: '5%' }}>No.</th>
                      <th style={{ width: '15%' }}>
                        Category
                        <i className="bi bi-arrow-up-down ms-2"></i>
                      </th>
                      <th style={{ width: '30%' }}>
                        Item Description
                        <i className="bi bi-arrow-up-down ms-2"></i>
                      </th>
                      <th style={{ width: '15%' }}>
                        Unit Price
                        <i className="bi bi-arrow-up-down ms-2"></i>
                      </th>
                      <th style={{ width: '20%' }}>
                        Supplier Name
                        <i className="bi bi-arrow-up-down ms-2"></i>
                      </th>
                      <th style={{ width: '15%' }}>
                        <Form.Check
                          type="checkbox"
                          checked={allSelected}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          label="Select All"
                          className="mb-0"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-4">
                          No results found
                        </td>
                      </tr>
                    ) : (
                      filteredResults.map((result, index) => (
                        <tr key={result.no}>
                          <td>{result.no}</td>
                          <td>{result.category}</td>
                          <td>{result.itemDescription}</td>
                          <td>{formatCurrency(result.unitPrice)}</td>
                          <td>{result.supplierName}</td>
                          <td className="text-center">
                            <Form.Check
                              type="checkbox"
                              checked={result.selected}
                              onChange={() => handleSelectRow(index)}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
              )}

              {/* Pagination */}
              <div className="d-flex justify-content-between align-items-center mt-3">
                <div>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                </div>
                <div className="d-flex gap-2 align-items-center">
                  {[1, 2, 3, 4, 5].map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'primary' : 'outline-primary'}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <div>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(5, currentPage + 1))}
                    disabled={currentPage === 5}
                  >
                    Next
                  </Button>
                </div>
              </div>

              {/* Add Button */}
              <div className="d-flex justify-content-end mt-3">
                <Button variant="primary" onClick={handleAddSelected}>
                  ADD
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Toast
        show={showToast}
        message={toastMessage}
        type={toastType}
        onClose={() => setShowToast(false)}
      />
    </Container>
  );
};

export default SupplierSearch;
