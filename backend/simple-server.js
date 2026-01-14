import express from 'express';
import cors from 'cors';
import Database from './database.js';
import jwt from 'jsonwebtoken';

const app = express();
const port = process.env.PORT || 3003;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize database
const database = new Database();
const jwtSecret = 'your-secret-key-change-in-production';

// Initialize database on startup
database.init().then(() => {
  console.log('✅ Database initialized');
}).catch(error => {
  console.error('❌ Database initialization failed:', error);
  console.error('❌ Exiting because database is required to run the API.');
  process.exit(1);
});

// In-memory storage for suppliers (temporary solution)
let suppliers = [
  {
    id: 1,
    name: "TechDistributors Inc",
    address: "123 Tech Street, Makati City",
    province: "Metro Manila",
    contact_person: "Juan D.",
    phone: "09171234567",
    email: "info@techdistributors.com",
    bir_tin: "123-456-789-000",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

let nextSupplierId = 2; // For generating new IDs

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Authentication endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Authenticate user with database
    const user = await database.authenticateUser(username, password);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      jwtSecret,
      { expiresIn: '24h' }
    );

    // Create session in database
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await database.createSession(user.id, token, expiresAt);
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        position: user.position,
        department: user.department,
        role: user.role,
        is_admin: user.is_admin
      },
      token,
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      await database.deleteSession(token);
    }
    
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Validate session and get user data
    const user = await database.validateSession(token);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    res.json({
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      position: user.position,
      department: user.department,
      role: user.role,
      is_admin: user.is_admin
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

// Supplier Management endpoints
app.get('/api/suppliers', async (req, res) => {
  try {
    console.log('📋 Getting suppliers, count:', suppliers.length);
    res.json(suppliers);
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ error: 'Failed to get suppliers' });
  }
});

app.post('/api/suppliers', async (req, res) => {
  try {
    const { name, address, province, contact_person, phone, email, bir_tin, is_active } = req.body;
    
    // Validate required fields
    if (!name || !address || !province || !contact_person || !phone || !bir_tin) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create new supplier and add to storage
    const newSupplier = {
      id: nextSupplierId++,
      name,
      address,
      province,
      contact_person,
      phone,
      email: email || '',
      bir_tin,
      is_active: is_active !== undefined ? is_active : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Add to suppliers array
    suppliers.push(newSupplier);
    
    console.log('✅ Supplier saved:', newSupplier);
    console.log('📊 Total suppliers:', suppliers.length);
    res.status(201).json(newSupplier);
  } catch (error) {
    console.error('Save supplier error:', error);
    res.status(500).json({ error: 'Failed to save supplier' });
  }
});

app.put('/api/suppliers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, province, contact_person, phone, email, bir_tin, is_active } = req.body;
    
    // Validate required fields
    if (!name || !address || !province || !contact_person || !phone || !bir_tin) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Find the supplier to update
    const supplierIndex = suppliers.findIndex(s => s.id === parseInt(id));
    
    if (supplierIndex === -1) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Update the supplier in storage
    const updatedSupplier = {
      ...suppliers[supplierIndex], // Keep existing fields
      name,
      address,
      province,
      contact_person,
      phone,
      email: email || '',
      bir_tin,
      is_active: is_active !== undefined ? is_active : true,
      updated_at: new Date().toISOString()
    };
    
    // Replace the supplier in the array
    suppliers[supplierIndex] = updatedSupplier;
    
    console.log('✅ Supplier updated:', updatedSupplier);
    console.log('📊 Total suppliers:', suppliers.length);
    res.json(updatedSupplier);
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

app.delete('/api/suppliers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the supplier to delete
    const supplierIndex = suppliers.findIndex(s => s.id === parseInt(id));
    
    if (supplierIndex === -1) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    // Remove the supplier from storage
    const deletedSupplier = suppliers.splice(supplierIndex, 1)[0];
    
    console.log('✅ Supplier deleted:', deletedSupplier);
    console.log('📊 Total suppliers:', suppliers.length);
    res.json({ message: 'Supplier deleted successfully', deletedSupplier });
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
});

// Role constants
const ROLE_ADMIN = 'admin';
const ROLE_PROCUREMENT = 'procurement';
const ROLE_VALIDATOR = 'validator';   // usually node identity, keep for clarity
const ROLE_SUPPLIER = 'supplier';
const ROLE_AUDITOR = 'auditor';
const ROLE_FINANCE = 'finance';
const ALLOWED_ROLES = [ROLE_ADMIN, ROLE_PROCUREMENT, ROLE_VALIDATOR, ROLE_SUPPLIER, ROLE_AUDITOR, ROLE_FINANCE];

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const user = await database.validateSession(token);
    
    if (!user || !user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Middleware to check if user is authenticated
const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const user = await database.validateSession(token);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// User Management endpoints (Admin only)
app.get('/api/users', requireAdmin, async (req, res) => {
  try {
    const users = await database.getAllUsers();
    console.log('👥 Getting users, count:', users.length);
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

app.post('/api/users', requireAdmin, async (req, res) => {
  try {
    const { username, password, full_name, position, department, role } = req.body;
    
    // Validate required fields
    if (!username || !password || !full_name || !position || !department || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate role
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if username already exists
    const usernameExists = await database.checkUsernameExists(username);
    if (usernameExists) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Create user
    const userData = {
      username,
      password,
      full_name,
      position,
      department,
      role,
      is_admin: role === ROLE_ADMIN ? 1 : 0
    };

    const userId = await database.createUser(userData);
    const newUser = await database.getUserById(userId);
    
    console.log('✅ User created:', newUser);
    res.status(201).json(newUser);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, position, department, role } = req.body;
    
    // Validate required fields
    if (!full_name || !position || !department || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate role
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if user exists
    const existingUser = await database.getUserById(id);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user
    const userData = {
      full_name,
      position,
      department,
      role,
      is_admin: role === ROLE_ADMIN ? 1 : 0
    };

    const success = await database.updateUser(id, userData);
    
    if (success) {
      const updatedUser = await database.getUserById(id);
      console.log('✅ User updated:', updatedUser);
      res.json(updatedUser);
    } else {
      res.status(500).json({ error: 'Failed to update user' });
    }
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.put('/api/users/:id/password', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Check if user exists
    const existingUser = await database.getUserById(id);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update password
    const success = await database.updateUserPassword(id, password);
    
    if (success) {
      console.log('✅ User password updated for ID:', id);
      res.json({ message: 'Password updated successfully' });
    } else {
      res.status(500).json({ error: 'Failed to update password' });
    }
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user exists
    const existingUser = await database.getUserById(id);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent admin from deleting themselves
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Delete user
    const success = await database.deleteUser(id);
    
    if (success) {
      console.log('✅ User deleted, ID:', id);
      res.json({ message: 'User deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete user' });
    }
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get available roles
app.get('/api/roles', async (req, res) => {
  try {
    res.json({
      roles: ALLOWED_ROLES,
      descriptions: {
        admin: 'Full system access and user management',
        procurement: 'Procurement staff. Create/approve POs, propose and approve items, receive goods, adjust inventory, view reports.',
        validator: 'Node-level role that participates in consensus. Usually not a normal web-login role; administered by Admin and mapped to a node identity/key.',
        supplier: 'Supplier portal account. Propose items, view their own orders/status, submit documents (submissions go to Pending Approval).',
        auditor: 'Read-only access to explorers, audit trail and reports (no write actions).',
        finance: 'Finance department: approve payments, view financial reports, download BIR exports.'
      }
    });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Failed to get roles' });
  }
});

// ===== SETTINGS ENDPOINTS =====

// Get system settings
app.get('/api/settings/system', requireAdmin, async (req, res) => {
  try {
    const settings = await database.getSystemSettings();
    if (settings) {
      res.json(settings);
    } else {
      res.status(404).json({ error: 'System settings not found' });
    }
  } catch (error) {
    console.error('Get system settings error:', error);
    res.status(500).json({ error: 'Failed to get system settings' });
  }
});

// Update system settings
app.put('/api/settings/system', requireAdmin, async (req, res) => {
  try {
    const success = await database.updateSystemSettings(req.body, req.user.id);
    if (success) {
      const updatedSettings = await database.getSystemSettings();
      res.json(updatedSettings);
    } else {
      res.status(500).json({ error: 'Failed to update system settings' });
    }
  } catch (error) {
    console.error('Update system settings error:', error);
    res.status(500).json({ error: 'Failed to update system settings' });
  }
});

// Get user preferences
app.get('/api/settings/preferences', requireAuth, async (req, res) => {
  try {
    const preferences = await database.getUserPreferences(req.user.id);
    if (preferences) {
      res.json(preferences);
    } else {
      res.status(404).json({ error: 'User preferences not found' });
    }
  } catch (error) {
    console.error('Get user preferences error:', error);
    res.status(500).json({ error: 'Failed to get user preferences' });
  }
});

// Update user preferences
app.put('/api/settings/preferences', requireAuth, async (req, res) => {
  try {
    const success = await database.updateUserPreferences(req.user.id, req.body);
    if (success) {
      const updatedPreferences = await database.getUserPreferences(req.user.id);
      res.json(updatedPreferences);
    } else {
      res.status(500).json({ error: 'Failed to update user preferences' });
    }
  } catch (error) {
    console.error('Update user preferences error:', error);
    res.status(500).json({ error: 'Failed to update user preferences' });
  }
});

// Get system information
app.get('/api/settings/system-info', requireAdmin, async (req, res) => {
  try {
    const uptime = process.uptime();
    const systemInfo = {
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: 'SQLite',
      uptime: Math.floor(uptime),
      last_backup: 'Never' // TODO: Implement backup tracking
    };
    res.json(systemInfo);
  } catch (error) {
    console.error('Get system info error:', error);
    res.status(500).json({ error: 'Failed to get system information' });
  }
});

// Export system data
app.post('/api/settings/export', requireAdmin, async (req, res) => {
  try {
    // TODO: Implement data export functionality
    res.json({ 
      download_url: '/api/settings/export/download',
      message: 'Export functionality coming soon'
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Import system data
app.post('/api/settings/import', requireAdmin, async (req, res) => {
  try {
    // TODO: Implement data import functionality
    res.json({ 
      message: 'Import functionality coming soon',
      imported_count: 0
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to import data' });
  }
});

// ===== ROLE MANAGEMENT ENDPOINTS =====

// Get all roles
app.get('/api/settings/roles', requireAdmin, async (req, res) => {
  try {
    const roles = await database.getRoles();
    res.json(roles);
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Failed to get roles' });
  }
});

// Get role by ID
app.get('/api/settings/roles/:id', requireAdmin, async (req, res) => {
  try {
    const role = await database.getRoleById(req.params.id);
    if (role) {
      res.json(role);
    } else {
      res.status(404).json({ error: 'Role not found' });
    }
  } catch (error) {
    console.error('Get role error:', error);
    res.status(500).json({ error: 'Failed to get role' });
  }
});

// Create new role
app.post('/api/settings/roles', requireAdmin, async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    
    if (!name || !description) {
      return res.status(400).json({ error: 'Name and description are required' });
    }

    const newRole = await database.createRole({ name, description, permissions: permissions || [] });
    res.status(201).json(newRole);
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// Update role
app.put('/api/settings/roles/:id', requireAdmin, async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    
    if (!name || !description) {
      return res.status(400).json({ error: 'Name and description are required' });
    }

    const success = await database.updateRole(req.params.id, { name, description, permissions: permissions || [] });
    if (success) {
      const updatedRole = await database.getRoleById(req.params.id);
      res.json(updatedRole);
    } else {
      res.status(500).json({ error: 'Failed to update role' });
    }
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Delete role
app.delete('/api/settings/roles/:id', requireAdmin, async (req, res) => {
  try {
    const success = await database.deleteRole(req.params.id);
    if (success) {
      res.json({ message: 'Role deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete role' });
    }
  } catch (error) {
    console.error('Delete role error:', error);
    if (error.message.includes('Cannot delete role')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to delete role' });
    }
  }
});

// Get all permissions
app.get('/api/settings/permissions', requireAdmin, async (req, res) => {
  try {
    const permissions = await database.getPermissions();
    res.json(permissions);
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ error: 'Failed to get permissions' });
  }
});

// Assign role to user
app.put('/api/settings/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const { role_id } = req.body;
    
    if (!role_id) {
      return res.status(400).json({ error: 'Role ID is required' });
    }

    const role = await database.getRoleById(role_id);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const success = await database.updateUser(req.params.id, { role: role.name });
    if (success) {
      res.json({ message: 'User role updated successfully' });
    } else {
      res.status(500).json({ error: 'Failed to update user role' });
    }
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Start server
const server = app.listen(port, () => {
  console.log(`🚀 Simple server running on http://localhost:${port}`);
  console.log('👤 Default admin user: admin/admin');
  console.log('🏢 Supplier endpoints added');
  console.log('👥 User management endpoints added');
  console.log('⚙️ Settings endpoints added');
  console.log('🛡️ Role management endpoints added');
});

// Add error handling
server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});
