import axios, { AxiosInstance, AxiosResponse, AxiosError, AxiosRequestConfig } from 'axios';

// API base configuration
// Use proxy in development (package.json "proxy"), otherwise honor env var
const isDev = process.env.NODE_ENV !== 'production';
const API_BASE_URL = isDev ? '' : (process.env.REACT_APP_API_URL || 'https://your-api.example.com');

// Create axios instance with default config
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
});

// Request interceptor to add auth token or session cookie
api.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    // Check for auth token in localStorage
    const token = localStorage.getItem('authToken');
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Ensure headers object exists
    if (!config.headers) {
      config.headers = {};
    }
    
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Clear auth token and redirect to login
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Standard API response interface
export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
}

// Helper method to handle API responses
const handleApiResponse = <T>(response: AxiosResponse<T>): ApiResponse<T> => ({
  ok: true,
  data: response.data,
});

// Helper method to handle API errors
const handleApiError = (error: AxiosError): ApiResponse => {
  const errorMessage = (error.response?.data as any)?.message || error.message || 'An error occurred';
  return {
    ok: false,
    error: errorMessage,
  };
};

// Helper methods with standardized response format
export const httpService = {
  // GET request
  get: async <T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    try {
      const response = await api.get<T>(url, config);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error as AxiosError);
    }
  },

  // POST request
  post: async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    try {
      const response = await api.post<T>(url, data, config);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error as AxiosError);
    }
  },

  // PUT request
  put: async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    try {
      const response = await api.put<T>(url, data, config);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error as AxiosError);
    }
  },

  // DELETE request
  delete: async <T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    try {
      const response = await api.delete<T>(url, config);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error as AxiosError);
    }
  },

  // PATCH request
  patch: async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    try {
      const response = await api.patch<T>(url, data, config);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error as AxiosError);
    }
  },
};

// ===== TYPES =====

export interface User {
  id: number;
  username: string;
  full_name: string;
  position: string;
  department: string;
  role: string;
  is_admin: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateUserData {
  username: string;
  password: string;
  full_name: string;
  position: string;
  department: string;
  role: string;
}

export interface DashboardStats {
  pending_orders: number;
  approved_orders: number;
  low_inventory: number;
  recent_orders: RecentOrder[];
}

export interface RecentOrder {
  id: number;
  po_number: string;
  supplier: {
    name: string;
  };
  date_created: string;
  status: string;
  total_amount: number;
}

// Blockchain Types
export interface Block {
  index: number;
  timestamp: string;
  transactions: Transaction[];
  nonce: number;
  previous_hash: string;
  hash: string;
}

export interface Transaction {
  from: string;
  to: string;
  amount: number;
  action: string;
  data?: any;
  timestamp: string;
}

export interface Chain {
  chain: Block[];
  length: number;
}

export interface Peer {
  id: string;
  url: string;
  is_active: boolean;
}

// Procurement Types
export interface Supplier {
  id: number;
  name: string;
  address: string;
  province: string;
  contact_person: string;
  phone: string;
  email?: string;
  bir_tin: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  supplier: Supplier;
  delivery_address: string;
  notes?: string;
  status: 'Draft' | 'Pending' | 'Approved' | 'Completed' | 'Cancelled';
  total_amount: number;
  date_created: string;
  date_updated: string;
  items: OrderItem[];
}

export interface OrderItem {
  id: number;
  product_id: number;
  product: Product;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Product {
  id: number;
  name: string;
  description?: string;
  unit: string;
  unit_price: number;
  category: string;
  is_active: boolean;
}

export interface Inventory {
  id: number;
  product_id: number;
  product: Product;
  quantity: number;
  unit_price: number;
  total_value: number;
  last_updated: string;
}

export interface InventoryAdjustment {
  id: number;
  product_id: number;
  product: Product;
  adjustment: number;
  reason: string;
  adjusted_by: string;
  date_adjusted: string;
}

// Form Types
export interface CreateSupplierData {
  name: string;
  address: string;
  province: string;
  contact_person: string;
  phone: string;
  email?: string;
  bir_tin: string;
  is_active: boolean;
}

export interface CreateOrderData {
  supplier_id: number;
  delivery_address: string;
  notes?: string;
  items: {
    product_id: number;
    quantity: number;
    unit_price: number;
  }[];
}

export interface CreateTransactionData {
  from: string;
  to: string;
  amount: number;
  action: string;
  data?: any;
}

// Purchase Request Types
export interface PurchaseRequestItem {
  unit: string;
  item_description: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
}

export interface CreatePurchaseRequestData {
  entity_name: string;
  fund_cluster?: string;
  office_section: string;
  responsibility_center_code?: string;
  date: string;
  remark?: string;
  items: PurchaseRequestItem[];
}

export interface PurchaseRequest {
  id: string;
  pr_number: string;
  ref_number?: string;
  entity_name: string;
  fund_cluster?: string;
  office_section: string;
  responsibility_center_code?: string;
  date: string;
  remark?: string;
  status: string;
  requested_by: string;
  requested_by_id?: string;
  items: PurchaseRequestItem[];
  total_amount: number;
  date_created: string;
  date_updated?: string;
  suppliers?: Array<{
    supplier_id?: string;
    name?: string;
    address?: string;
    unit_price?: number;
    item_description?: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    source?: string;
    date_added?: string;
  }>;
  selected_supplier_ids?: string[];
  canvass_submitted_at?: string;
}

// ===== SETTINGS TYPES =====
export interface SystemSettings {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  bir_tin: string;
  system_language: string;
  timezone: string;
  currency: string;
  date_format: string;
  notifications_enabled: boolean;
  email_notifications: boolean;
  audit_logging: boolean;
  maintenance_mode: boolean;
  updated_at: string;
  updated_by: string;
}

export interface UserPreferences {
  user_id: number;
  language: string;
  theme: 'light' | 'dark' | 'auto';
  email_notifications: boolean;
  order_updates: boolean;
  system_alerts: boolean;
  dashboard_layout: string;
  updated_at: string;
}

export interface UpdateSystemSettingsData {
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
  bir_tin?: string;
  system_language?: string;
  timezone?: string;
  currency?: string;
  date_format?: string;
  notifications_enabled?: boolean;
  email_notifications?: boolean;
  audit_logging?: boolean;
  maintenance_mode?: boolean;
}

export interface UpdateUserPreferencesData {
  language?: string;
  theme?: 'light' | 'dark' | 'auto';
  email_notifications?: boolean;
  order_updates?: boolean;
  system_alerts?: boolean;
  dashboard_layout?: string;
}



// ===== API SERVICE =====

export const apiService = {
  // ===== AUTHENTICATION =====
  login: async (credentials: { username: string; password: string }) => {
    try {
      const response = await api.post('/api/auth/login', credentials);
      return response.data;
    } catch (error) {
      console.error('Login API error:', error);
      throw error;
    }
  },
  
  logout: async () => {
    try {
      const response = await api.post('/api/auth/logout');
      return response.data;
    } catch (error) {
      console.error('Logout API error:', error);
      throw error;
    }
  },
  
  getCurrentUser: async (): Promise<User> => {
    try {
      const response = await api.get('/api/auth/me');
      return response.data;
    } catch (error) {
      console.error('Get current user API error:', error);
      throw error;
    }
  },

  // ===== DASHBOARD =====
  getDashboardStats: async (): Promise<DashboardStats> => {
    const response = await api.get('/api/stats');
    return response.data;
  },
  
  getChain: async (): Promise<DashboardStats> => {
    const response = await api.get('/chain');
    return response.data;
  },

  // ===== BLOCKCHAIN =====
  getBlockchain: async (): Promise<Chain> => {
    const response = await api.get('/chain');
    return response.data;
  },

  getBlock: async (index: number): Promise<Block> => {
    const response = await api.get(`/chain/block/${index}`);
    return response.data;
  },

  createTransaction: async (data: CreateTransactionData): Promise<Transaction> => {
    const response = await api.post('/transactions/new', data);
    return response.data;
  },

  mineBlock: async (): Promise<Block> => {
    const response = await api.get('/mine');
    return response.data;
  },

  // ===== PEERS =====
  getPeers: async (): Promise<Peer[]> => {
    const response = await api.get('/peers');
    return response.data.peers || [];
  },

  addPeer: async (url: string): Promise<Peer> => {
    // Parse URL to extract host and port
    const urlObj = new URL(url);
    const host = urlObj.hostname;
    const port = parseInt(urlObj.port);
    
    const response = await api.post('/add_peer', { 
      host, 
      port, 
      nodeId: `node-${Date.now()}` 
    });
    return response.data;
  },

  // ===== SUPPLIERS =====
  getSuppliers: async (): Promise<Supplier[]> => {
    const response = await api.get('/api/suppliers');
    return response.data;
  },

  getSupplier: async (id: number): Promise<Supplier> => {
    const response = await api.get(`/api/suppliers/${id}`);
    return response.data;
  },

  createSupplier: async (data: CreateSupplierData): Promise<Supplier> => {
    const response = await api.post('/api/suppliers', data);
    return response.data;
  },

  updateSupplier: async (id: number, data: Partial<CreateSupplierData>): Promise<Supplier> => {
    const response = await api.put(`/api/suppliers/${id}`, data);
    return response.data;
  },

  deleteSupplier: async (id: number): Promise<void> => {
    const response = await api.delete(`/api/suppliers/${id}`);
    return response.data;
  },

  // ===== PURCHASE REQUESTS =====
  getPurchaseRequests: async (userOnly: boolean = false): Promise<PurchaseRequest[]> => {
    try {
      const url = `/api/purchase-requests${userOnly ? '?user_only=true' : ''}`;
      console.log('📡 Fetching purchase requests from:', url);
      const response = await api.get(url);
      console.log('✅ Purchase requests response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching purchase requests:', error);
      console.error('Response:', error.response?.data);
      throw error;
    }
  },

  getPurchaseRequest: async (id: string): Promise<PurchaseRequest> => {
    const response = await api.get(`/api/purchase-requests/${id}`);
    return response.data;
  },

  updatePurchaseRequest: async (id: string, data: Partial<PurchaseRequest>): Promise<PurchaseRequest> => {
    const response = await api.put(`/api/purchase-requests/${id}`, data);
    return response.data;
  },

  createPurchaseRequest: async (data: CreatePurchaseRequestData): Promise<PurchaseRequest> => {
    const response = await api.post('/api/purchase-requests', data);
    return response.data;
  },

  // ===== PURCHASE ORDERS =====
  getOrders: async (): Promise<PurchaseOrder[]> => {
    const response = await api.get('/api/orders');
    return response.data;
  },

  getOrder: async (id: number): Promise<PurchaseOrder> => {
    const response = await api.get(`/api/orders/${id}`);
    return response.data;
  },

  createOrder: async (data: CreateOrderData): Promise<PurchaseOrder> => {
    const response = await api.post('/api/orders', data);
    return response.data;
  },

  updateOrder: async (id: number, data: Partial<CreateOrderData>): Promise<PurchaseOrder> => {
    const response = await api.put(`/api/orders/${id}`, data);
    return response.data;
  },

  deleteOrder: async (id: number): Promise<void> => {
    const response = await api.delete(`/api/orders/${id}`);
    return response.data;
  },

  approveOrder: async (id: number): Promise<PurchaseOrder> => {
    const response = await api.post(`/api/orders/${id}/approve`);
    return response.data;
  },

  // ===== INVENTORY =====
  getInventory: async (): Promise<Inventory[]> => {
    const response = await api.get('/api/inventory');
    return response.data;
  },

  getInventoryItem: async (id: number): Promise<Inventory> => {
    const response = await api.get(`/api/inventory/${id}`);
    return response.data;
  },

  adjustInventory: async (data: { product_id: number; adjustment: number; reason: string }): Promise<InventoryAdjustment> => {
    const response = await api.post('/api/inventory/adjust', data);
    return response.data;
  },

  // ===== PRODUCTS =====
  getProducts: async (): Promise<Product[]> => {
    const response = await api.get('/api/products');
    return response.data;
  },

  getProduct: async (id: number): Promise<Product> => {
    const response = await api.get(`/api/products/${id}`);
    return response.data;
  },

  createProduct: async (data: Omit<Product, 'id'>): Promise<Product> => {
    const response = await api.post('/api/products', data);
    return response.data;
  },

  updateProduct: async (id: number, data: Partial<Product>): Promise<Product> => {
    const response = await api.put(`/api/products/${id}`, data);
    return response.data;
  },

  deleteProduct: async (id: number): Promise<void> => {
    const response = await api.delete(`/api/products/${id}`);
    return response.data;
  },

  // ===== USER MANAGEMENT =====
  getUsers: async (): Promise<User[]> => {
    const response = await api.get('/api/users');
    return response.data;
  },

  getUser: async (id: number): Promise<User> => {
    const response = await api.get(`/api/users/${id}`);
    return response.data;
  },

  createUser: async (data: CreateUserData): Promise<User> => {
    const response = await api.post('/api/users', data);
    return response.data;
  },

  updateUser: async (id: number, data: Partial<CreateUserData>): Promise<User> => {
    const response = await api.put(`/api/users/${id}`, data);
    return response.data;
  },

  updateUserPassword: async (id: number, password: string): Promise<{ message: string }> => {
    const response = await api.put(`/api/users/${id}/password`, { password });
    return response.data;
  },

  deleteUser: async (id: number): Promise<void> => {
    const response = await api.delete(`/api/users/${id}`);
    return response.data;
  },

  getRoles: async (): Promise<{ roles: string[]; descriptions: Record<string, string> }> => {
    const response = await api.get('/api/roles');
    return response.data;
  },

  // ===== SETTINGS =====
  getSystemSettings: async (): Promise<SystemSettings> => {
    const response = await api.get('/api/settings/system');
    return response.data;
  },

  updateSystemSettings: async (data: UpdateSystemSettingsData): Promise<SystemSettings> => {
    const response = await api.put('/api/settings/system', data);
    return response.data;
  },

  getUserPreferences: async (): Promise<UserPreferences> => {
    const response = await api.get('/api/settings/preferences');
    return response.data;
  },

  updateUserPreferences: async (data: UpdateUserPreferencesData): Promise<UserPreferences> => {
    const response = await api.put('/api/settings/preferences', data);
    return response.data;
  },

  getSystemInfo: async (): Promise<{
    version: string;
    environment: string;
    database: string;
    uptime: number;
    last_backup: string;
  }> => {
    const response = await api.get('/api/settings/system-info');
    return response.data;
  },

  exportSystemData: async (): Promise<{ download_url: string }> => {
    const response = await api.post('/api/settings/export');
    return response.data;
  },

  importSystemData: async (file: File): Promise<{ message: string; imported_count: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/settings/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  // ===== SUPPLIER SEARCH =====
  searchSuppliers: async (data: {
    urls?: string[];
    stock_property_no?: string;
    unit?: string;
    item_description?: string;
    quantity?: number;
    unit_cost?: number;
  }): Promise<any[]> => {
    const response = await api.post('/api/supplier-search/search', data);
    return response.data;
  },

  searchSuppliersFromPurchaseRequests: async (data: {
    purchase_request_ids: string[];
    stock_property_no?: string;
    unit?: string;
    quantity?: number;
    unit_cost?: number;
  }): Promise<any[]> => {
    const response = await api.post('/api/supplier-search/search-from-purchase-requests', data);
    return response.data;
  },

  getSupplierSearchResults: async (params?: {
    item_description?: string;
    category?: string;
    limit?: number;
  }): Promise<any[]> => {
    const queryParams = new URLSearchParams();
    if (params?.item_description) queryParams.append('item_description', params.item_description);
    if (params?.category) queryParams.append('category', params.category);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const url = `/api/supplier-search/results${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  },

  addSuppliersToCanvass: async (data: {
    purchase_request_id: string;
    supplier_ids: string[];
  }): Promise<any> => {
    const response = await api.post('/api/supplier-search/add-to-canvass', data);
    return response.data;
  },

  // ===== INSPECTION DATABASE =====
  getInspections: async (): Promise<any[]> => {
    const response = await api.get('/api/inspections');
    return response.data;
  },

  getInspection: async (po_number: string): Promise<any> => {
    const response = await api.get(`/api/inspections/${po_number}`);
    return response.data;
  },

  checkInspectionStatus: async (po_number: string): Promise<{exists: boolean; status?: string; confirmed_at?: string}> => {
    const response = await api.get(`/api/inspections/check/${po_number}`);
    return response.data;
  },

  // ===== INSPECTION REPORTS =====
  createInspectionReport: async (data: {
    po_number: string;
    inspection_date: string;
    inspected_by: string;
    items: Array<{
      item_description: string;
      quantity_ordered: number;
      quantity_received: number;
      unit: string;
      unit_price: number;
      condition: string;
      remarks: string;
    }>;
    overall_remarks: string;
    status: string;
  }): Promise<any> => {
    const response = await api.post('/api/inspection-reports', data);
    return response.data;
  },

  getInspectionReports: async (): Promise<any[]> => {
    const response = await api.get('/api/inspection-reports');
    return response.data;
  },

  createInspected: async (data: {
    po_number: string;
    inspection_date: string;
    inspected_by: string;
    items: Array<{
      item_description: string;
      quantity_ordered: number;
      quantity_received: number;
      unit: string;
      unit_price: number;
      condition: string;
      remarks: string;
    }>;
    overall_remarks: string;
    status: string;
  }): Promise<any> => {
    const response = await api.post('/api/inspected', data);
    return response.data;
  },

  getInspected: async (): Promise<any[]> => {
    const response = await api.get('/api/inspected');
    return response.data;
  },

  // ===== CUSTODIAN SLIPS =====
  createCustodianSlip: async (data: {
    slip_number: string;
    date: string;
    received_from: string;
    received_by: string;
    items: Array<{
      item_description: string;
      property_number?: string;
      quantity: number;
      unit: string;
      unit_value: number;
      total_value: number;
      condition: string;
      remarks: string;
    }>;
    remarks: string;
    status: string;
    inspection_report_id?: string;
  }): Promise<any> => {
    const response = await api.post('/api/custodian-slips', data);
    return response.data;
  },

  getCustodianSlips: async (): Promise<any[]> => {
    const response = await api.get('/api/custodian-slips');
    return response.data;
  },

  // ===== INVENTORY TRANSFER REPORTS =====
  createInventoryTransferReport: async (data: any): Promise<any> => {
    const response = await api.post('/api/inventory-transfer-reports', data);
    return response.data;
  },

  getInventoryTransferReports: async (): Promise<any[]> => {
    const response = await api.get('/api/inventory-transfer-reports');
    return response.data;
  },

  getInventoryTransferReport: async (id: string): Promise<any> => {
    const response = await api.get(`/api/inventory-transfer-reports/${id}`);
    return response.data;
  },

  // ===== PROPERTY TRANSFER REPORTS =====
  createPropertyTransferReport: async (data: any): Promise<any> => {
    const response = await api.post('/api/property-transfer-reports', data);
    return response.data;
  },

  getPropertyTransferReports: async (): Promise<any[]> => {
    const response = await api.get('/api/property-transfer-reports');
    return response.data;
  },

  getPropertyTransferReport: async (id: string): Promise<any> => {
    const response = await api.get(`/api/property-transfer-reports/${id}`);
    return response.data;
  },

  // ===== PROPERTY RETURN SLIPS =====
  createPropertyReturnSlip: async (data: any): Promise<any> => {
    const response = await api.post('/api/property-return-slips', data);
    return response.data;
  },

  getPropertyReturnSlips: async (): Promise<any[]> => {
    const response = await api.get('/api/property-return-slips');
    return response.data;
  },

  getPropertyReturnSlip: async (id: string): Promise<any> => {
    const response = await api.get(`/api/property-return-slips/${id}`);
    return response.data;
  },

  // ===== WASTE MATERIALS REPORTS =====
  createWasteMaterialsReport: async (data: any): Promise<any> => {
    const response = await api.post('/api/waste-materials-reports', data);
    return response.data;
  },

  getWasteMaterialsReports: async (): Promise<any[]> => {
    const response = await api.get('/api/waste-materials-reports');
    return response.data;
  },

  getWasteMaterialsReport: async (id: string): Promise<any> => {
    const response = await api.get(`/api/waste-materials-reports/${id}`);
    return response.data;
  },

  // ===== BLOCKCHAIN INSPECTIONS =====
  getBlockchainInspections: async (): Promise<any[]> => {
    const response = await api.get('/api/blockchain/inspections');
    return response.data;
  },

  getBlockchainInspection: async (inspectionId: string): Promise<any> => {
    const response = await api.get(`/api/blockchain/inspections/${inspectionId}`);
    return response.data;
  },

  getBlockchainInspectionsByPO: async (poNumber: string): Promise<any[]> => {
    const response = await api.get(`/api/blockchain/inspections/po/${poNumber}`);
    return response.data;
  },

  verifyBlockchainInspection: async (inspectionId: string): Promise<any> => {
    const response = await api.get(`/api/blockchain/inspections/${inspectionId}/verify`);
    return response.data;
  },

};

export default api;
