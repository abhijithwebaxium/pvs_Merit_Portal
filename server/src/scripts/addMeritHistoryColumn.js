import dotenv from "dotenv";
dotenv.config();

import { connectSQLDB, getSequelize } from "../config/sqlDatabase.js";

const addMeritHistoryColumn = async () => {
  try {
    console.log("Starting migration to add meritHistory column...");

    // Connect to database
    await connectSQLDB();
    const sequelize = getSequelize();

    // Check if column already exists
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Employees' AND COLUMN_NAME = 'meritHistory'
    `);

    if (results.length > 0) {
      console.log("✅ meritHistory column already exists. No action needed.");
      process.exit(0);
    }

    // Add the column
    console.log("Adding meritHistory column...");
    await sequelize.query(`
      ALTER TABLE [Employees]
      ADD [meritHistory] NVARCHAR(MAX) NULL
    `);

    console.log("✅ Successfully added meritHistory column to Employees table");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error adding meritHistory column:", error);
    process.exit(1);
  }
};

addMeritHistoryColumn();
