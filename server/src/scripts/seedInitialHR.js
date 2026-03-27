import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

const seedInitialHR = async () => {
  try {
    console.log('========================================');
    console.log('Seeding Initial HR User');
    console.log('========================================\n');

    // Parse instance name from host (e.g., "localhost\\SQLEXPRESS")
    const host = process.env.SQL_SERVER_HOST || 'localhost';
    const instanceName = host.includes('\\') ? host.split('\\')[1] : undefined;
    const serverName = host.includes('\\') ? host.split('\\')[0] : host;

    const dialectOptions = {
      options: {
        encrypt: process.env.SQL_SERVER_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_SERVER_TRUST_CERT !== 'false',
        enableArithAbort: true,
      },
      authentication: {
        type: 'default',
      },
    };

    // Only add instanceName if it exists
    if (instanceName) {
      dialectOptions.options.instanceName = instanceName;
    }

    console.log('Database Configuration:');
    console.log(`- Server: ${serverName}${instanceName ? '\\' + instanceName : ''}`);
    console.log(`- Database: ${process.env.SQL_SERVER_DATABASE}`);
    console.log(`- User: ${process.env.SQL_SERVER_USER}\n`);

    // Create Sequelize instance
    const sequelize = new Sequelize({
      dialect: 'mssql',
      host: serverName,
      port: instanceName ? undefined : (parseInt(process.env.SQL_SERVER_PORT) || 1433),
      database: process.env.SQL_SERVER_DATABASE,
      username: process.env.SQL_SERVER_USER,
      password: process.env.SQL_SERVER_PASSWORD,
      dialectOptions,
      logging: false, // Disable logging for cleaner output
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    });

    // Test connection
    console.log('Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connection successful!\n');

    // Initialize models
    console.log('Initializing models...');
    const { initModels } = await import('../models/sql/index.js');
    const models = initModels(sequelize);
    console.log('✅ Models initialized\n');

    // HR user credentials
    const hrEmail = 'hr@pvschemicals.com';
    const hrPassword = 'abc123xyz';
    const hrEmployeeId = 'HR001';

    // Check if HR user already exists
    console.log('Checking if HR user already exists...');
    const existingHR = await models.Employee.findOne({
      where: {
        email: hrEmail,
      },
    });

    if (existingHR) {
      console.log('⚠️  HR user already exists:');
      console.log(`   - Employee ID: ${existingHR.employeeId}`);
      console.log(`   - Email: ${existingHR.email}`);
      console.log(`   - Full Name: ${existingHR.fullName}`);
      console.log(`   - Role: ${existingHR.role}\n`);

      // Ask if we should update
      console.log('Updating existing HR user credentials...');
      const hashedPassword = await bcrypt.hash(hrPassword, 10);
      await existingHR.update({
        password: hashedPassword,
        role: 'hr',
        isActive: true,
      });
      console.log('✅ HR user credentials updated successfully!\n');
    } else {
      // Create new HR user
      console.log('Creating new HR user...');
      const hashedPassword = await bcrypt.hash(hrPassword, 10);

      const hrUser = await models.Employee.create({
        employeeId: hrEmployeeId,
        fullName: 'HR Administrator',
        email: hrEmail,
        password: hashedPassword,
        role: 'hr',
        position: 'HR Administrator',
        jobTitle: 'HR Administrator',
        department: 'Human Resources',
        company: 'PVS Chemicals',
        location: 'Corporate',
        hireDate: new Date(),
        isActive: true,
        isApprover: false,
      });

      console.log('✅ HR user created successfully!');
      console.log(`   - Employee ID: ${hrUser.employeeId}`);
      console.log(`   - Email: ${hrUser.email}`);
      console.log(`   - Full Name: ${hrUser.fullName}`);
      console.log(`   - Role: ${hrUser.role}\n`);
    }

    console.log('========================================');
    console.log('Login Credentials:');
    console.log('========================================');
    console.log(`Email: ${hrEmail}`);
    console.log(`Password: ${hrPassword}`);
    console.log('========================================\n');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding HR user:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
};

// Run the script
seedInitialHR();
