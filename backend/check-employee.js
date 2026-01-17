import Database from './database.js';
import bcrypt from 'bcrypt';

async function checkEmployee() {
  try {
    console.log('🔄 Initializing database...');
    const database = new Database();
    await database.init();
    console.log('✅ Database initialized\n');

    // Check if employee user exists
    console.log('🔍 Checking for employee user...');
    const allUsers = await database.getAllUsers();
    const employeeUser = allUsers.find(u => u.username === 'employee');
    
    if (employeeUser) {
      console.log('✅ Employee user found:');
      console.log('   ID:', employeeUser.id);
      console.log('   Username:', employeeUser.username);
      console.log('   Full Name:', employeeUser.full_name);
      console.log('   Role:', employeeUser.role);
      console.log('   Is Admin:', employeeUser.is_admin);
      console.log('');
      
      // Check raw user data from database
      const rawUser = await database._col('users').findOne({ username: 'employee' });
      if (rawUser) {
        console.log('📋 Raw user data from database:');
        console.log('   Has password_hash:', !!rawUser.password_hash);
        console.log('   Password hash length:', rawUser.password_hash?.length || 0);
        console.log('');
      }
      
      // Test authentication
      console.log('🔐 Testing authentication...');
      const authResult = await database.authenticateUser('employee', 'employee');
      if (authResult) {
        console.log('✅ Authentication successful!');
        console.log('   Authenticated user:', authResult);
      } else {
        console.log('❌ Authentication failed!');
        console.log('   This means either:');
        console.log('   1. Password hash is incorrect');
        console.log('   2. User record is missing password_hash');
        console.log('');
        
        // Try to fix it
        console.log('🔧 Attempting to fix password...');
        const password_hash = await bcrypt.hash('employee', 10);
        await database._col('users').updateOne(
          { username: 'employee' },
          { $set: { password_hash, updated_at: database._nowIso() } }
        );
        console.log('✅ Password updated. Try logging in again.');
        
        // Test again
        const authResult2 = await database.authenticateUser('employee', 'employee');
        if (authResult2) {
          console.log('✅ Authentication now works!');
        } else {
          console.log('❌ Still failing. Check database manually.');
        }
      }
    } else {
      console.log('❌ Employee user NOT found in database!');
      console.log('');
      console.log('📋 All users in database:');
      allUsers.forEach(u => {
        console.log(`   - ${u.username} (ID: ${u.id}, Role: ${u.role})`);
      });
      console.log('');
      console.log('💡 Run create-employee.js to create the user.');
    }
    
    await database.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkEmployee();

