import React, { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, Form, Button, Table, InputGroup, Modal, Badge } from 'react-bootstrap';
import { apiService, PurchaseRequest } from '../services/api';
import Toast from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';
import './SupplierSearch.css';

interface SearchResult {
  id?: string;
  no: number;
  category: string;
  itemDescription: string;
  unitPrice: number;
  supplierName: string;
  source?: string;
  sourceType?: string;
  url?: string;
  verified?: boolean;
  isValidSupplier: boolean;
  priceFound: boolean;
  confidence?: number;
  extractionStatus?: string;
  extractionWarning?: string;
  dateScraped?: string;
  selected: boolean;
}

interface ApprovedPurchaseRequestRow extends PurchaseRequest {
  selected: boolean;
}

const SupplierSearch: React.FC = () => {
  const [urls, setUrls] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [formData] = useState({
    stockPropertyNo: '',
    unit: '',
    itemDescription: '',
    quantity: '',
    unitCost: ''
  });
  const [approvedPRs, setApprovedPRs] = useState<ApprovedPurchaseRequestRow[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [loading, setLoading] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [loadingApprovedPRs, setLoadingApprovedPRs] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPRForCanvass, setSelectedPRForCanvass] = useState<string>('');
  const [addingToCanvass, setAddingToCanvass] = useState(false);

  // Load saved results on mount
  useEffect(() => {
    loadSavedResults();
    loadApprovedPurchaseRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSavedResults = async () => {
    try {
      setLoadingResults(true);
      const results = await apiService.getSupplierSearchResults({ limit: 100 });
      const formattedResults = formatSupplierResults(results);
      setSearchResults(formattedResults);
    } catch (error: any) {
      console.error('Failed to load saved results:', error);
      setSearchResults([]);
      setToastMessage('Supplier search results are not available yet.');
      setToastType('info');
      setShowToast(true);
    } finally {
      setLoadingResults(false);
    }
  };

  const formatSupplierResults = (results: any[]) =>
    results.map((r: any, index: number) => ({
      id: r.id || r._id,
      no: index + 1,
      category: r.category || 'General',
      itemDescription: r.item_description || '',
      unitPrice: r.unit_price || 0,
      supplierName: r.supplier_name || 'Unknown',
      source: r.source,
      sourceType: r.source_type,
      url: r.url,
      verified: Boolean(r.verified),
      isValidSupplier: Boolean(r.is_valid_supplier),
      priceFound: Boolean(r.price_found),
      confidence: r.confidence,
      extractionStatus: r.extraction_status,
      extractionWarning: r.extraction_warning,
      dateScraped: r.date_scraped,
      selected: false
    }));

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

  const handleSearch = async () => {
    try {
      setLoading(true);

      // Get checked purchase request IDs
      const checkedPRs = approvedPRs.filter(pr => pr.selected).map(pr => pr.id!);
      
      // Determine which search to perform
      const activeUrls = urls.filter(url => url.trim());
      
      if (activeUrls.length === 0 && checkedPRs.length === 0) {
        setToastMessage('Please provide either supplier URLs or select purchase requests to search');
        setToastType('warning');
        setShowToast(true);
        setLoading(false);
        return;
      }

      const resultSets: any[][] = [];

      if (checkedPRs.length > 0) {
        const searchData = {
          purchase_request_ids: checkedPRs,
          stock_property_no: formData.stockPropertyNo || undefined,
          unit: formData.unit || undefined,
          quantity: formData.quantity ? parseInt(formData.quantity) : undefined,
          unit_cost: formData.unitCost ? parseFloat(formData.unitCost) : undefined
        };
        resultSets.push(await apiService.searchSuppliersFromPurchaseRequests(searchData));
      }

      if (activeUrls.length > 0) {
        const searchData = {
          urls: activeUrls,
          stock_property_no: formData.stockPropertyNo || undefined,
          unit: formData.unit || undefined,
          item_description: formData.itemDescription || undefined,
          quantity: formData.quantity ? parseInt(formData.quantity) : undefined,
          unit_cost: formData.unitCost ? parseFloat(formData.unitCost) : undefined
        };

        resultSets.push(await apiService.searchSuppliers(searchData));
      }
      
      const uniqueResults = Array.from(
        new Map(
          resultSets
            .flat()
            .map((result) => [result.id || result._id || `${result.supplier_name}-${result.item_description}-${result.url}`, result])
        ).values()
      );
      const formattedResults = formatSupplierResults(uniqueResults);

      setSearchResults(formattedResults);
      const validCount = formattedResults.filter((result) => result.isValidSupplier).length;
      setToastMessage(`Found ${formattedResults.length} result(s), ${validCount} eligible for canvass`);
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
    const visibleKeys = new Set(filteredResults.map((result) => result.id || String(result.no)));
    setSearchResults(results =>
      results.map(r => (visibleKeys.has(r.id || String(r.no)) && r.isValidSupplier ? { ...r, selected: checked } : r))
    );
  };

  const handleSelectRow = (result: SearchResult) => {
    if (!result.isValidSupplier) {
      setToastMessage(result.extractionWarning || 'This source is not eligible for canvass.');
      setToastType('warning');
      setShowToast(true);
      return;
    }
    const key = result.id || String(result.no);
    setSearchResults(results =>
      results.map(r => ((r.id || String(r.no)) === key ? { ...r, selected: !r.selected } : r))
    );
  };

  const handleAddSelected = () => {
    const selected = searchResults.filter(r => r.selected && r.isValidSupplier);
    if (selected.length === 0) {
      setToastMessage('Please select at least one supplier');
      setToastType('warning');
      setShowToast(true);
      return;
    }
    // Show modal to select PR
    setShowAddModal(true);
  };

  const handleConfirmAddToCanvass = async () => {
    if (!selectedPRForCanvass) {
      setToastMessage('Please select a purchase request');
      setToastType('warning');
      setShowToast(true);
      return;
    }

    try {
      setAddingToCanvass(true);
      const selected = searchResults.filter(r => r.selected && r.isValidSupplier);
      
      // Use the actual supplier IDs from the results, filtering out undefined
      const supplierIds = selected.map(s => s.id).filter((id): id is string => Boolean(id));

      if (supplierIds.length === 0) {
        setToastMessage('No valid supplier IDs found');
        setToastType('warning');
        setShowToast(true);
        return;
      }

      await apiService.addSuppliersToCanvass({
        purchase_request_id: selectedPRForCanvass,
        supplier_ids: supplierIds
      });

      setToastMessage(`Added ${selected.length} supplier(s) to the purchase request`);
      setToastType('success');
      setShowToast(true);

      // Clear selections
      setSearchResults(results => results.map(r => ({ ...r, selected: false })));
      setShowAddModal(false);
      setSelectedPRForCanvass('');
    } catch (error: any) {
      console.error('Error adding suppliers to canvass:', error);
      setToastMessage(error.response?.data?.detail || 'Failed to add suppliers to canvass');
      setToastType('error');
      setShowToast(true);
    } finally {
      setAddingToCanvass(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getHostName = (url?: string) => {
    if (!url) return 'No URL';
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  const statusLabel = (result: SearchResult) => {
    if (!result.isValidSupplier) return 'Unsupported';
    if ((result.confidence || 0) > 70 && result.priceFound) return 'Validated';
    return 'Needs Validation';
  };

  const qualityClass = (result: SearchResult) => {
    if (!result.isValidSupplier) return 'unsupported';
    if ((result.confidence || 0) > 70 && result.priceFound) return 'validated';
    return 'needs-validation';
  };

  const qualityIcon = (result: SearchResult) => {
    if (!result.isValidSupplier) return 'bi-x-circle-fill';
    if ((result.confidence || 0) > 70 && result.priceFound) return 'bi-check-circle-fill';
    return 'bi-exclamation-triangle-fill';
  };

  const confidenceClass = (confidence?: number) => {
    if (typeof confidence !== 'number') return 'unknown';
    if (confidence < 30) return 'low';
    if (confidence <= 70) return 'medium';
    return 'high';
  };

  const sourceClass = (sourceType?: string) => {
    const normalized = (sourceType || '').toLowerCase();
    if (normalized.includes('supplier') || normalized.includes('website')) return 'supplier';
    if (normalized.includes('reference')) return 'reference';
    return 'neutral';
  };

  const filteredResults = useMemo(
    () =>
      searchResults.filter(result =>
        result.itemDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (result.sourceType || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (result.url || '').toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [searchResults, searchTerm]
  );

  // Pagination logic - 10 items per page
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedResults = filteredResults.slice(startIndex, endIndex);

  const selectedCount = searchResults.filter(r => r.selected).length;
  const selectedPRCount = approvedPRs.filter(pr => pr.selected).length;
  const validVisibleResults = filteredResults.filter((result) => result.isValidSupplier);
  const allVisibleSelected = validVisibleResults.length > 0 && validVisibleResults.every(r => r.selected);
  const unsupportedCount = filteredResults.filter((result) => !result.isValidSupplier).length;
  const unsupportedRatio = filteredResults.length > 0 ? unsupportedCount / filteredResults.length : 0;

  return (
    <Container fluid className="supplier-search-page py-4">
      <div className="supplier-page-header">
        <div>
          <div className="supplier-eyebrow">Procurement Sourcing</div>
          <h2 className="mb-1">Supplier Search</h2>
          <p className="supplier-page-subtitle mb-0">
            Search supplier references from approved purchase requests or supplier URLs, then attach eligible results to canvass.
          </p>
        </div>
        <div className="supplier-header-actions">
          <Badge className="supplier-soft-badge">{approvedPRs.length} approved PRs</Badge>
          <Badge className="supplier-soft-badge selected">{selectedCount} selected suppliers</Badge>
        </div>
      </div>

      <div className="supplier-notice" role="alert">
        <i className="bi bi-info-circle"></i>
        <span>Only supported supplier sources can be selected. Reference pages and search/map results are shown for review but cannot be added to canvass.</span>
      </div>

      <Row className="g-3">
        <Col lg={4} xl={3}>
          <Card className="supplier-search-card">
            <Card.Body>
              <div className="supplier-panel-heading">
                <div>
                  <h5>Search Sources</h5>
                  <span>Use approved PRs, supplier URLs, or both.</span>
                </div>
              </div>
              <div className="supplier-section-title">
                <i className="bi bi-link-45deg"></i>
                URL Sources
              </div>
              <div className="supplier-url-list">
                {urls.length === 0 && (
                  <div className="supplier-empty-mini">No URL sources added</div>
                )}
                {urls.map((url, index) => (
                <InputGroup key={index} className="supplier-url-row">
                  <Form.Control
                    value={url}
                    onChange={(e) => handleUrlChange(index, e.target.value)}
                    placeholder="https://supplier.example.com/product"
                  />
                  <Button variant="outline-danger" onClick={() => handleRemoveUrl(index)} aria-label="Remove URL">
                    <i className="bi bi-x-lg"></i>
                  </Button>
                </InputGroup>
                ))}
              </div>
              <InputGroup className="supplier-add-url">
                <Form.Control
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="Add supplier product or catalog URL"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                />
                <Button variant="primary" onClick={handleAddUrl}>
                  <i className="bi bi-plus-lg me-1"></i>
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
                <div className="supplier-helper-text">
                  <i className="bi bi-info-circle"></i> Check items to search by their descriptions.
                  {selectedPRCount > 0 && ` ${selectedPRCount} selected.`}
                </div>
                <div className="supplier-pr-list">
                  {loadingApprovedPRs ? (
                    <div className="supplier-loading-inline">
                      <LoadingSpinner size="sm" text="Loading..." />
                    </div>
                  ) : approvedPRs.length === 0 ? (
                    <div className="supplier-empty-mini">No approved purchase requests</div>
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
                  className="supplier-search-button"
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
                      Search Suppliers
                    </>
                  )}
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={8} xl={9}>
          <Card className="supplier-results-card">
            <Card.Body className="p-0">
              <div className="supplier-results-toolbar">
                <div>
                  <h5>Supplier Results</h5>
                  <span>{filteredResults.length} results shown, {validVisibleResults.length} eligible, {selectedCount} selected</span>
                </div>
              {/* Search Bar */}
              <InputGroup className="supplier-results-search">
                <InputGroup.Text>
                  <i className="bi bi-search"></i>
                </InputGroup.Text>
                <Form.Control
                  placeholder="Filter supplier, category, or item..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </InputGroup>
              </div>

              {loadingResults && (
                <div className="text-center py-4">
                  <LoadingSpinner size="sm" text="Loading results..." />
                </div>
              )}

              {!loadingResults && unsupportedRatio >= 0.5 && filteredResults.length > 0 && (
                <div className="supplier-validation-note" role="status">
                  <i className="bi bi-exclamation-triangle"></i>
                  <span>
                    Many results are reference-only or low-confidence. Unsupported sources require manual verification before they can be used in a quotation.
                  </span>
                </div>
              )}

              {/* Results Table */}
              {!loadingResults && (
              <div className="table-responsive supplier-results-scroll">
                <Table hover className="supplier-results-table mb-0">
                  <thead>
                    <tr>
                      <th style={{ width: '5%' }}>No.</th>
                      <th style={{ width: '31%' }}>
                        Supplier / Item
                      </th>
                      <th style={{ width: '12%' }}>
                        Unit Price
                      </th>
                      <th style={{ width: '25%' }}>
                        Source & Category
                      </th>
                      <th style={{ width: '17%' }}>
                        Quality & Confidence
                      </th>
                      <th style={{ width: '10%' }}>
                        <Form.Check
                          type="checkbox"
                          checked={allVisibleSelected}
                          disabled={validVisibleResults.length === 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          label="Add to Canvass"
                          className="supplier-select-all mb-0"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedResults.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="supplier-empty-state">
                          <i className="bi bi-search"></i>
                          <strong>No supplier results found</strong>
                          <span>Try another URL, approved PR, or result filter.</span>
                        </td>
                      </tr>
                    ) : (
                      paginatedResults.map((result) => (
                        <tr key={result.id || result.no} className={result.selected ? 'selected-row' : ''}>
                          <td>{result.no}</td>
                          <td className="supplier-name-cell">
                            <div className="supplier-primary-line">
                              <span>{result.supplierName}</span>
                              {result.extractionWarning && (
                                <button
                                  type="button"
                                  className="supplier-info-button"
                                  title={result.extractionWarning}
                                  aria-label="Source note"
                                >
                                  <i className="bi bi-info-circle"></i>
                                </button>
                              )}
                            </div>
                            <small className="supplier-item-cell">{result.itemDescription}</small>
                          </td>
                          <td className="supplier-price-cell">{formatCurrency(result.unitPrice)}</td>
                          <td className="supplier-source-cell">
                            <div className="supplier-badge-row">
                              <Badge className="supplier-category-badge">{result.category}</Badge>
                              <Badge className={`supplier-source-badge ${sourceClass(result.sourceType)}`}>
                                {result.sourceType || 'Unknown'}
                              </Badge>
                            </div>
                            <span className="supplier-host" title={result.url}>{getHostName(result.url)}</span>
                          </td>
                          <td>
                            <div className="supplier-quality-stack">
                            <Badge className={`supplier-quality-badge ${qualityClass(result)}`}>
                              <i className={`bi ${qualityIcon(result)}`}></i>
                              {statusLabel(result)}
                            </Badge>
                            {typeof result.confidence === 'number' && (
                              <span className={`supplier-confidence-chip ${confidenceClass(result.confidence)}`}>
                                <span style={{ width: `${Math.max(4, Math.min(100, result.confidence))}%` }}></span>
                                <strong>{result.confidence}%</strong>
                              </span>
                            )}
                            </div>
                          </td>
                          <td className="supplier-select-cell">
                            <div className="supplier-select-controls">
                              <Form.Check
                                type="checkbox"
                                checked={result.selected}
                                disabled={!result.isValidSupplier}
                                onChange={() => handleSelectRow(result)}
                                className="supplier-row-check"
                              />
                              <Button
                                variant="outline-primary"
                                size="sm"
                                className="supplier-row-select"
                                disabled={!result.isValidSupplier}
                                onClick={() => handleSelectRow(result)}
                                title={!result.isValidSupplier ? 'Unsupported sources require manual verification first.' : undefined}
                              >
                                {result.selected ? 'Selected' : 'Select'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
              )}

              {/* Pagination */}
              <div className="supplier-results-footer">
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
                <div className="supplier-page-buttons">
                  {Array.from({ length: totalPages || 1 }, (_, i) => i + 1).map((page) => (
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
                    onClick={() => setCurrentPage(Math.min(totalPages || 1, currentPage + 1))}
                    disabled={currentPage === (totalPages || 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>

              {/* Add Button */}
              <div className="supplier-add-bar">
                <span>{selectedCount} supplier{selectedCount === 1 ? '' : 's'} selected for canvass</span>
                <Button variant="primary" onClick={handleAddSelected} disabled={selectedCount === 0}>
                  <i className="bi bi-plus-circle me-2"></i>
                  Add to Canvass
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Add to Canvass Modal */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Add to Abstract of Canvass</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Select the purchase request to add the selected suppliers:</p>
          <Form.Group>
            <Form.Label>Purchase Request</Form.Label>
            <Form.Select
              value={selectedPRForCanvass}
              onChange={(e) => setSelectedPRForCanvass(e.target.value)}
            >
              <option value="">-- Choose a PR --</option>
              {approvedPRs.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.pr_number} - {pr.entity_name} ({pr.office_section})
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => setShowAddModal(false)}
            disabled={addingToCanvass}
          >
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleConfirmAddToCanvass}
            disabled={addingToCanvass}
          >
            {addingToCanvass ? 'Adding...' : 'Add to Canvass'}
          </Button>
        </Modal.Footer>
      </Modal>

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
