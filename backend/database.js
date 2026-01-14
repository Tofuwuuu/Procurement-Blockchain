import bcrypt from 'bcrypt';
import { MongoClient } from 'mongodb';

/**
 * MongoDB-backed Database adapter.
 *
 * - Connects to MongoDB on localhost:27101 by default (Compass-friendly)
 * - Preserves existing backend API expectations by keeping numeric `id` fields
 *   (implemented via an auto-increment `counters` collection).
 * - Exposes the same method names used by `backend/simple-server.js` and `backend/node.js`.
 */
class Database {
  constructor() {
    this.client = null;
    this.db = null;
    // Default to local MongoDB on standard port 27017 (Compass-friendly)
    this.uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/procurement';
    this.dbName = process.env.MONGODB_DB || undefined;
  }

  _nowIso() {
    return new Date().toISOString();
  }

  _col(name) {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.collection(name);
  }

  async init() {
    this.client = new MongoClient(this.uri);
    await this.client.connect();
    this.db = this.dbName ? this.client.db(this.dbName) : this.client.db();

    // Indexes
    await Promise.all([
      // `_id` is already unique by default; do not add { unique: true } on _id index
      this._col('counters').createIndex({ _id: 1 }),

      this._col('users').createIndex({ id: 1 }, { unique: true }),
      this._col('users').createIndex({ username: 1 }, { unique: true }),

      this._col('sessions').createIndex({ token: 1 }, { unique: true }),
      this._col('sessions').createIndex({ expires_at: 1 }),
      this._col('sessions').createIndex({ user_id: 1 }),

      this._col('roles').createIndex({ id: 1 }, { unique: true }),
      this._col('roles').createIndex({ name: 1 }, { unique: true }),

      this._col('suppliers').createIndex({ id: 1 }, { unique: true }),
      this._col('orders').createIndex({ id: 1 }, { unique: true }),
      this._col('products').createIndex({ id: 1 }, { unique: true }),
      this._col('inventory').createIndex({ id: 1 }, { unique: true }),

      this._col('audit_logs').createIndex({ id: 1 }, { unique: true }),
      this._col('audit_logs').createIndex({ created_at: -1 }),
      this._col('audit_logs').createIndex({ action: 1 }),
      this._col('audit_logs').createIndex({ table_name: 1 }),
      this._col('audit_logs').createIndex({ user_id: 1 }),
    ]);

    await this.seedDefaultData();
    return true;
  }

  async close() {
    try {
      if (this.client) await this.client.close();
      this.client = null;
      this.db = null;
      return true;
    } catch (error) {
      console.error('Database close error:', error);
      return false;
    }
  }

  // ---------- ID helper (auto-increment) ----------
  async _nextId(sequenceName) {
    const res = await this._col('counters').findOneAndUpdate(
      { _id: sequenceName },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    // When upserting, MongoDB 6 driver can return { lastErrorObject, value } where value may be null
    if (res.value && typeof res.value.seq === 'number') {
      return res.value.seq;
    }
    // Fallback: initialize document manually and return 1
    await this._col('counters').updateOne(
      { _id: sequenceName },
      { $setOnInsert: { seq: 1 } },
      { upsert: true }
    );
    return 1;
  }

  // ---------- Seeding ----------
  async seedDefaultData() {
    // Roles
    const defaultRoles = [
      { name: 'admin', description: 'System administrator', permissions: ['*'] },
      { name: 'procurement', description: 'Procurement staff', permissions: ['orders:*', 'suppliers:*', 'inventory:*', 'reports:read'] },
      { name: 'auditor', description: 'Read-only auditor', permissions: ['audit:read', 'blockchain:read', 'reports:read'] },
      { name: 'finance', description: 'Finance department', permissions: ['payments:*', 'reports:read'] },
      { name: 'supplier', description: 'Supplier portal account', permissions: ['supplier:read', 'orders:read'] },
    ];

    for (const role of defaultRoles) {
      const exists = await this._col('roles').findOne({ name: role.name });
      if (exists) continue;

      try {
        await this._col('roles').insertOne({
          id: await this._nextId('roles'),
          ...role,
          created_at: this._nowIso(),
          updated_at: this._nowIso(),
        });
      } catch (error) {
        // If a concurrent/previous seed already created a role with this id, skip gracefully
        if (error && error.code === 11000) {
          console.warn('Role seeding skipped due to duplicate key for role:', role.name);
        } else {
          throw error;
        }
      }
    }

    // System settings (single doc)
    const settings = await this._col('system_settings').findOne({ id: 1 });
    if (!settings) {
      await this._col('system_settings').insertOne({
        id: 1,
        company_name: 'Philippine Procurement Solutions',
        company_address: '123 Ayala Avenue, Makati City, Philippines',
        company_phone: '+63 2 1234 5678',
        company_email: 'procurement@example.com',
        bir_tin: '123-456-789-000',
        system_language: 'en',
        timezone: 'Asia/Manila',
        currency: 'PHP',
        date_format: 'MM/DD/YYYY',
        notifications_enabled: true,
        email_notifications: true,
        audit_logging: true,
        maintenance_mode: false,
        updated_at: this._nowIso(),
        updated_by: null,
      });
    }

    // Default admin user (admin/admin)
    const admin = await this._col('users').findOne({ username: 'admin' });
    if (!admin) {
      const password_hash = await bcrypt.hash('admin', 10);
      const id = await this._nextId('users');
      await this._col('users').insertOne({
        id,
        username: 'admin',
        password_hash,
        full_name: 'System Administrator',
        position: 'Administrator',
        department: 'IT',
        role: 'admin',
        is_admin: true,
        created_at: this._nowIso(),
        updated_at: this._nowIso(),
      });
      await this._col('user_preferences').insertOne({
        id: await this._nextId('user_preferences'),
        user_id: id,
        language: 'en',
        theme: 'light',
        email_notifications: true,
        order_updates: true,
        system_alerts: true,
        dashboard_layout: 'default',
        updated_at: this._nowIso(),
      });
    }
  }

  // ---------- Auth / Sessions ----------
  _publicUser(user) {
    return {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      position: user.position,
      department: user.department,
      role: user.role,
      is_admin: Boolean(user.is_admin),
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  async authenticateUser(username, password) {
    const user = await this._col('users').findOne({ username });
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return null;
    return this._publicUser(user);
  }

  async createSession(userId, token, expiresAt) {
    await this._col('sessions').insertOne({
      id: await this._nextId('sessions'),
      user_id: Number(userId),
      token,
      expires_at: expiresAt,
      created_at: this._nowIso(),
    });
    return true;
  }

  async deleteSession(token) {
    await this._col('sessions').deleteOne({ token });
    return true;
  }

  async getSession(token) {
    const session = await this._col('sessions').findOne({ token }, { projection: { _id: 0 } });
    if (!session) return null;
    if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
      await this._col('sessions').deleteOne({ token });
      return null;
    }
    return session;
  }

  async validateSession(token) {
    const session = await this.getSession(token);
    if (!session) return null;
    return await this.getUserById(session.user_id);
  }

  // ---------- Users ----------
  async getUserById(id) {
    const user = await this._col('users').findOne({ id: Number(id) });
    return user ? this._publicUser(user) : null;
  }

  async getAllUsers() {
    const users = await this._col('users')
      .find({}, { projection: { password_hash: 0, _id: 0 } })
      .sort({ id: 1 })
      .toArray();
    return users.map((u) => this._publicUser(u));
  }

  async checkUsernameExists(username) {
    const user = await this._col('users').findOne({ username }, { projection: { _id: 1 } });
    return Boolean(user);
  }

  async createUser(userData) {
    const id = await this._nextId('users');
    const password_hash = userData.password ? await bcrypt.hash(userData.password, 10) : await bcrypt.hash('changeme', 10);
    await this._col('users').insertOne({
      id,
      username: userData.username,
      password_hash,
      full_name: userData.full_name,
      position: userData.position,
      department: userData.department,
      role: userData.role || 'procurement',
      is_admin: Boolean(userData.is_admin),
      created_at: this._nowIso(),
      updated_at: this._nowIso(),
    });
    await this._col('user_preferences').insertOne({
      id: await this._nextId('user_preferences'),
      user_id: id,
      language: 'en',
      theme: 'light',
      email_notifications: true,
      order_updates: true,
      system_alerts: true,
      dashboard_layout: 'default',
      updated_at: this._nowIso(),
    });
    return id;
  }

  async updateUser(id, updates) {
    const res = await this._col('users').updateOne(
      { id: Number(id) },
      { $set: { ...updates, updated_at: this._nowIso() } }
    );
    return res.matchedCount > 0;
  }

  async updateUserPassword(id, password) {
    const password_hash = await bcrypt.hash(password, 10);
    const res = await this._col('users').updateOne(
      { id: Number(id) },
      { $set: { password_hash, updated_at: this._nowIso() } }
    );
    return res.matchedCount > 0;
  }

  async deleteUser(id) {
    const numId = Number(id);
    const res = await this._col('users').deleteOne({ id: numId });
    await this._col('user_preferences').deleteMany({ user_id: numId });
    await this._col('sessions').deleteMany({ user_id: numId });
    return res.deletedCount > 0;
  }

  // ---------- Settings ----------
  async getSystemSettings() {
    return await this._col('system_settings').findOne({ id: 1 }, { projection: { _id: 0 } });
  }

  async updateSystemSettings(updates, updatedBy) {
    const res = await this._col('system_settings').updateOne(
      { id: 1 },
      { $set: { ...updates, updated_at: this._nowIso(), updated_by: Number(updatedBy) } },
      { upsert: true }
    );
    return res.matchedCount > 0 || res.upsertedCount > 0;
  }

  async getUserPreferences(userId) {
    const numId = Number(userId);
    const prefs = await this._col('user_preferences').findOne({ user_id: numId }, { projection: { _id: 0 } });
    if (prefs) return prefs;
    const doc = {
      id: await this._nextId('user_preferences'),
      user_id: numId,
      language: 'en',
      theme: 'light',
      email_notifications: true,
      order_updates: true,
      system_alerts: true,
      dashboard_layout: 'default',
      updated_at: this._nowIso(),
    };
    await this._col('user_preferences').insertOne(doc);
    return doc;
  }

  async updateUserPreferences(userId, updates) {
    const numId = Number(userId);
    const res = await this._col('user_preferences').updateOne(
      { user_id: numId },
      { $set: { ...updates, updated_at: this._nowIso() } },
      { upsert: true }
    );
    return res.matchedCount > 0 || res.upsertedCount > 0;
  }

  // ---------- Roles ----------
  async getRoles() {
    return await this._col('roles').find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray();
  }

  async getRoleById(id) {
    return await this._col('roles').findOne({ id: Number(id) }, { projection: { _id: 0 } });
  }

  async createRole({ name, description, permissions }) {
    const doc = {
      id: await this._nextId('roles'),
      name,
      description: description || '',
      permissions: Array.isArray(permissions) ? permissions : [],
      created_at: this._nowIso(),
      updated_at: this._nowIso(),
    };
    await this._col('roles').insertOne(doc);
    return doc;
  }

  async updateRole(id, updates) {
    const res = await this._col('roles').updateOne(
      { id: Number(id) },
      { $set: { ...updates, updated_at: this._nowIso() } }
    );
    return res.matchedCount > 0;
  }

  async deleteRole(id) {
    const res = await this._col('roles').deleteOne({ id: Number(id) });
    return res.deletedCount > 0;
  }

  async getPermissions() {
    const roles = await this.getRoles();
    const set = new Set();
    for (const r of roles) {
      if (Array.isArray(r.permissions)) r.permissions.forEach((p) => set.add(p));
    }
    return Array.from(set).sort();
  }

  // ---------- Suppliers ----------
  async getAllSuppliers() {
    return await this._col('suppliers').find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray();
  }

  async getSupplierById(id) {
    return await this._col('suppliers').findOne({ id: Number(id) }, { projection: { _id: 0 } });
  }

  async createSupplier(data) {
    const doc = {
      id: await this._nextId('suppliers'),
      name: data.name,
      address: data.address,
      province: data.province,
      contact_person: data.contact_person,
      phone: data.phone,
      email: data.email || '',
      bir_tin: data.bir_tin,
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
      created_at: this._nowIso(),
      updated_at: this._nowIso(),
    };
    await this._col('suppliers').insertOne(doc);
    return doc;
  }

  async updateSupplier(id, updates) {
    await this._col('suppliers').updateOne(
      { id: Number(id) },
      { $set: { ...updates, updated_at: this._nowIso() } }
    );
    return await this.getSupplierById(id);
  }

  async deleteSupplier(id) {
    await this._col('suppliers').deleteOne({ id: Number(id) });
    return true;
  }

  // ---------- Orders ----------
  async getAllOrders() {
    return await this._col('orders').find({}, { projection: { _id: 0 } }).sort({ id: -1 }).toArray();
  }

  async getOrderById(id) {
    return await this._col('orders').findOne({ id: Number(id) }, { projection: { _id: 0 } });
  }

  async createOrder(data) {
    const id = await this._nextId('orders');
    const doc = {
      id,
      po_number: data.po_number || `PO-${new Date().getFullYear()}-${String(id).padStart(4, '0')}`,
      supplier_id: Number(data.supplier_id),
      supplier: data.supplier || null,
      delivery_address: data.delivery_address || '',
      notes: data.notes || '',
      status: data.status || 'Draft',
      total_amount: Number(data.total_amount || 0),
      date_created: this._nowIso(),
      date_updated: this._nowIso(),
      items: Array.isArray(data.items) ? data.items : [],
    };
    await this._col('orders').insertOne(doc);
    return doc;
  }

  async updateOrder(id, updates) {
    await this._col('orders').updateOne(
      { id: Number(id) },
      { $set: { ...updates, date_updated: this._nowIso() } }
    );
    return await this.getOrderById(id);
  }

  async deleteOrder(id) {
    await this._col('orders').deleteOne({ id: Number(id) });
    return true;
  }

  // ---------- Inventory ----------
  async getAllInventory() {
    return await this._col('inventory').find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray();
  }

  async createInventory(data) {
    const qty = Number(data.quantity || 0);
    const unitPrice = Number(data.unit_price || 0);
    const doc = {
      id: await this._nextId('inventory'),
      product_id: Number(data.product_id),
      product: data.product || null,
      quantity: qty,
      unit_price: unitPrice,
      total_value: Number(data.total_value ?? qty * unitPrice),
      last_updated: this._nowIso(),
    };
    await this._col('inventory').insertOne(doc);
    return doc;
  }

  async updateInventory(id, updates) {
    const existing = await this._col('inventory').findOne({ id: Number(id) }, { projection: { _id: 0 } });
    if (!existing) throw new Error('Inventory item not found');
    const next = { ...existing, ...updates };
    const qty = Number(next.quantity || 0);
    const unitPrice = Number(next.unit_price || 0);
    next.total_value = Number(next.total_value ?? qty * unitPrice);
    next.last_updated = this._nowIso();
    await this._col('inventory').updateOne({ id: Number(id) }, { $set: next });
    return await this._col('inventory').findOne({ id: Number(id) }, { projection: { _id: 0 } });
  }

  async adjustInventory(id, adjustment, reason) {
    const inv = await this._col('inventory').findOne({ id: Number(id) }, { projection: { _id: 0 } });
    if (!inv) throw new Error('Inventory item not found');
    const nextQty = Number(inv.quantity || 0) + Number(adjustment || 0);
    const unitPrice = Number(inv.unit_price || 0);
    await this._col('inventory').updateOne(
      { id: Number(id) },
      { $set: { quantity: nextQty, total_value: nextQty * unitPrice, last_updated: this._nowIso() } }
    );
    await this._col('inventory_adjustments').insertOne({
      id: await this._nextId('inventory_adjustments'),
      inventory_id: Number(id),
      product_id: inv.product_id,
      adjustment: Number(adjustment || 0),
      reason: reason || '',
      adjusted_by: 'system',
      date_adjusted: this._nowIso(),
    });
    return await this._col('inventory').findOne({ id: Number(id) }, { projection: { _id: 0 } });
  }

  // ---------- Products ----------
  async getAllProducts() {
    return await this._col('products').find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray();
  }

  async createProduct(data) {
    const doc = {
      id: await this._nextId('products'),
      name: data.name,
      description: data.description || '',
      unit: data.unit || 'unit',
      unit_price: Number(data.unit_price || 0),
      category: data.category || 'General',
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
      created_at: this._nowIso(),
      updated_at: this._nowIso(),
    };
    await this._col('products').insertOne(doc);
    return doc;
  }

  // ---------- Audit logs ----------
  _buildAuditQuery(filters) {
    const q = {};
    if (filters?.action) q.action = String(filters.action);
    if (filters?.table_name) q.table_name = String(filters.table_name);
    if (filters?.username) q.username = String(filters.username);
    if (filters?.date_from || filters?.date_to) {
      q.created_at = {};
      if (filters.date_from) q.created_at.$gte = String(filters.date_from);
      if (filters.date_to) q.created_at.$lte = String(filters.date_to);
    }
    return q;
  }

  async getAuditLogs(filters, limit = 20, offset = 0) {
    const q = this._buildAuditQuery(filters);
    return await this._col('audit_logs')
      .find(q, { projection: { _id: 0 } })
      .sort({ created_at: -1, id: -1 })
      .skip(Number(offset || 0))
      .limit(Number(limit || 20))
      .toArray();
  }

  async getAuditLogsCount(filters) {
    const q = this._buildAuditQuery(filters);
    return await this._col('audit_logs').countDocuments(q);
  }
}

export default Database;


