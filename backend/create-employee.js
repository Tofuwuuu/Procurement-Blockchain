import Database from './database.js';
import bcrypt from 'bcrypt';

async function createEmployeeUser() {
  try {
    console.log('🔄 Initializing database...');
    const database = new Database();
    await database.init();
    console.log('✅ Database initialized');

    // Check if employee role exists, create if not
    const allRoles = await database.getRoles();
    const employeeRole = allRoles.find(r => r.name === 'employee');
    
    if (!employeeRole) {
      console.log('📝 Creating employee role...');
      
      // Fix counter if needed - ensure it's at least max existing ID
      const maxRoleId = allRoles.length > 0 ? Math.max(...allRoles.map(r => r.id || 0)) : 0;
      const counter = await database._col('counters').findOne({ _id: 'roles' });
      if (!counter || counter.seq <= maxRoleId) {
        await database._col('counters').updateOne(
          { _id: 'roles' },
          { $set: { seq: maxRoleId + 1 } },
          { upsert: true }
        );
        console.log(`🔧 Updated roles counter to ${maxRoleId + 1}`);
      }
      
      try {
        await database.createRole({
          name: 'employee',
          description: 'Employee - Can create purchase requests',
          permissions: ['orders:create', 'orders:read', 'suppliers:read'], // Limited to creating and viewing orders
        });
        console.log('✅ Employee role created');
      } catch (error) {
        // Handle duplicate key error - try with manual ID
        if (error.code === 11000) {
          console.log('⚠️  Duplicate key error, trying with manual ID...');
          const newId = maxRoleId + 1;
          await database._col('roles').insertOne({
            id: newId,
            name: 'employee',
            description: 'Employee - Can create purchase requests',
            permissions: ['orders:create', 'orders:read', 'suppliers:read'],
            created_at: database._nowIso(),
            updated_at: database._nowIso(),
          });
          // Update counter
          await database._col('counters').updateOne(
            { _id: 'roles' },
            { $set: { seq: newId + 1 } },
            { upsert: true }
          );
          console.log('✅ Employee role created with ID:', newId);
        } else {
          throw error;
        }
      }
    } else {
      console.log('ℹ️  Employee role already exists');
    }

    // Check if employee user exists
    const allUsers = await database.getAllUsers();
    const existingUser = allUsers.find(u => u.username === 'employee');
    
    if (existingUser) {
      console.log('⚠️  User "employee" already exists. Updating password and role...');
      const password_hash = await bcrypt.hash('employee', 10);
      // Use internal method to update password and role
      await database._col('users').updateOne(
        { username: 'employee' },
        { 
          $set: { 
            password_hash,
            role: 'employee',
            is_admin: false,
            updated_at: database._nowIso()
          } 
        }
      );
      console.log('✅ Employee user updated');
    } else {
      console.log('📝 Creating employee user...');
      
      // Fix counter if needed - ensure it's at least max existing ID
      const maxUserId = allUsers.length > 0 ? Math.max(...allUsers.map(u => u.id || 0)) : 0;
      const counter = await database._col('counters').findOne({ _id: 'users' });
      if (!counter || counter.seq <= maxUserId) {
        await database._col('counters').updateOne(
          { _id: 'users' },
          { $set: { seq: maxUserId + 1 } },
          { upsert: true }
        );
        console.log(`🔧 Updated users counter to ${maxUserId + 1}`);
      }
      
      try {
        const userId = await database.createUser({
          username: 'employee',
          password: 'employee',
          full_name: 'Employee User',
          position: 'Employee',
          department: 'General',
          role: 'employee',
          is_admin: false
        });
        console.log(`✅ Employee user created with ID: ${userId}`);
      } catch (error) {
        // Handle duplicate key error - try with manual ID
        if (error.code === 11000) {
          console.log('⚠️  Duplicate key error, trying with manual ID...');
          const newId = maxUserId + 1;
          const password_hash = await bcrypt.hash('employee', 10);
          await database._col('users').insertOne({
            id: newId,
            username: 'employee',
            password_hash,
            full_name: 'Employee User',
            position: 'Employee',
            department: 'General',
            role: 'employee',
            is_admin: false,
            created_at: database._nowIso(),
            updated_at: database._nowIso(),
          });
          // Create user preferences
          await database._col('user_preferences').insertOne({
            id: await database._nextId('user_preferences'),
            user_id: newId,
            language: 'en',
            theme: 'light',
            email_notifications: true,
            order_updates: true,
            system_alerts: true,
            dashboard_layout: 'default',
            updated_at: database._nowIso(),
          });
          // Update counter
          await database._col('counters').updateOne(
            { _id: 'users' },
            { $set: { seq: newId + 1 } },
            { upsert: true }
          );
          console.log('✅ Employee user created with ID:', newId);
        } else {
          throw error;
        }
      }
    }

    console.log('\n✅ Employee account created successfully!');
    console.log('   Username: employee');
    console.log('   Password: employee');
    console.log('   Role: employee (can create purchase requests)');
    
    await database.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating employee account:', error);
    process.exit(1);
  }
}

createEmployeeUser();

