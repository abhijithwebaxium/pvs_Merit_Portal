# Database Setup Guide for PVS Merit Portal

This guide will help you set up the database when cloning this application to a new system.

## Prerequisites

### Required Software
1. **SQL Server** (SQL Server 2019 or later recommended)
   - SQL Server Management Studio (SSMS) should be installed
   - SQL Server should be running

2. **Node.js** (v18 or later)
   - npm should be installed

## Database Configuration

This application uses **SQL Server** for the Merit System Database (`pvs_merit_db`).

## Setup Steps

### Step 1: Configure Environment Variables

1. Copy the `.env` file to your server directory (if not already present)
2. Update the SQL Server connection settings in `.env`:

```env
# SQL Server Configuration
SQL_SERVER_HOST=localhost          # Or your SQL Server instance (e.g., localhost\\SQLEXPRESS)
SQL_SERVER_PORT=1433              # Default SQL Server port
SQL_SERVER_DATABASE=pvs_merit_db  # Database name
SQL_SERVER_USER=pvs_user          # SQL Server user
SQL_SERVER_PASSWORD=YourPassword  # SQL Server password
SQL_SERVER_ENCRYPT=false
SQL_SERVER_TRUST_CERT=true
```

### Step 2: Create SQL Server Login (Optional)

If you want to use a specific SQL Server user (`pvs_user`), run this in SSMS:

```sql
-- Create login
CREATE LOGIN pvs_user WITH PASSWORD = 'YourSecurePassword';
GO
```

Alternatively, you can use Windows Authentication or the `sa` account for development.

### Step 3: Create Database Using SQL Script

**Option A: Using SQL Server Management Studio (SSMS)**
1. Open SSMS
2. Connect to your SQL Server instance
3. Open the file: `server/src/scripts/createMeritDatabase.sql`
4. Execute the script (F5)

**Option B: Using sqlcmd Command Line**
```bash
sqlcmd -S localhost -U sa -P YourPassword -i server/src/scripts/createMeritDatabase.sql
```

### Step 4: Initialize Database Tables and Seed HR User

Navigate to the server directory and run:

```bash
cd server
npm install
npm run merit:setup
```

This command will:
1. Create all required database tables
2. Set up the initial HR user with credentials:
   - **Email:** `hr@pvschemicals.com`
   - **Password:** `abc123xyz`

### Alternative: Run Steps Separately

If you prefer to run the steps separately:

```bash
# Step 1: Create database tables
npm run merit:init

# Step 2: Create HR user
npm run merit:seed-hr
```

## Verification

After setup, verify the installation:

1. **Check Database Creation:**
   ```sql
   USE pvs_merit_db;
   SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';
   ```

2. **Check HR User:**
   ```sql
   SELECT employeeId, fullName, email, role FROM Employees WHERE email = 'hr@pvschemicals.com';
   ```

3. **Test Application Login:**
   - Start the server: `npm run dev`
   - Login with:
     - Email: `hr@pvschemicals.com`
     - Password: `abc123xyz`

## Expected Tables

After initialization, your database should contain:
- `Employees` - Employee and user information
- `Branches` - Branch/location information
- `Notifications` - System notifications

## Troubleshooting

### Connection Issues

**Error: Login failed for user**
- Verify SQL Server is running
- Check SQL Server Authentication mode (should allow SQL Server authentication)
- Verify user credentials in `.env` file

**Error: Cannot connect to SQL Server**
- Check if SQL Server service is running
- Verify firewall settings
- For named instances (e.g., `SQLEXPRESS`), use format: `localhost\\SQLEXPRESS`

### Database Already Exists

If the database already exists and you want to recreate it:
```sql
USE master;
DROP DATABASE pvs_merit_db;
GO
```
Then run the setup steps again.

## Security Notes

1. **Change Default Password:** After initial setup, login and change the HR user password
2. **Environment Variables:** Never commit `.env` file with production credentials
3. **SQL Server Security:** Use strong passwords and proper authentication in production
4. **Encryption Key:** Generate a new `ENCRYPTION_KEY` for production using:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

## Additional Setup Scripts

### Re-seed HR User
If you need to reset the HR user password:
```bash
npm run merit:seed-hr
```

### Migrate from MongoDB (if applicable)
If you have existing data in MongoDB:
```bash
npm run sql:migrate
```

## Support

For issues or questions, please contact the development team or refer to the main README.md file.
