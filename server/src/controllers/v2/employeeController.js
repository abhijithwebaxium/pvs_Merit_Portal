import { getEmployee as getEmployeeModel } from "../../models/sql/Employee.js";
import AppError from "../../utils/appError.js";
import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import {
  sendBonusRejectionEmail,
  sendMeritResubmittedEmail,
  sendMeritModifiedEmail,
  sendFinalApprovalEmail,
  sendNewMeritRecordEmail
} from "../../utils/emailService.js";
import { createNotification, markNotificationRead } from "./notificationController.js";
import { getNotification } from "../../models/sql/Notification.js";

// Helper function to determine the next required approval level
const getNextApprovalLevel = (employee) => {
  // Only process if submitted for approval
  if (!employee.approvalStatus?.submittedForApproval) {
    return null;
  }

  // Check levels in order
  for (let level = 1; level <= 5; level++) {
    const levelKey = `level${level}`;
    const approverIdField = `${levelKey}ApproverId`;

    // If this level has an approver
    if (employee[approverIdField]) {
      const status = employee.approvalStatus?.[levelKey]?.status;

      // If pending, this is the next level
      if (status === "pending") {
        return { level, approverId: employee[approverIdField] };
      }

      // If status exists and is not approved, approval is blocked at this level
      if (status && status !== "approved") {
        return null;
      }
    }
  }
  return null; // All levels approved or no more levels
};

// @desc    Get all employees
// @route   GET /api/v2/employees
// @access  Private
export const getEmployees = async (req, res, next) => {
  try {
    const Employee = getEmployeeModel();
    const { isActive, branch, role } = req.query;
    const where = {};

    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }
    if (branch) {
      where.branch = branch;
    }
    if (role) {
      where.role = role;
    }

    const employees = await Employee.findAll({
      where,
      attributes: { exclude: ["password"] },
      order: [["employeeId", "ASC"]],
    });

    res.status(200).json({
      success: true,
      count: employees.length,
      data: employees,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single employee
// @route   GET /api/v2/employees/:id
// @access  Private
export const getEmployee = async (req, res, next) => {
  try {
    const Employee = getEmployeeModel();
    const employee = await Employee.findByPk(req.params.id, {
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Employee,
          as: "supervisor",
          attributes: ["id", "fullName", "employeeId"],
        },
        {
          model: Employee,
          as: "level1Approver",
          attributes: ["id", "fullName", "employeeId"],
        },
        {
          model: Employee,
          as: "level2Approver",
          attributes: ["id", "fullName", "employeeId"],
        },
        {
          model: Employee,
          as: "level3Approver",
          attributes: ["id", "fullName", "employeeId"],
        },
        {
          model: Employee,
          as: "level4Approver",
          attributes: ["id", "fullName", "employeeId"],
        },
        {
          model: Employee,
          as: "level5Approver",
          attributes: ["id", "fullName", "employeeId"],
        },
      ],
    });

    if (!employee) {
      return next(new AppError("Employee not found", 404));
    }

    res.status(200).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new employee
// @route   POST /api/v2/employees
// @access  Private (Admin/HR only)
export const createEmployee = async (req, res, next) => {
  try {
    const Employee = getEmployeeModel();
    // Hash password before saving
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      req.body.password = await bcrypt.hash(req.body.password, salt);
    }

    // Flatten address object if it exists
    if (req.body.address) {
      req.body.addressStreet = req.body.address.street;
      req.body.addressCity = req.body.address.city;
      req.body.addressState = req.body.address.state;
      req.body.addressZipCode = req.body.address.zipCode;
      req.body.addressCountry = req.body.address.country || "USA";
      delete req.body.address;
    }

    const employee = await Employee.create(req.body);

    // Remove password from response
    const employeeData = employee.toJSON();
    delete employeeData.password;

    res.status(201).json({
      success: true,
      message: "Employee created successfully",
      data: employeeData,
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      const field = Object.keys(error.fields)[0];
      return next(new AppError(`${field} already exists`, 400));
    }
    next(error);
  }
};

// @desc    Update employee
// @route   PUT /api/v2/employees/:id
// @access  Private (Admin/HR only)
export const updateEmployee = async (req, res, next) => {
  try {
    const Employee = getEmployeeModel();
    // Don't allow password update through this route
    if (req.body.password) {
      delete req.body.password;
    }

    // Flatten address object if it exists
    if (req.body.address) {
      req.body.addressStreet = req.body.address.street;
      req.body.addressCity = req.body.address.city;
      req.body.addressState = req.body.address.state;
      req.body.addressZipCode = req.body.address.zipCode;
      req.body.addressCountry = req.body.address.country || "USA";
      delete req.body.address;
    }

    // Fetch the employee instance first
    const employee = await Employee.findByPk(req.params.id);

    if (!employee) {
      return next(new AppError("Employee not found", 404));
    }

    console.log('🔧 [UPDATE-EMPLOYEE DEBUG] Employee:', employee.employeeId, employee.fullName);
    console.log('🔧 [UPDATE-EMPLOYEE DEBUG] Request body:', JSON.stringify(req.body, null, 2));
    console.log('🔧 [UPDATE-EMPLOYEE DEBUG] Merit history BEFORE update:', JSON.stringify(employee.meritHistory, null, 2));

    // Check if merit is being changed by HR (only if merit fields are in request)
    const isMeritChanged =
      (req.body.meritIncreasePercentage !== undefined && req.body.meritIncreasePercentage !== employee.meritIncreasePercentage) ||
      (req.body.meritIncreaseDollar !== undefined && req.body.meritIncreaseDollar !== employee.meritIncreaseDollar);

    console.log('🔧 [UPDATE-EMPLOYEE DEBUG] Is merit changed?', isMeritChanged);

    // Store old merit values before updating
    const oldMeritPercentage = employee.meritIncreasePercentage;
    const oldMeritDollar = employee.meritIncreaseDollar;

    // Check if the merit value is the same as the current value (prevent modifying with same value)
    if (isMeritChanged && employee.approvalStatus?.enteredBy) {
      if (employee.salaryType === "Hourly") {
        const newMeritDollar = req.body.meritIncreaseDollar;
        if (oldMeritDollar !== null && oldMeritDollar !== undefined && parseFloat(oldMeritDollar) === parseFloat(newMeritDollar)) {
          return next(
            new AppError(
              `Merit value is already $${parseFloat(newMeritDollar).toFixed(2)}/hr. Please enter a different value to modify.`,
              400
            )
          );
        }
      } else {
        const newMeritPercentage = req.body.meritIncreasePercentage;
        if (oldMeritPercentage !== null && oldMeritPercentage !== undefined && parseFloat(oldMeritPercentage) === parseFloat(newMeritPercentage)) {
          return next(
            new AppError(
              `Merit value is already ${parseFloat(newMeritPercentage).toFixed(2)}%. Please enter a different value to modify.`,
              400
            )
          );
        }
      }
    }

    // Update employee instance fields
    Object.keys(req.body).forEach(key => {
      employee[key] = req.body[key];
    });

    // If merit was changed, add entry to merit history
    if (isMeritChanged && req.user) {
      console.log('🔧 [UPDATE-EMPLOYEE DEBUG] Adding merit history entry for HR modification');

      const history = employee.meritHistory || [];

      // Get the logged-in user details (assuming req.user contains the authenticated user)
      const actorName = req.user.fullName || req.user.name || "HR Admin";
      const actorEmployeeId = req.user.employeeId || req.user.id || "N/A";

      history.push({
        timestamp: new Date(),
        action: "modified_by_hr", // New action type specifically for HR modifications
        level: 0, // HR level
        actor: {
          id: req.user.id,
          name: actorName,
          employeeId: actorEmployeeId,
        },
        oldValue: employee.salaryType === "Hourly" ? oldMeritDollar : oldMeritPercentage,
        newValue: employee.salaryType === "Hourly" ? employee.meritIncreaseDollar : employee.meritIncreasePercentage,
        salaryType: employee.salaryType,
        comments: "Merit modified by HR",
      });

      employee.meritHistory = history;
      console.log('🔧 [UPDATE-EMPLOYEE DEBUG] Merit history AFTER adding entry:', JSON.stringify(employee.meritHistory, null, 2));
    }

    // Save using instance method to trigger setters (especially for meritHistory)
    console.log('🔧 [UPDATE-EMPLOYEE DEBUG] About to save employee...');
    await employee.save();
    console.log('✅ [UPDATE-EMPLOYEE DEBUG] Employee saved successfully!');

    // Fetch updated employee data
    const updatedEmployee = await Employee.findByPk(req.params.id, {
      attributes: { exclude: ["password"] },
    });

    res.status(200).json({
      success: true,
      message: "Employee updated successfully",
      data: updatedEmployee,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete employee
// @route   DELETE /api/v2/employees/:id
// @access  Private (Admin only)
export const deleteEmployee = async (req, res, next) => {
  try {
    const Employee = getEmployeeModel();
    const deleted = await Employee.destroy({
      where: { id: req.params.id },
    });

    if (!deleted) {
      return next(new AppError("Employee not found", 404));
    }

    res.status(200).json({
      success: true,
      message: "Employee deleted successfully",
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle employee active status
// @route   PATCH /api/v2/employees/:id/toggle-status
// @access  Private (Admin/HR only)
export const toggleEmployeeStatus = async (req, res, next) => {
  try {
    const Employee = getEmployeeModel();
    const employee = await Employee.findByPk(req.params.id);

    if (!employee) {
      return next(new AppError("Employee not found", 404));
    }

    employee.isActive = !employee.isActive;
    await employee.save();

    const employeeData = employee.toJSON();
    delete employeeData.password;

    res.status(200).json({
      success: true,
      message: `Employee ${employee.isActive ? "activated" : "deactivated"} successfully`,
      data: employeeData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get employees for approver (by approval level)
// @route   GET /api/v2/employees/approvals/my-approvals
// @access  Private (Approver only) OR Public with approverId
export const getMyApprovals = async (req, res, next) => {
  try {
    const Employee = getEmployeeModel();
    const approverId = req.user?.userId || req.user?.id || req.query.approverId;

    if (!approverId || approverId === "undefined" || approverId === "null") {
      return next(new AppError("Approver ID is required", 400));
    }

    // Find all active employees where this user is an approver at any level
    const allEmployees = await Employee.findAll({
      where: {
        isActive: true,
        [Op.or]: [
          { level1ApproverId: approverId },
          { level2ApproverId: approverId },
          { level3ApproverId: approverId },
          { level4ApproverId: approverId },
          { level5ApproverId: approverId },
        ],
        id: { [Op.ne]: approverId },
      },
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Employee,
          as: "level1Approver",
          attributes: ["id", "fullName", "employeeId"],
        },
        {
          model: Employee,
          as: "level2Approver",
          attributes: ["id", "fullName", "employeeId"],
        },
        {
          model: Employee,
          as: "level3Approver",
          attributes: ["id", "fullName", "employeeId"],
        },
        {
          model: Employee,
          as: "level4Approver",
          attributes: ["id", "fullName", "employeeId"],
        },
        {
          model: Employee,
          as: "level5Approver",
          attributes: ["id", "fullName", "employeeId"],
        },
      ],
      order: [["employeeId", "ASC"]],
    });

    // Show ALL employees, regardless of submission status
    // Frontend will handle locked/open states based on submittedForApproval flag
    const groupedData = {
      level1: allEmployees.filter(emp => emp.level1ApproverId?.toString() === approverId.toString()),
      level2: allEmployees.filter(emp => emp.level2ApproverId?.toString() === approverId.toString()),
      level3: allEmployees.filter(emp => emp.level3ApproverId?.toString() === approverId.toString()),
      level4: allEmployees.filter(emp => emp.level4ApproverId?.toString() === approverId.toString()),
      level5: allEmployees.filter(emp => emp.level5ApproverId?.toString() === approverId.toString()),
    };

    res.status(200).json({
      success: true,
      data: groupedData,
      counts: {
        level1: groupedData.level1.length,
        level2: groupedData.level2.length,
        level3: groupedData.level3.length,
        level4: groupedData.level4.length,
        level5: groupedData.level5.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get employees under a supervisor
// @route   GET /api/v2/employees/supervisor/my-team
// @access  Private (Supervisor only) OR Public with supervisorId
export const getMySupervisedEmployees = async (req, res, next) => {
  try {
    const Employee = getEmployeeModel();
    const supervisorId =
      req.user?.userId || req.user?.id || req.query.supervisorId;

    if (
      !supervisorId ||
      supervisorId === "undefined" ||
      supervisorId === "null"
    ) {
      return next(new AppError("Supervisor ID is required", 400));
    }

    const employees = await Employee.findAll({
      where: {
        supervisorId: supervisorId,
        isActive: true,
        id: { [Op.ne]: supervisorId },
      },
      attributes: { exclude: ["password"] },
      order: [["employeeId", "ASC"]],
    });

    res.status(200).json({
      success: true,
      count: employees.length,
      data: employees,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update employee merit
// @route   PUT /api/v2/employees/:id/merit
// @access  Private (Supervisor only)
export const updateEmployeeMerit = async (req, res, next) => {
  try {
    const Employee = getEmployeeModel();
    const { id } = req.params;
    const { meritIncreasePercentage, meritIncreaseDollar, remarks } = req.body || {};
    const supervisorId =
      req.user?.userId ||
      req.user?.id ||
      req.body?.supervisorId ||
      req.query?.supervisorId;

    if (
      !supervisorId ||
      supervisorId === "undefined" ||
      supervisorId === "null"
    ) {
      return next(new AppError("Supervisor ID is required", 400));
    }

    // Validate that at least one merit value is provided
    if (
      (meritIncreasePercentage === undefined || meritIncreasePercentage === null) &&
      (meritIncreaseDollar === undefined || meritIncreaseDollar === null)
    ) {
      return next(
        new AppError(
          "Merit increase (percentage or dollar amount) is required",
          400
        )
      );
    }

    // Validate non-negative values
    if (
      (meritIncreasePercentage !== undefined &&
        meritIncreasePercentage !== null &&
        meritIncreasePercentage < 0) ||
      (meritIncreaseDollar !== undefined &&
        meritIncreaseDollar !== null &&
        meritIncreaseDollar < 0)
    ) {
      return next(new AppError("Merit increase cannot be negative", 400));
    }

    const employee = await Employee.findByPk(id);

    if (!employee) {
      return next(new AppError("Employee not found", 404));
    }

    if (
      !employee.supervisorId ||
      employee.supervisorId.toString() !== supervisorId.toString()
    ) {
      return next(
        new AppError(
          "You are not authorized to set merit for this employee",
          403
        )
      );
    }

    // Check if already submitted
    const approvalStatus = employee.approvalStatus || {};

    // Check if any level has been rejected — if so, allow re-editing after reset
    const hasRejection = [1, 2, 3, 4, 5].some(
      (lvl) => approvalStatus[`level${lvl}`]?.status === "rejected"
    );

    if (approvalStatus.submittedForApproval && !hasRejection) {
      return next(
        new AppError(
          "Merit has already been submitted for approval and cannot be edited",
          403
        )
      );
    }

    // Calculate new salary based on merit type
    let newAnnualSalary = 0;
    let newHourlyRate = 0;
    let finalMeritPercentage = 0;
    let finalMeritDollar = 0;

    // Determine employee type and calculate accordingly
    if (employee.salaryType === "Hourly") {
      // For hourly employees, use dollar increase
      if (meritIncreaseDollar !== undefined && meritIncreaseDollar !== null) {
        finalMeritDollar = parseFloat(meritIncreaseDollar);
        newHourlyRate = (parseFloat(employee.hourlyPayRate) || 0) + finalMeritDollar;
      }
    } else {
      // For salaried employees (Salary or Salaried), use percentage increase
      if (meritIncreasePercentage !== undefined && meritIncreasePercentage !== null) {
        finalMeritPercentage = parseFloat(meritIncreasePercentage);
        const currentSalary = parseFloat(employee.annualSalary) || 0;
        newAnnualSalary = currentSalary * (1 + finalMeritPercentage / 100);
      }
    }

    // Get supervisor details for history logging
    const supervisor = await Employee.findByPk(supervisorId, {
      attributes: ["id", "fullName", "employeeId"],
    });

    // Determine if this is an initial assignment or a modification
    const oldMeritPercentage = employee.meritIncreasePercentage;
    const oldMeritDollar = employee.meritIncreaseDollar;
    const isModification = (oldMeritPercentage > 0 || oldMeritDollar > 0);

    // Check if the merit value is the same as the current value (prevent saving same value)
    // ONLY block if they are not explicitly providing new remarks
    if (employee.approvalStatus?.enteredBy && remarks === undefined) {
      if (employee.salaryType === "Hourly") {
        if (oldMeritDollar !== null && oldMeritDollar !== undefined && parseFloat(oldMeritDollar) === finalMeritDollar) {
          return next(
            new AppError(
              `Merit value is already $${finalMeritDollar}/hr. Please enter a different value to modify.`,
              400
            )
          );
        }
      } else {
        if (oldMeritPercentage !== null && oldMeritPercentage !== undefined && parseFloat(oldMeritPercentage) === finalMeritPercentage) {
          return next(
            new AppError(
              `Merit value is already ${finalMeritPercentage}%. Please enter a different value to modify.`,
              400
            )
          );
        }
      }
    }

    // Add to merit history
    const history = employee.meritHistory || [];
    const historyEntry = {
      timestamp: new Date(),
      action: isModification ? "modified_by_supervisor" : "assigned",
      level: 0, // Supervisor level
      actor: {
        id: supervisorId,
        name: supervisor?.fullName || "Unknown",
        employeeId: supervisor?.employeeId || "N/A",
      },
      salaryType: employee.salaryType,
      comments: remarks || null,
    };

    if (isModification) {
      historyEntry.oldValue = employee.salaryType === "Hourly" ? oldMeritDollar : oldMeritPercentage;
      historyEntry.newValue = employee.salaryType === "Hourly" ? finalMeritDollar : finalMeritPercentage;
    } else {
      historyEntry.meritValue = employee.salaryType === "Hourly" ? finalMeritDollar : finalMeritPercentage;
    }

    history.push(historyEntry);

    // Update merit fields and reset approval state
    employee.meritIncreasePercentage = finalMeritPercentage;
    employee.meritIncreaseDollar = finalMeritDollar;
    employee.newAnnualSalary = newAnnualSalary;
    employee.newHourlyRate = newHourlyRate;
    employee.approvalStatus = {
      ...employee.approvalStatus,
      enteredBy: supervisorId,
      enteredAt: new Date(),
      submittedForApproval: false, // Reset so supervisor can re-submit
      remarks: remarks !== undefined ? remarks : employee.approvalStatus?.remarks || null,
    };
    employee.meritHistory = history;
    await employee.save();

    const updatedEmployee = await Employee.findByPk(id, {
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Employee,
          as: "level1Approver",
          attributes: ["id", "fullName", "employeeId"],
        },
        {
          model: Employee,
          as: "level2Approver",
          attributes: ["id", "fullName", "employeeId"],
        },
        {
          model: Employee,
          as: "level3Approver",
          attributes: ["id", "fullName", "employeeId"],
        },
        {
          model: Employee,
          as: "level4Approver",
          attributes: ["id", "fullName", "employeeId"],
        },
        {
          model: Employee,
          as: "level5Approver",
          attributes: ["id", "fullName", "employeeId"],
        },
      ],
    });

    res.status(200).json({
      success: true,
      message: "Merit updated successfully",
      data: updatedEmployee,
    });
  } catch (error) {
    next(error);
  }
};

// Backward compatibility alias
export const updateEmployeeBonus = updateEmployeeMerit;

// @desc    Bulk create employees from Excel upload
// @route   POST /api/v2/employees/bulk
// @access  Private (Admin/HR only)
export const bulkCreateEmployees = async (req, res, next) => {
  try {
    const Employee = getEmployeeModel();
    const { employees } = req.body || {};

    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      return next(new AppError("Please provide an array of employees", 400));
    }

    // Validate required fields for each employee
    const invalidEmployees = [];
    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      if (!emp.employeeId || !emp.fullName) {
        invalidEmployees.push({
          index: i + 1,
          employeeId: emp.employeeId || "N/A",
          employeeName: emp.fullName || "N/A",
          reason: "Missing required fields (Employee Number, Full Name)",
        });
      }
    }

    if (invalidEmployees.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Some employees have validation errors",
        errors: invalidEmployees,
      });
    }

    const createdEmployees = [];
    const skippedDuplicates = [];

    // Process each employee
    for (const emp of employees) {
      try {
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(
          emp.password || "abc123xyz",
          salt,
        );

        // Extract reporting fields
        const {
          reporting1st,
          reporting2nd,
          reporting3rd,
          reporting4th,
          reporting5th,
          address,
          ...employeeData
        } = emp;

        // Flatten address object if it exists
        const addressFields = {};
        if (address) {
          addressFields.addressStreet = address.street;
          addressFields.addressCity = address.city;
          addressFields.addressState = address.state;
          addressFields.addressZipCode = address.zipCode;
          addressFields.addressCountry = address.country || "USA";
        }

        // Store reporting names
        const reportingFields = {};
        if (reporting1st) reportingFields.level1ApproverName = reporting1st;
        if (reporting2nd) reportingFields.level2ApproverName = reporting2nd;
        if (reporting3rd) reportingFields.level3ApproverName = reporting3rd;
        if (reporting4th) reportingFields.level4ApproverName = reporting4th;
        if (reporting5th) reportingFields.level5ApproverName = reporting5th;

        // Create employee
        const created = await Employee.create({
          ...employeeData,
          ...addressFields,
          ...reportingFields,
          password: hashedPassword,
        });

        createdEmployees.push(created);
      } catch (error) {
        // Track which employees failed and why
        let reason = error.message || "Validation error";

        if (error.name === "SequelizeUniqueConstraintError") {
          // Check which field caused the duplicate error
          const fields = error.fields || {};
          if (fields.employeeId || error.message?.includes("employeeId")) {
            reason = "Duplicate Employee ID (already exists in database)";
          } else {
            reason = `Duplicate entry: ${Object.keys(fields).join(", ")}`;
          }
        }

        skippedDuplicates.push({
          employeeId: emp.employeeId,
          employeeName: emp.fullName || "N/A",
          email: emp.email || "N/A",
          reason: reason,
        });
      }
    }

    // Second pass: Sync approver IDs from names
    let reportingMapped = 0;
    const allEmployees = await Employee.findAll();

    // Create lookup maps
    const employeeIdMap = new Map();
    const nameMap = new Map();

    for (const emp of allEmployees) {
      employeeIdMap.set(emp.employeeId, emp);
      const fullName = emp.fullName.toLowerCase();
      nameMap.set(fullName, emp);
      // Also try "LastName, FirstName" and "FirstName LastName" variants
      const nameParts = emp.fullName.split(' ');
      if (nameParts.length >= 2) {
        const firstName = nameParts.slice(0, -1).join(' ');
        const lastName = nameParts[nameParts.length - 1];
        const lastFirst = `${lastName}, ${firstName}`.toLowerCase();
        nameMap.set(lastFirst, emp);
      }
    }

    // Helper function to find approver
    const findApprover = (nameOrId) => {
      if (!nameOrId || nameOrId === "-") return null;

      // Try employee ID first
      let approver = employeeIdMap.get(nameOrId);
      if (approver) return approver;

      // Try name matching
      const searchKey = nameOrId.toLowerCase().trim();
      approver = nameMap.get(searchKey);
      if (approver) return approver;

      // Try "LastName, FirstName" format
      const nameParts = nameOrId.split(",").map((s) => s.trim());
      if (nameParts.length === 2) {
        const [lastName, firstName] = nameParts;
        const key = `${lastName}, ${firstName}`.toLowerCase();
        approver = nameMap.get(key);
        if (approver) return approver;

        const reverseKey = `${firstName} ${lastName}`.toLowerCase();
        approver = nameMap.get(reverseKey);
        if (approver) return approver;
      }

      return null;
    };

    // Update approver IDs
    for (const employee of createdEmployees) {
      const updates = {};

      if (employee.level1ApproverName) {
        const approver = findApprover(employee.level1ApproverName);
        if (approver) updates.level1ApproverId = approver.id;
      }
      if (employee.level2ApproverName) {
        const approver = findApprover(employee.level2ApproverName);
        if (approver) updates.level2ApproverId = approver.id;
      }
      if (employee.level3ApproverName) {
        const approver = findApprover(employee.level3ApproverName);
        if (approver) updates.level3ApproverId = approver.id;
      }
      if (employee.level4ApproverName) {
        const approver = findApprover(employee.level4ApproverName);
        if (approver) updates.level4ApproverId = approver.id;
      }
      if (employee.level5ApproverName) {
        const approver = findApprover(employee.level5ApproverName);
        if (approver) updates.level5ApproverId = approver.id;
      }
      if (employee.supervisorName) {
        const supervisor = findApprover(employee.supervisorName);
        if (supervisor) updates.supervisorId = supervisor.id;
      }

      if (Object.keys(updates).length > 0) {
        await employee.update(updates);
        reportingMapped++;
      }
    }

    // Set approver role for employees who are approvers
    const approverIds = new Set();
    const employeesWithApprovers = await Employee.findAll({
      where: {
        [Op.or]: [
          { level1ApproverId: { [Op.ne]: null } },
          { level2ApproverId: { [Op.ne]: null } },
          { level3ApproverId: { [Op.ne]: null } },
          { level4ApproverId: { [Op.ne]: null } },
          { level5ApproverId: { [Op.ne]: null } },
        ],
      },
    });

    for (const emp of employeesWithApprovers) {
      if (emp.level1ApproverId) approverIds.add(emp.level1ApproverId);
      if (emp.level2ApproverId) approverIds.add(emp.level2ApproverId);
      if (emp.level3ApproverId) approverIds.add(emp.level3ApproverId);
      if (emp.level4ApproverId) approverIds.add(emp.level4ApproverId);
      if (emp.level5ApproverId) approverIds.add(emp.level5ApproverId);
    }

    let approverRoleCount = 0;
    if (approverIds.size > 0) {
      const [updateCount] = await Employee.update(
        { role: "approver", isApprover: true },
        { where: { id: { [Op.in]: Array.from(approverIds) } } },
      );
      approverRoleCount = updateCount;
    }

    // Also set approver role for supervisors who have employees under them
    const supervisorIds = new Set();
    const employeesWithSupervisors = await Employee.findAll({
      where: {
        supervisorId: { [Op.ne]: null },
      },
    });

    for (const emp of employeesWithSupervisors) {
      if (emp.supervisorId) supervisorIds.add(emp.supervisorId);
    }

    // Update supervisors who are not already approvers
    let supervisorRoleCount = 0;
    if (supervisorIds.size > 0) {
      // Only update those who don't already have approver role
      const supervisorsToUpdate = Array.from(supervisorIds).filter(
        id => !approverIds.has(id)
      );

      if (supervisorsToUpdate.length > 0) {
        const [updateCount] = await Employee.update(
          { role: "approver", isApprover: true },
          { where: { id: { [Op.in]: supervisorsToUpdate } } },
        );
        supervisorRoleCount = updateCount;
      }
    }

    // If there were skipped duplicates, return 207 instead of 201
    const statusCode = skippedDuplicates.length > 0 ? 207 : 201;
    const totalRolesSet = approverRoleCount + supervisorRoleCount;
    const message =
      skippedDuplicates.length > 0
        ? `Partially successful: ${createdEmployees.length} employees created, ${skippedDuplicates.length} skipped (already exist). Synced ${reportingMapped} approver relationships. Set ${totalRolesSet} employees as approvers/supervisors.`
        : `Successfully created ${createdEmployees.length} employees. Synced ${reportingMapped} approver relationships. Set ${totalRolesSet} employees as approvers/supervisors.`;

    res.status(statusCode).json({
      success: true,
      message,
      count: createdEmployees.length,
      reportingMapped,
      approverRolesSet: approverRoleCount,
      supervisorRolesSet: supervisorRoleCount,
      totalRolesSet: totalRolesSet,
      duplicates: skippedDuplicates.length > 0 ? skippedDuplicates : undefined,
      data: createdEmployees.map((emp) => {
        const empData = emp.toJSON();
        delete empData.password;
        return empData;
      }),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Download employee template
// @route   GET /api/v2/employees/template/download
// @access  Private (Admin/HR only)
export const downloadTemplate = async (req, res, next) => {
  try {
    const XLSX = await import("xlsx");

    // Define template headers
    const headers = [
      "Employee Number",
      "Employee Name",
      "Work Email",
      "SSN",
      "Company",
      "Company Code",
      "Supervisor Name",
      "Location",
      "1st Reporting",
      "2nd Reporting",
      "3rd Reporting",
      "4th Reporting",
      "5th Reporting",
      "State/Province",
      "Last Hire Date",
      "Employee Type",
      "Job Title",
      "Salary or Hourly",
      "Annual Salary",
      "Hourly Pay Rate",
      "Merit Increase %",
      "Merit Increase $",
      "New Annual Salary",
      "New Hourly Rate",
      "Role",
    ];

    // Sample data row
    const sampleData = [
      "EMP001",
      "Doe, John",
      "john.doe@company.com",
      "123-45-6789",
      "Company Name",
      "COMP01",
      "Smith, Jane",
      "New York",
      "Manager, Bob",
      "Director, Alice",
      "",
      "",
      "",
      "NY",
      "2020-01-15",
      "Full-Time",
      "Software Engineer",
      "Salary",
      "80000",
      "",
      "2.5",
      "",
      "82000",
      "",
      "employee",
    ];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, sampleData]);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Employee Template");

    // Generate buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Set headers for file download
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=employee_template.xlsx",
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

// @desc    Sync approver names to IDs for all employees
// @route   POST /api/v2/employees/sync-approvers
// @access  Private (Admin only)
export const syncApproverIds = async (req, res, next) => {
  try {
    const Employee = getEmployeeModel();

    // Get all employees at once
    const allEmployees = await Employee.findAll();

    // Create lookup maps for fast searching
    const employeeIdMap = new Map();
    const nameMap = new Map();

    // Build lookup maps
    for (const emp of allEmployees) {
      employeeIdMap.set(emp.employeeId, emp);
      const fullName = emp.fullName.toLowerCase();
      nameMap.set(fullName, emp);
      // Also try "LastName, FirstName" and "FirstName LastName" variants
      const nameParts = emp.fullName.split(' ');
      if (nameParts.length >= 2) {
        const firstName = nameParts.slice(0, -1).join(' ');
        const lastName = nameParts[nameParts.length - 1];
        const lastFirst = `${lastName}, ${firstName}`.toLowerCase();
        nameMap.set(lastFirst, emp);
      }
    }

    // Helper function to find approver using maps
    const findApproverByName = (nameOrId) => {
      if (!nameOrId || nameOrId === "-") return null;

      let approver = employeeIdMap.get(nameOrId);
      if (approver) return approver;

      const searchKey = nameOrId.toLowerCase().trim();
      approver = nameMap.get(searchKey);
      if (approver) return approver;

      const nameParts = nameOrId.split(",").map((s) => s.trim());
      if (nameParts.length === 2) {
        const [lastName, firstName] = nameParts;
        const key = `${lastName}, ${firstName}`.toLowerCase();
        approver = nameMap.get(key);
        if (approver) return approver;

        const reverseKey = `${firstName} ${lastName}`.toLowerCase();
        approver = nameMap.get(reverseKey);
        if (approver) return approver;
      }

      const parts = nameOrId.split(" ").map((s) => s.trim());
      if (parts.length >= 2) {
        const firstName = parts[0];
        const lastName = parts[parts.length - 1];
        const key = `${firstName} ${lastName}`.toLowerCase();
        approver = nameMap.get(key);
        if (approver) return approver;

        const reverseKey = `${lastName}, ${firstName}`.toLowerCase();
        approver = nameMap.get(reverseKey);
        if (approver) return approver;
      }

      return null;
    };

    let updatedCount = 0;
    const errors = [];

    // Process each employee
    for (const employee of allEmployees) {
      const updates = {};
      let hasUpdates = false;

      const levels = [
        { nameField: "supervisorName", idField: "supervisorId" },
        { nameField: "level1ApproverName", idField: "level1ApproverId" },
        { nameField: "level2ApproverName", idField: "level2ApproverId" },
        { nameField: "level3ApproverName", idField: "level3ApproverId" },
        { nameField: "level4ApproverName", idField: "level4ApproverId" },
        { nameField: "level5ApproverName", idField: "level5ApproverId" },
      ];

      for (const level of levels) {
        const approverName = employee[level.nameField];

        if (approverName) {
          const approver = findApproverByName(approverName);

          if (approver) {
            const currentId = employee[level.idField]?.toString();
            const newId = approver.id.toString();

            if (!currentId || currentId !== newId) {
              updates[level.idField] = approver.id;
              hasUpdates = true;
            }
          } else {
            errors.push({
              employeeId: employee.employeeId,
              employeeName: employee.fullName,
              level: level.nameField
                .replace("ApproverName", "")
                .replace("Name", ""),
              approverName: approverName,
              reason: "Person not found in database",
            });
          }
        }
      }

      if (hasUpdates) {
        await employee.update(updates);
        updatedCount++;
      }
    }

    if (res) {
      return res.status(200).json({
        success: true,
        message: "Successfully synced supervisor and approver IDs",
        updated: updatedCount,
        total: allEmployees.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    return { updated: updatedCount, total: allEmployees.length, errors };
  } catch (error) {
    if (res) {
      return next(error);
    }
    throw error;
  }
};

// @desc    Clear and re-sync all approver IDs
// @route   POST /api/v2/employees/approvals/reset-and-sync
// @access  Private (Admin only)
export const resetAndSyncApprovers = async (req, res, next) => {
  try {
    const Employee = getEmployeeModel();

    // Clear all approver ID fields and supervisor
    const [clearCount] = await Employee.update(
      {
        supervisorId: null,
        level1ApproverId: null,
        level2ApproverId: null,
        level3ApproverId: null,
        level4ApproverId: null,
        level5ApproverId: null,
      },
      { where: {} },
    );

    // Re-sync using the approver names
    const syncResult = await syncApproverIds();

    res.status(200).json({
      success: true,
      message:
        "Successfully cleared and re-synced all supervisor and approver assignments",
      cleared: clearCount,
      synced: syncResult.updated,
      total: syncResult.total,
      errors: syncResult.errors,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Set approver role for all employees who are approvers or supervisors
// @route   POST /api/v2/employees/set-approver-roles
// @access  Private (Admin only)
export const setApproverRoles = async (req, res, next) => {
  try {
    const Employee = getEmployeeModel();

    // Find all employees who are assigned as approvers
    const employeesWithApprovers = await Employee.findAll({
      where: {
        [Op.or]: [
          { level1ApproverId: { [Op.ne]: null } },
          { level2ApproverId: { [Op.ne]: null } },
          { level3ApproverId: { [Op.ne]: null } },
          { level4ApproverId: { [Op.ne]: null } },
          { level5ApproverId: { [Op.ne]: null } },
        ],
      },
    });

    // Collect all unique approver IDs
    const approverIds = new Set();
    for (const emp of employeesWithApprovers) {
      if (emp.level1ApproverId) approverIds.add(emp.level1ApproverId);
      if (emp.level2ApproverId) approverIds.add(emp.level2ApproverId);
      if (emp.level3ApproverId) approverIds.add(emp.level3ApproverId);
      if (emp.level4ApproverId) approverIds.add(emp.level4ApproverId);
      if (emp.level5ApproverId) approverIds.add(emp.level5ApproverId);
    }

    // Update role to "approver" for all employees who are approvers
    let approverRoleCount = 0;
    if (approverIds.size > 0) {
      const [updateCount] = await Employee.update(
        { role: "approver", isApprover: true },
        { where: { id: { [Op.in]: Array.from(approverIds) } } },
      );
      approverRoleCount = updateCount;
    }

    // Also find all employees who are supervisors
    const employeesWithSupervisors = await Employee.findAll({
      where: {
        supervisorId: { [Op.ne]: null },
      },
    });

    // Collect all unique supervisor IDs
    const supervisorIds = new Set();
    for (const emp of employeesWithSupervisors) {
      if (emp.supervisorId) supervisorIds.add(emp.supervisorId);
    }

    // Update supervisors who are not already approvers
    let supervisorRoleCount = 0;
    if (supervisorIds.size > 0) {
      // Only update those who don't already have approver role
      const supervisorsToUpdate = Array.from(supervisorIds).filter(
        id => !approverIds.has(id)
      );

      if (supervisorsToUpdate.length > 0) {
        const [updateCount] = await Employee.update(
          { role: "approver", isApprover: true },
          { where: { id: { [Op.in]: supervisorsToUpdate } } },
        );
        supervisorRoleCount = updateCount;
      }
    }

    const totalUpdated = approverRoleCount + supervisorRoleCount;

    res.status(200).json({
      success: true,
      message: `Successfully set approver/supervisor role for ${totalUpdated} employees`,
      totalApprovers: approverIds.size,
      totalSupervisors: supervisorIds.size,
      approverRolesSet: approverRoleCount,
      supervisorRolesSet: supervisorRoleCount,
      totalUpdated: totalUpdated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Debug endpoint to check approver assignments
// @route   GET /api/v2/employees/approvals/debug/:employeeId
// @access  Private (Admin only)
export const debugApproverAssignments = async (req, res, next) => {
  try {
    const Employee = getEmployeeModel();
    const { employeeId } = req.params;

    // Find the approver
    const approver = await Employee.findOne({
      where: { employeeId },
      attributes: ["id", "employeeId", "fullName"],
    });

    if (!approver) {
      return res.status(404).json({
        success: false,
        message: "Approver not found",
      });
    }

    const approverId = approver.id;

    // Use the EXACT same queries as getMyApprovals
    const level1Count = await Employee.count({
      where: {
        level1ApproverId: approverId,
        isActive: true,
        id: { [Op.ne]: approverId },
      },
    });

    const level2Count = await Employee.count({
      where: {
        level2ApproverId: approverId,
        level1ApproverId: { [Op.ne]: approverId },
        isActive: true,
        id: { [Op.ne]: approverId },
      },
    });

    const level3Count = await Employee.count({
      where: {
        level3ApproverId: approverId,
        level1ApproverId: { [Op.ne]: approverId },
        level2ApproverId: { [Op.ne]: approverId },
        isActive: true,
        id: { [Op.ne]: approverId },
      },
    });

    const level4Count = await Employee.count({
      where: {
        level4ApproverId: approverId,
        level1ApproverId: { [Op.ne]: approverId },
        level2ApproverId: { [Op.ne]: approverId },
        level3ApproverId: { [Op.ne]: approverId },
        isActive: true,
        id: { [Op.ne]: approverId },
      },
    });

    const level5Count = await Employee.count({
      where: {
        level5ApproverId: approverId,
        level1ApproverId: { [Op.ne]: approverId },
        level2ApproverId: { [Op.ne]: approverId },
        level3ApproverId: { [Op.ne]: approverId },
        level4ApproverId: { [Op.ne]: approverId },
        isActive: true,
        id: { [Op.ne]: approverId },
      },
    });

    // Get sample employees from Level 1
    const sampleLevel1 = await Employee.findAll({
      where: {
        level1ApproverId: approverId,
        isActive: true,
        id: { [Op.ne]: approverId },
      },
      attributes: [
        "employeeId",
        "fullName",
        "level1ApproverName",
        "level2ApproverName",
        "level3ApproverName",
        "level4ApproverName",
        "level5ApproverName",
      ],
      include: [
        {
          model: Employee,
          as: "level1Approver",
          attributes: ["employeeId", "fullName"],
        },
        {
          model: Employee,
          as: "level2Approver",
          attributes: ["employeeId", "fullName"],
        },
        {
          model: Employee,
          as: "level3Approver",
          attributes: ["employeeId", "fullName"],
        },
        {
          model: Employee,
          as: "level4Approver",
          attributes: ["employeeId", "fullName"],
        },
        {
          model: Employee,
          as: "level5Approver",
          attributes: ["employeeId", "fullName"],
        },
      ],
      limit: 10,
    });

    // Get sample from Level 2
    const sampleLevel2 = await Employee.findAll({
      where: {
        level2ApproverId: approverId,
        level1ApproverId: { [Op.ne]: approverId },
        isActive: true,
        id: { [Op.ne]: approverId },
      },
      attributes: [
        "employeeId",
        "fullName",
        "level1ApproverName",
        "level2ApproverName",
        "level3ApproverName",
        "level4ApproverName",
        "level5ApproverName",
      ],
      include: [
        {
          model: Employee,
          as: "level1Approver",
          attributes: ["employeeId", "fullName"],
        },
        {
          model: Employee,
          as: "level2Approver",
          attributes: ["employeeId", "fullName"],
        },
        {
          model: Employee,
          as: "level3Approver",
          attributes: ["employeeId", "fullName"],
        },
        {
          model: Employee,
          as: "level4Approver",
          attributes: ["employeeId", "fullName"],
        },
        {
          model: Employee,
          as: "level5Approver",
          attributes: ["employeeId", "fullName"],
        },
      ],
      limit: 10,
    });

    res.status(200).json({
      success: true,
      approver: {
        employeeId: approver.employeeId,
        name: approver.fullName,
        id: approver.id,
      },
      counts: {
        level1: level1Count,
        level2: level2Count,
        level3: level3Count,
        level4: level4Count,
        level5: level5Count,
      },
      sampleLevel1Employees: sampleLevel1,
      sampleLevel2Employees: sampleLevel2,
    });
  } catch (error) {
    next(error);
  }
};
// @desc    Submit all merits for approval (supervisor action)
// @route   POST /api/v2/employees/supervisor/submit-for-approval
// @access  Private (Supervisor only)
export const submitMeritsForApproval = async (req, res, next) => {
  try {
    const Employee = getEmployeeModel();
    const supervisorId =
      req.user?.userId ||
      req.user?.id ||
      req.body?.supervisorId ||
      req.query?.supervisorId;

    if (
      !supervisorId ||
      supervisorId === "undefined" ||
      supervisorId === "null"
    ) {
      return next(new AppError("Supervisor ID is required", 400));
    }

    // Find all employees under this supervisor
    const employees = await Employee.findAll({
      where: {
        supervisorId: supervisorId,
        isActive: true,
        id: { [Op.ne]: supervisorId },
      },
    });

    if (!employees || employees.length === 0) {
      return next(
        new AppError("No employees found under your supervision", 404),
      );
    }

    // Separate employees into submitted and unsubmitted
    const unsubmittedEmployees = employees.filter((emp) => {
      const status = emp.approvalStatus || {};
      return !status.submittedForApproval;
    });

    // Check if there are any unsubmitted employees
    if (unsubmittedEmployees.length === 0) {
      return next(
        new AppError(
          "All employees have already been submitted for approval.",
          400,
        ),
      );
    }

    // Check if ALL unsubmitted employees have merits entered
    const employeesWithoutMerit = unsubmittedEmployees.filter((emp) => {
      const status = emp.approvalStatus || {};
      const hasMeritEntered = !!(status.enteredBy);
      return !hasMeritEntered;
    });

    if (employeesWithoutMerit.length > 0) {
      const employeeNames = employeesWithoutMerit.map(emp => emp.fullName).join(', ');
      return next(
        new AppError(
          `Cannot submit for approval. Please assign merits to ALL employees first. Missing merits for: ${employeeNames}`,
          400,
        ),
      );
    }

    // All unsubmitted employees have merits - proceed with submission
    const employeesToSubmit = unsubmittedEmployees;

    // Get supervisor details for history logging
    const supervisor = await Employee.findByPk(supervisorId, {
      attributes: ["id", "fullName", "employeeId"],
    });

    // Update each employee
    for (const employee of employeesToSubmit) {
      // Get existing approval status safely
      const existingStatus = employee.approvalStatus || {};

      // Build status object preserving enteredBy/enteredAt and remarks if they exist
      const status = {
        submittedForApproval: true,
        submittedAt: new Date(),
        enteredBy: existingStatus.enteredBy || supervisorId,
        enteredAt: existingStatus.enteredAt || new Date(),
        remarks: existingStatus.remarks || null,
      };

      // Reset levels to pending if they have an approver
      if (employee.level1ApproverId)
        status.level1 = { status: "pending", approvedBy: null, approvedAt: null, comments: null };
      if (employee.level2ApproverId)
        status.level2 = { status: "pending", approvedBy: null, approvedAt: null, comments: null };
      if (employee.level3ApproverId)
        status.level3 = { status: "pending", approvedBy: null, approvedAt: null, comments: null };
      if (employee.level4ApproverId)
        status.level4 = { status: "pending", approvedBy: null, approvedAt: null, comments: null };
      if (employee.level5ApproverId)
        status.level5 = { status: "pending", approvedBy: null, approvedAt: null, comments: null };

      // Add to merit history
      const history = employee.meritHistory || [];
      const meritValue = employee.salaryType === "Hourly"
        ? employee.meritIncreaseDollar
        : employee.meritIncreasePercentage;

      history.push({
        timestamp: new Date(),
        action: "submitted_for_approval",
        level: 0, // Supervisor level
        actor: {
          id: supervisorId,
          name: supervisor?.fullName || "Unknown",
          employeeId: supervisor?.employeeId || "N/A",
        },
        meritValue: meritValue,
        salaryType: employee.salaryType,
        comments: null,
      });

      // Update employee instance and save (use .save() to trigger setters properly)
      employee.approvalStatus = status;
      employee.meritHistory = history;
      await employee.save();
    }

    res.status(200).json({
      success: true,
      message:
        "Great work! You have assigned merits for all the employees designated to you. They are sent to the next level for review.",
      count: employeesToSubmit.length,
    });
  } catch (error) {
    next(error);
  }
};

// Backward compatibility alias
export const submitBonusesForApproval = submitMeritsForApproval;

// @desc    Get employees pending bonus approval for approver
// @route   GET /api/v2/employees/bonus-approvals/my-approvals
// @access  Private (Approver only)
export const getMyBonusApprovals = async (req, res, next) => {
  try {
    const Employee = getEmployeeModel();
    const approverId =
      req.user?.userId || req.user?.id || req.query?.approverId;

    if (!approverId || approverId === "undefined" || approverId === "null") {
      return next(new AppError("Approver ID is required", 400));
    }

    // Find ALL active employees assigned to this approver - just return them all
    const allEmployees = await Employee.findAll({
      where: {
        isActive: true,
        [Op.or]: [
          { level1ApproverId: approverId },
          { level2ApproverId: approverId },
          { level3ApproverId: approverId },
          { level4ApproverId: approverId },
          { level5ApproverId: approverId },
        ],
      },
      attributes: { exclude: ["password"] },
      order: [["employeeId", "ASC"]],
    });

    res.status(200).json({
      success: true,
      count: allEmployees.length,
      data: allEmployees,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Process bonus approval/rejection
// @route   POST /api/v2/employees/:employeeId/bonus-approval
// @access  Private (Approver only)
export const processBonusApproval = async (req, res, next) => {
  try {
    const Employee = getEmployeeModel();
    const { employeeId } = req.params;
    const { action, comments, approverId: bodyApproverId } = req.body || {};
    const approverId =
      req.user?.userId ||
      req.user?.id ||
      bodyApproverId ||
      req.query?.approverId;

    if (!approverId || approverId === "undefined" || approverId === "null") {
      return next(new AppError("Approver ID is required", 400));
    }

    if (!action || !["approve", "reject"].includes(action)) {
      return next(new AppError("Action must be either approve or reject", 400));
    }

    const employee = await Employee.findByPk(employeeId);
    if (!employee) {
      return next(new AppError("Employee not found", 404));
    }

    // Check if merit has been entered (either percentage or dollar amount)
    const isMeritEntered = !!(
      employee.approvalStatus?.enteredBy ||
      (employee.meritIncreasePercentage && employee.meritIncreasePercentage > 0) ||
      (employee.meritIncreaseDollar && employee.meritIncreaseDollar > 0)
    );
    if (!isMeritEntered) {
      return next(
        new AppError("No merit has been entered for this employee", 400),
      );
    }

    if (!employee.approvalStatus?.submittedForApproval) {
      return next(
        new AppError("Merit has not been submitted for approval yet", 400),
      );
    }

    // Determine which level this approver should approve
    let approverLevel = null;
    for (let level = 1; level <= 5; level++) {
      const levelKey = `level${level}`;
      const approverIdField = `${levelKey}ApproverId`;

      if (employee[approverIdField]?.toString() === approverId.toString()) {
        const status = employee.approvalStatus?.[levelKey]?.status;
        if (status === "pending") {
          // Check if previous levels are approved
          let canApprove = true;
          for (let prevLevel = 1; prevLevel < level; prevLevel++) {
            const prevLevelKey = `level${prevLevel}`;
            const prevStatus = employee.approvalStatus?.[prevLevelKey]?.status;
            if (prevStatus && prevStatus !== "approved") {
              canApprove = false;
              break;
            }
          }

          if (canApprove) {
            approverLevel = level;
            break;
          } else {
            return next(
              new AppError(
                `Previous approval levels must be completed first`,
                400,
              ),
            );
          }
        }
      }
    }

    if (!approverLevel) {
      return next(
        new AppError(
          "You are not authorized to approve merit for this employee at this time",
          403,
        ),
      );
    }

    // Get approver details for history logging
    const approverDetails = await Employee.findByPk(approverId, {
      attributes: ["id", "fullName", "employeeId"],
    });

    // Update bonus approval status - convert to plain object to avoid circular references
    const existingStatus = employee.approvalStatus
      ? JSON.parse(JSON.stringify(employee.approvalStatus))
      : {};

    const levelKey = `level${approverLevel}`;
    existingStatus[levelKey] = {
      ...(existingStatus[levelKey] || {}),
      status: action === "approve" ? "approved" : "rejected",
      approvedBy: approverId,
      approvedAt: new Date(),
      comments: comments || existingStatus[levelKey]?.comments,
    };

    // Add to merit history
    const history = employee.meritHistory || [];
    const currentMeritValue = employee.salaryType === "Hourly"
      ? employee.meritIncreaseDollar
      : employee.meritIncreasePercentage;

    history.push({
      timestamp: new Date(),
      action: action === "approve" ? "approved" : "rejected",
      level: approverLevel,
      actor: {
        id: approverId,
        name: approverDetails?.fullName || "Unknown",
        employeeId: approverDetails?.employeeId || "N/A",
      },
      meritValue: currentMeritValue,
      salaryType: employee.salaryType,
      comments: comments || null,
    });

    // Update employee instance and save (use .save() to trigger setters properly)
    employee.approvalStatus = existingStatus;
    employee.meritHistory = history;
    await employee.save();

    const updatedEmployee = await Employee.findByPk(employeeId, {
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Employee,
          as: "supervisor",
          attributes: ["id", "fullName", "employeeId", "email"],
        },
        {
          model: Employee,
          as: "level1Approver",
          attributes: ["id", "fullName", "employeeId", "email"],
        },
        {
          model: Employee,
          as: "level2Approver",
          attributes: ["id", "fullName", "employeeId", "email"],
        },
        {
          model: Employee,
          as: "level3Approver",
          attributes: ["id", "fullName", "employeeId", "email"],
        },
        {
          model: Employee,
          as: "level4Approver",
          attributes: ["id", "fullName", "employeeId", "email"],
        },
        {
          model: Employee,
          as: "level5Approver",
          attributes: ["id", "fullName", "employeeId", "email"],
        },
      ],
    });

    // Send email notification if rejected
    if (action === "reject") {
      // Determine the previous approver to notify
      let previousApprover = null;
      let previousApproverLevel = null;

      // If rejecting at level 2, notify level 1 approver
      // If rejecting at level 3, notify level 2 approver, etc.
      if (approverLevel > 1) {
        const previousLevel = approverLevel - 1;
        const previousApproverKey = `level${previousLevel}Approver`;
        previousApprover = updatedEmployee[previousApproverKey];
        previousApproverLevel = previousLevel;
      } else if (approverLevel === 1) {
        // If rejecting at level 1, notify the supervisor who entered the bonus
        previousApprover = updatedEmployee.supervisor;
        previousApproverLevel = 0; // Supervisor
      }

      // Get the current approver's details
      const currentApprover = await Employee.findByPk(approverId, {
        attributes: ["fullName"],
      });

      // Send email if previous approver exists and has an email
      if (previousApprover && previousApprover.email) {
        try {
          // Calculate current merit amount for email
          const currentMeritAmount = updatedEmployee.salaryType === "Hourly"
            ? updatedEmployee.meritIncreaseDollar || 0
            : updatedEmployee.meritIncreasePercentage || 0;

          await sendBonusRejectionEmail({
            toEmail: previousApprover.email,
            toName: previousApprover.fullName,
            employeeName: updatedEmployee.fullName,
            employeeId: updatedEmployee.employeeId,
            currentAmount: currentMeritAmount,
            rejectedBy: currentApprover?.fullName || "Approver",
            rejectorLevel: approverLevel,
            rejectionReason: comments || "",
          });
          console.log(`✅ Rejection notification email sent to ${previousApprover.email}`);
        } catch (emailError) {
          // Log error but don't fail the rejection process
          console.error("❌ Failed to send rejection email:", emailError);
        }
      } else {
        console.warn(`⚠️ No email address found for previous approver at level ${previousApproverLevel}`);
      }

      // Create in-app notification for the previous approver
      if (previousApprover && previousApprover.id) {
        const rejectorName = currentApprover?.fullName || "An approver";
        const levelLabel = previousApproverLevel === 0 ? "Supervisor" : `Level ${previousApproverLevel} Approver`;
        const currentMeritAmount = updatedEmployee.salaryType === "Hourly"
          ? updatedEmployee.meritIncreaseDollar || 0
          : updatedEmployee.meritIncreasePercentage || 0;

        await createNotification({
          recipientId: previousApprover.id,
          type: "merit_rejected",
          title: `Merit Rejected — Action Required`,
          message: `${rejectorName} (Level ${approverLevel}) rejected the merit for ${updatedEmployee.fullName}. As the ${levelLabel}, please review and resubmit with an updated amount.`,
          payload: {
            employeeDbId: updatedEmployee.id,
            employeeId: updatedEmployee.employeeId,
            employeeName: updatedEmployee.fullName,
            currentMerit: currentMeritAmount,
            rejectedBy: rejectorName,
            rejectorLevel: approverLevel,
            rejectionReason: comments || "",
            recipientLevel: previousApproverLevel,
          },
        });
        console.log(`✅ In-app rejection notification created for approver ID ${previousApprover.id}`);
      }
    } else if (action === "approve") {
      // ── Check if all approvals are now complete ────────────────────────────
      // Check if there are any remaining pending approvals
      let allApprovalsComplete = true;
      for (let level = 1; level <= 5; level++) {
        const levelKey = `level${level}`;
        const approverIdField = `${levelKey}ApproverId`;

        // If this level has an approver assigned
        if (updatedEmployee[approverIdField]) {
          const status = updatedEmployee.approvalStatus?.[levelKey]?.status;
          // If any level is not approved, approvals are incomplete
          if (status !== "approved") {
            allApprovalsComplete = false;
            break;
          }
        }
      }

      // ── If all approvals complete, notify supervisor ───────────────────────
      if (allApprovalsComplete && updatedEmployee.supervisorId) {
        const supervisor = await Employee.findByPk(updatedEmployee.supervisorId);
        if (supervisor?.email) {
          // Format merit display
          const meritDisplay = updatedEmployee.salaryType === 'Hourly'
            ? `$${updatedEmployee.meritIncreaseDollar || 0}/hr`
            : `${updatedEmployee.meritIncreasePercentage || 0}%`;

          // Send notification
          try {
            await createNotification({
              recipientId: supervisor.id,
              type: 'merit_final_approved',
              title: `All Approvals Complete - ${updatedEmployee.fullName}`,
              message: `All merit approvals are complete for ${updatedEmployee.fullName}. Final merit: ${meritDisplay}`,
              payload: {
                employeeDbId: updatedEmployee.id,
                employeeId: updatedEmployee.employeeId,
                employeeName: updatedEmployee.fullName,
                finalMerit: meritDisplay
              }
            });
            console.log('✅ Sent final approval notification to supervisor:', supervisor.fullName);
          } catch (notifError) {
            console.error('❌ Failed to create final approval notification:', notifError);
          }

          // Send email
          try {
            await sendFinalApprovalEmail({
              toEmail: supervisor.email,
              toName: supervisor.fullName,
              singleEmployeeName: updatedEmployee.fullName,
              employeeNames: [updatedEmployee.fullName]
            });
            console.log('✅ Sent final approval email to supervisor:', supervisor.email);
          } catch (emailError) {
            console.error('❌ Failed to send final approval email:', emailError);
          }
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Merit ${action === "approve" ? "approved" : "rejected"} successfully at level ${approverLevel}`,
      data: updatedEmployee,
    });
  } catch (error) {
    next(error);
  }
};

// Backward compatibility alias
export const processMeritApproval = processBonusApproval;

// @desc    Bulk approve all eligible employees for an approver
// @route   POST /api/v2/employees/approvals/bulk-approve
// @access  Private (Approver only)
export const bulkApproveAll = async (req, res, next) => {
  try {
    const Employee = getEmployeeModel();
    const approverId =
      req.user?.userId ||
      req.user?.id ||
      req.body?.approverId ||
      req.query?.approverId;
    const { comments } = req.body || {};

    if (!approverId || approverId === "undefined" || approverId === "null") {
      return next(new AppError("Approver ID is required", 400));
    }

    // Get all employees where this user is an approver at any level
    const allEmployees = await Employee.findAll({
      where: {
        isActive: true,
        [Op.or]: [
          { level1ApproverId: approverId },
          { level2ApproverId: approverId },
          { level3ApproverId: approverId },
          { level4ApproverId: approverId },
          { level5ApproverId: approverId },
        ],
      },
    });

    // Filter to those where this user is the NEXT pending approver
    const eligibleEmployees = allEmployees.filter((emp) => {
      const nextLevel = getNextApprovalLevel(emp);
      return (
        nextLevel && nextLevel.approverId.toString() === approverId.toString()
      );
    });

    if (eligibleEmployees.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No employees found awaiting your approval",
        count: 0,
      });
    }

    // Get approver details for history logging
    const approverDetails = await Employee.findByPk(approverId, {
      attributes: ["id", "fullName", "employeeId"],
    });

    let approvedCount = 0;
    for (const employee of eligibleEmployees) {
      const nextLevel = getNextApprovalLevel(employee);
      if (nextLevel) {
        // Convert to plain object to avoid circular references
        const existingStatus = employee.approvalStatus
          ? JSON.parse(JSON.stringify(employee.approvalStatus))
          : {};

        const levelKey = `level${nextLevel.level}`;
        existingStatus[levelKey] = {
          ...(existingStatus[levelKey] || {}),
          status: "approved",
          approvedBy: approverId,
          approvedAt: new Date(),
          comments: comments || existingStatus[levelKey]?.comments,
        };

        // Add to merit history
        const history = employee.meritHistory || [];
        const meritValue = employee.salaryType === "Hourly"
          ? employee.meritIncreaseDollar
          : employee.meritIncreasePercentage;

        history.push({
          timestamp: new Date(),
          action: "approved",
          level: nextLevel.level,
          actor: {
            id: approverId,
            name: approverDetails?.fullName || "Unknown",
            employeeId: approverDetails?.employeeId || "N/A",
          },
          meritValue: meritValue,
          salaryType: employee.salaryType,
          comments: comments || null,
          bulkApproval: true,
        });

        // Update employee instance and save (use .save() to trigger setters properly)
        employee.approvalStatus = existingStatus;
        employee.meritHistory = history;
        await employee.save();
        approvedCount++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully approved merits for ${approvedCount} employees`,
      approvedCount: approvedCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check if all approvals are completed for UKG export
// @route   GET /api/v2/employees/ukg/approvals-status
// @access  Private (HR/Admin only)
export const checkAllApprovalsCompleted = async (req, res, next) => {
  try {
    const Employee = getEmployeeModel();

    // Find all active employees with merits
    const employeesWithMerits = await Employee.findAll({
      where: {
        isActive: true,
        [Op.or]: [
          { meritIncreasePercentage: { [Op.gt]: 0 } },
          { meritIncreaseDollar: { [Op.gt]: 0 } },
        ],
      },
    });

    if (employeesWithMerits.length === 0) {
      return res.status(200).json({
        success: true,
        allApprovalsCompleted: false,
        message: "No employees with merits found. Please add merits before exporting.",
        pendingEmployees: [],
      });
    }

    const pendingEmployees = [];

    // Check if ALL employees have ALL their approval levels completed
    for (const employee of employeesWithMerits) {
      const approvalStatus = employee.approvalStatus || {};

      // Check if submitted for approval
      if (!approvalStatus.submittedForApproval) {
        pendingEmployees.push({
          employeeId: employee.employeeId,
          fullName: employee.fullName,
          reason: "Not submitted for approval",
        });
        continue;
      }

      // Check each approval level that has an approver
      for (let level = 1; level <= 5; level++) {
        const levelKey = `level${level}`;
        const approverIdField = `${levelKey}ApproverId`;

        // If this level has an approver assigned
        if (employee[approverIdField]) {
          const levelStatus = approvalStatus[levelKey]?.status;

          // If this level is not approved, add to pending
          if (levelStatus !== "approved") {
            pendingEmployees.push({
              employeeId: employee.employeeId,
              fullName: employee.fullName,
              reason: `Level ${level} approval pending`,
              pendingLevel: level,
            });
            break; // No need to check further levels for this employee
          }
        }
      }
    }

    const allApprovalsCompleted = pendingEmployees.length === 0;

    res.status(200).json({
      success: true,
      allApprovalsCompleted,
      totalEmployeesWithMerits: employeesWithMerits.length,
      pendingEmployees,
      message: allApprovalsCompleted
        ? "All approvals completed. Export is ready."
        : "Some employees still have pending approvals",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resubmit merit with revised amount AND auto-approve the recipient's own level
// @route   POST /api/v2/employees/:id/resubmit-and-approve
// @access  Public (uses actorId query/body param)
export const resubmitAndApprove = async (req, res, next) => {
  try {
    const Employee = getEmployeeModel();
    const { id } = req.params;
    const { meritIncreasePercentage, meritIncreaseDollar, comments, notificationId } = req.body || {};
    const actorId =
      req.user?.userId ||
      req.user?.id ||
      req.body?.actorId ||
      req.query?.actorId;

    if (!actorId || actorId === "undefined" || actorId === "null") {
      return next(new AppError("Actor ID is required", 400));
    }

    // Validate that at least one merit value is provided
    if (
      (meritIncreasePercentage === undefined || meritIncreasePercentage === null) &&
      (meritIncreaseDollar === undefined || meritIncreaseDollar === null)
    ) {
      return next(new AppError("Merit increase (percentage or dollar amount) is required", 400));
    }

    // Validate non-negative values
    if (
      (meritIncreasePercentage !== undefined &&
        meritIncreasePercentage !== null &&
        parseFloat(meritIncreasePercentage) < 0) ||
      (meritIncreaseDollar !== undefined &&
        meritIncreaseDollar !== null &&
        parseFloat(meritIncreaseDollar) < 0)
    ) {
      return next(new AppError("Merit increase cannot be negative", 400));
    }

    const employee = await Employee.findByPk(id);
    if (!employee) {
      return next(new AppError("Employee not found", 404));
    }

    // Determine the actor's role for this employee:
    // They may be the supervisor (level 0) or a level 1-5 approver
    let actorLevel = null; // null = supervisor role

    // Check if actor is a level approver for this employee
    for (let level = 1; level <= 5; level++) {
      if (employee[`level${level}ApproverId`]?.toString() === actorId.toString()) {
        actorLevel = level;
        break;
      }
    }

    // If not an approver, check if they are the supervisor
    const isSupervisor =
      employee.supervisorId?.toString() === actorId.toString();

    if (actorLevel === null && !isSupervisor) {
      return next(
        new AppError("You are not authorized to resubmit for this employee", 403)
      );
    }

    // ── Step 1: Calculate and update the merit amount ──────────────────────────
    let newAnnualSalary = 0;
    let newHourlyRate = 0;
    let finalMeritPercentage = 0;
    let finalMeritDollar = 0;

    // Determine employee type and calculate accordingly
    if (employee.salaryType === "Hourly") {
      // For hourly employees, use dollar increase
      if (meritIncreaseDollar !== undefined && meritIncreaseDollar !== null) {
        finalMeritDollar = parseFloat(meritIncreaseDollar);
        newHourlyRate = (parseFloat(employee.hourlyPayRate) || 0) + finalMeritDollar;
      }
    } else {
      // For salaried employees (Salary or Salaried), use percentage increase
      if (meritIncreasePercentage !== undefined && meritIncreasePercentage !== null) {
        finalMeritPercentage = parseFloat(meritIncreasePercentage);
        const currentSalary = parseFloat(employee.annualSalary) || 0;
        newAnnualSalary = currentSalary * (1 + finalMeritPercentage / 100);
      }
    }

    // Get actor details for history logging
    const actorDetails = await Employee.findByPk(actorId, {
      attributes: ["id", "fullName", "employeeId"],
    });

    // Store old values for history
    const oldMeritPercentage = employee.meritIncreasePercentage;
    const oldMeritDollar = employee.meritIncreaseDollar;

    // Build fresh approval status: submitted=true, all levels reset to pending
    const newStatus = {
      submittedForApproval: true,
      submittedAt: new Date(),
      enteredBy: actorId,
      enteredAt: new Date(),
    };

    if (employee.level1ApproverId)
      newStatus.level1 = { status: "pending", approvedBy: null, approvedAt: null, comments: null };
    if (employee.level2ApproverId)
      newStatus.level2 = { status: "pending", approvedBy: null, approvedAt: null, comments: null };
    if (employee.level3ApproverId)
      newStatus.level3 = { status: "pending", approvedBy: null, approvedAt: null, comments: null };
    if (employee.level4ApproverId)
      newStatus.level4 = { status: "pending", approvedBy: null, approvedAt: null, comments: null };
    if (employee.level5ApproverId)
      newStatus.level5 = { status: "pending", approvedBy: null, approvedAt: null, comments: null };

    // ── Step 2: If actor is a level approver, auto-approve their level ────────
    // (Supervisor at level 0 just submits — Level 1 will need to approve)
    if (actorLevel !== null) {
      // Auto-approve all levels BEFORE the actor's level (they would have already approved these)
      // Then auto-approve the actor's own level
      for (let lvl = 1; lvl <= actorLevel; lvl++) {
        const lk = `level${lvl}`;
        if (newStatus[lk]) {
          if (lvl < actorLevel) {
            // Previous levels: mark as approved by actor (they resubmitted = endorsing up to their level)
            newStatus[lk] = {
              status: "approved",
              approvedBy: actorId,
              approvedAt: new Date(),
              comments: lvl === actorLevel ? (comments || null) : null,
            };
          } else {
            // Actor's own level: approved with their comments
            newStatus[lk] = {
              status: "approved",
              approvedBy: actorId,
              approvedAt: new Date(),
              comments: comments || null,
            };
          }
        }
      }
    }

    // Add to merit history
    const history = employee.meritHistory || [];
    const oldValue = employee.salaryType === "Hourly" ? oldMeritDollar : oldMeritPercentage;
    const newValue = employee.salaryType === "Hourly" ? finalMeritDollar : finalMeritPercentage;

    history.push({
      timestamp: new Date(),
      action: "resubmitted_and_approved",
      level: actorLevel === null ? 0 : actorLevel,
      actor: {
        id: actorId,
        name: actorDetails?.fullName || "Unknown",
        employeeId: actorDetails?.employeeId || "N/A",
      },
      oldValue: oldValue,
      newValue: newValue,
      salaryType: employee.salaryType,
      comments: comments || null,
    });

    // Update employee instance and save (use .save() to trigger setters properly)
    employee.meritIncreasePercentage = finalMeritPercentage;
    employee.meritIncreaseDollar = finalMeritDollar;
    employee.newAnnualSalary = newAnnualSalary;
    employee.newHourlyRate = newHourlyRate;
    employee.approvalStatus = newStatus;
    employee.meritHistory = history;
    await employee.save();

    // ── Step 3: Mark notification as read ────────────────────────────────────
    if (notificationId) {
      await markNotificationRead(notificationId);
    }

    // ── Step 4: Notify next approver ─────────────────────────────────────────
    const nextApprover = getNextApprovalLevel(employee);
    if (nextApprover) {
      const nextApproverDetails = await Employee.findByPk(nextApprover.approverId);
      if (nextApproverDetails?.email) {
        // Format merit display
        const meritDisplay = employee.salaryType === 'Hourly'
          ? `$${finalMeritDollar}/hr`
          : `${finalMeritPercentage}%`;

        // Send notification
        try {
          await createNotification({
            recipientId: nextApprover.approverId,
            type: 'merit_resubmitted',
            title: `Merit Resubmitted - Review Required`,
            message: `Merit for ${employee.fullName} has been resubmitted. Please review.`,
            payload: {
              employeeDbId: employee.id,
              employeeId: employee.employeeId,
              employeeName: employee.fullName,
              meritAmount: meritDisplay,
              level: nextApprover.level
            }
          });
          console.log('✅ Sent resubmitted notification to:', nextApproverDetails.fullName);
        } catch (notifError) {
          console.error('❌ Failed to create resubmitted notification:', notifError);
        }

        // Send email
        try {
          await sendMeritResubmittedEmail({
            toEmail: nextApproverDetails.email,
            toName: nextApproverDetails.fullName,
            employeeName: employee.fullName,
            employeeId: employee.employeeId,
            newMeritAmount: meritDisplay,
            resubmittedBy: actorDetails?.fullName || 'Unknown',
            approverLevel: nextApprover.level
          });
          console.log('✅ Sent resubmitted email to:', nextApproverDetails.email);
        } catch (emailError) {
          console.error('❌ Failed to send resubmitted email:', emailError);
        }
      }
    }

    // Build label for response message
    const levelLabel =
      actorLevel === null
        ? "Supervisor"
        : `Level ${actorLevel} Approver`;

    const nextPendingLevel = actorLevel === null ? 1 : actorLevel + 1;
    const hasNextLevel = !!employee[`level${nextPendingLevel}ApproverId`];

    // Determine the merit value for response
    const newMerit = employee.salaryType === "Hourly" ? finalMeritDollar : finalMeritPercentage;

    res.status(200).json({
      success: true,
      message: hasNextLevel
        ? `Merit updated and approved at ${levelLabel} level. Now awaiting Level ${nextPendingLevel} approval.`
        : `Merit updated and approved by ${levelLabel}. All approvals complete!`,
      data: { employeeId: employee.employeeId, newMerit, actorLevel, levelLabel },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export all employee data to UKG Excel format
// @route   GET /api/v2/employees/ukg/export
// @access  Private (HR/Admin only)
export const exportToUKG = async (req, res, next) => {
  try {
    const XLSX = await import("xlsx");
    const Employee = getEmployeeModel();

    // Get all active employees
    const employees = await Employee.findAll({
      where: { isActive: true },
      order: [["employeeId", "ASC"]],
    });

    // Map employees to UKG template format
    const excelData = employees.map((emp) => ({
      "Employee Name": emp.fullName || "",
      "Work Email": emp.email || "",
      SSN: emp.ssn || "",
      Company: emp.company || "",
      "Company Code": emp.companyCode || "",
      "Supervisor Name": emp.supervisorName || "",
      Location: emp.location || "",
      "1st Reporting": emp.level1ApproverName || "",
      "2nd Reporting": emp.level2ApproverName || "",
      "3rd Reporting": emp.level3ApproverName || "",
      "4th Reporting": emp.level4ApproverName || "",
      "5th Reporting": emp.level5ApproverName || "",
      "State/Province": emp.addressState || "",
      "Last Hire Date": emp.lastHireDate || "",
      "Employee Type": emp.employeeType || "",
      "Job Title": emp.jobTitle || "",
      "Salary or Hourly": emp.salaryType || "",
      "Annual Salary": emp.annualSalary || 0,
      "Hourly Pay Rate": emp.hourlyPayRate || 0,
      "Merit Increase %": emp.meritIncreasePercentage || 0,
      "Merit Increase $": emp.meritIncreaseDollar || 0,
      "New Annual Salary": emp.newAnnualSalary || 0,
      "New Hourly Rate": emp.newHourlyRate || 0,
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Employees");

    // Generate buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Set headers for file download
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=UKG_Export_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

// @desc    Modify merit and approve at current level (keeps higher-level approvals intact)
// @route   POST /api/v2/employees/:employeeId/modify-and-approve
// @access  Private (Approver only)
export const modifyAndApproveMerit = async (req, res, next) => {
  try {
    const Employee = getEmployeeModel();
    const { employeeId } = req.params;
    const { meritIncreasePercentage, meritIncreaseDollar, comments, approverId: bodyApproverId, level } = req.body || {};
    const approverId =
      req.user?.userId ||
      req.user?.id ||
      bodyApproverId ||
      req.query?.approverId;

    if (!approverId || approverId === "undefined" || approverId === "null") {
      return next(new AppError("Approver ID is required", 400));
    }

    // Validate that at least one merit value is provided
    if (
      (meritIncreasePercentage === undefined || meritIncreasePercentage === null) &&
      (meritIncreaseDollar === undefined || meritIncreaseDollar === null)
    ) {
      return next(
        new AppError("Merit increase (percentage or dollar amount) is required", 400)
      );
    }

    const employee = await Employee.findByPk(employeeId, {
      include: [
        { model: Employee, as: "level1Approver", attributes: ["id", "fullName", "employeeId"] },
        { model: Employee, as: "level2Approver", attributes: ["id", "fullName", "employeeId"] },
        { model: Employee, as: "level3Approver", attributes: ["id", "fullName", "employeeId"] },
        { model: Employee, as: "level4Approver", attributes: ["id", "fullName", "employeeId"] },
        { model: Employee, as: "level5Approver", attributes: ["id", "fullName", "employeeId"] },
      ],
    });

    if (!employee) {
      return next(new AppError("Employee not found", 404));
    }

    // Get approver details for history logging
    const approverDetails = await Employee.findByPk(approverId, {
      attributes: ["id", "fullName", "employeeId"],
    });

    // Determine approver level
    let approverLevel = level;
    if (!approverLevel) {
      for (let lvl = 1; lvl <= 5; lvl++) {
        if (employee[`level${lvl}ApproverId`]?.toString() === approverId.toString()) {
          approverLevel = lvl;
          break;
        }
      }
    }

    if (!approverLevel) {
      return next(
        new AppError("You are not authorized to modify merit for this employee", 403)
      );
    }

    // Store old values for history
    const oldMeritPercentage = employee.meritIncreasePercentage;
    const oldMeritDollar = employee.meritIncreaseDollar;

    // Calculate new merit values
    let newAnnualSalary = 0;
    let newHourlyRate = 0;
    let finalMeritPercentage = 0;
    let finalMeritDollar = 0;

    if (employee.salaryType === "Hourly") {
      if (meritIncreaseDollar !== undefined && meritIncreaseDollar !== null) {
        finalMeritDollar = parseFloat(meritIncreaseDollar);
        newHourlyRate = (parseFloat(employee.hourlyPayRate) || 0) + finalMeritDollar;
      }
    } else {
      if (meritIncreasePercentage !== undefined && meritIncreasePercentage !== null) {
        finalMeritPercentage = parseFloat(meritIncreasePercentage);
        const currentSalary = parseFloat(employee.annualSalary) || 0;
        newAnnualSalary = currentSalary * (1 + finalMeritPercentage / 100);
      }
    }

    // Check if the merit value is the same as the current value (prevent modifying with same value)
    if (employee.salaryType === "Hourly") {
      if (oldMeritDollar !== null && oldMeritDollar !== undefined && parseFloat(oldMeritDollar) === finalMeritDollar) {
        return next(
          new AppError(
            `Merit value is already $${finalMeritDollar}/hr. Please enter a different value to modify.`,
            400
          )
        );
      }
    } else {
      if (oldMeritPercentage !== null && oldMeritPercentage !== undefined && parseFloat(oldMeritPercentage) === finalMeritPercentage) {
        return next(
          new AppError(
            `Merit value is already ${finalMeritPercentage}%. Please enter a different value to modify.`,
            400
          )
        );
      }
    }

    // Update approval status - keep higher-level approvals intact
    const existingStatus = employee.approvalStatus
      ? JSON.parse(JSON.stringify(employee.approvalStatus))
      : {};

    const levelKey = `level${approverLevel}`;
    existingStatus[levelKey] = {
      ...(existingStatus[levelKey] || {}),
      status: "approved",
      approvedBy: approverId,
      approvedAt: new Date(),
      comments: comments || null,
      modified: true,
      modifiedAt: new Date(),
    };

    // Add to merit history
    const history = employee.meritHistory || [];

    console.log('🔍 [MODIFY-AND-APPROVE DEBUG] Employee:', employee.employeeId, employee.fullName);
    console.log('🔍 [MODIFY-AND-APPROVE DEBUG] Approver Level:', approverLevel);
    console.log('🔍 [MODIFY-AND-APPROVE DEBUG] Merit history BEFORE push:', JSON.stringify(history, null, 2));

    history.push({
      timestamp: new Date(),
      action: "modified_and_approved",
      level: approverLevel,
      actor: {
        id: approverId,
        name: approverDetails?.fullName || "Unknown",
        employeeId: approverDetails?.employeeId || "N/A",
      },
      oldValue: employee.salaryType === "Hourly" ? oldMeritDollar : oldMeritPercentage,
      newValue: employee.salaryType === "Hourly" ? finalMeritDollar : finalMeritPercentage,
      salaryType: employee.salaryType,
      comments: comments || null,
    });

    console.log('🔍 [MODIFY-AND-APPROVE DEBUG] Merit history AFTER push:', JSON.stringify(history, null, 2));

    // Update employee instance and save (use .save() to trigger setters properly)
    employee.meritIncreasePercentage = finalMeritPercentage;
    employee.meritIncreaseDollar = finalMeritDollar;
    employee.newAnnualSalary = newAnnualSalary;
    employee.newHourlyRate = newHourlyRate;
    employee.approvalStatus = existingStatus;
    employee.meritHistory = history;

    console.log('🔍 [MODIFY-AND-APPROVE DEBUG] About to save employee...');
    await employee.save();
    console.log('✅ [MODIFY-AND-APPROVE DEBUG] Employee saved successfully!');

    // ── Notify next approver about modification ──────────────────────────────
    const nextApprover = getNextApprovalLevel(employee);
    if (nextApprover) {
      const nextApproverDetails = await Employee.findByPk(nextApprover.approverId);
      if (nextApproverDetails?.email) {
        // Format merit display
        const meritDisplay = employee.salaryType === 'Hourly'
          ? `$${finalMeritDollar}/hr`
          : `${finalMeritPercentage}%`;

        // Send notification
        try {
          await createNotification({
            recipientId: nextApprover.approverId,
            type: 'merit_modified',
            title: `Merit Modified - Review Required`,
            message: `Merit for ${employee.fullName} has been modified by Level ${approverLevel}. Please review.`,
            payload: {
              employeeDbId: employee.id,
              employeeId: employee.employeeId,
              employeeName: employee.fullName,
              meritAmount: meritDisplay,
              modifiedBy: approverDetails?.fullName || 'Unknown',
              level: nextApprover.level
            }
          });
          console.log('✅ Sent modified notification to:', nextApproverDetails.fullName);
        } catch (notifError) {
          console.error('❌ Failed to create modified notification:', notifError);
        }

        // Send email
        try {
          await sendMeritModifiedEmail({
            toEmail: nextApproverDetails.email,
            toName: nextApproverDetails.fullName,
            employeeName: employee.fullName,
            employeeId: employee.employeeId,
            modifiedAmount: meritDisplay,
            modifiedBy: approverDetails?.fullName || 'Unknown',
            approverLevel: nextApprover.level
          });
          console.log('✅ Sent modified email to:', nextApproverDetails.email);
        } catch (emailError) {
          console.error('❌ Failed to send modified email:', emailError);
        }
      }
    }

    const updatedEmployee = await Employee.findByPk(employeeId, {
      attributes: { exclude: ["password"] },
      include: [
        { model: Employee, as: "level1Approver", attributes: ["id", "fullName", "employeeId"] },
        { model: Employee, as: "level2Approver", attributes: ["id", "fullName", "employeeId"] },
        { model: Employee, as: "level3Approver", attributes: ["id", "fullName", "employeeId"] },
        { model: Employee, as: "level4Approver", attributes: ["id", "fullName", "employeeId"] },
        { model: Employee, as: "level5Approver", attributes: ["id", "fullName", "employeeId"] },
      ],
    });

    console.log('🔍 [MODIFY-AND-APPROVE DEBUG] Updated employee from DB - merit history:', JSON.stringify(updatedEmployee.meritHistory, null, 2));

    res.status(200).json({
      success: true,
      message: `Merit modified and approved successfully at level ${approverLevel}`,
      data: updatedEmployee,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete all employees except hr@pvschemicals.com
// @route   DELETE /api/v2/employees/delete-all
// @access  Private (HR Admin only - hr@pvschemicals.com)
export const deleteAllEmployees = async (req, res, next) => {
  try {
    const Employee = getEmployeeModel();
    const Notification = getNotification();

    // Get IDs of employees to be deleted (for notification cleanup)
    const employeesToDelete = await Employee.findAll({
      where: {
        [Op.or]: [
          { email: { [Op.ne]: "hr@pvschemicals.com" } },
          { email: null },
        ],
      },
      attributes: ['id'],
    });

    const employeeIds = employeesToDelete.map(emp => emp.id);

    // Delete all employees except hr@pvschemicals.com
    // Using OR condition to handle NULL emails and non-matching emails
    const deletedCount = await Employee.destroy({
      where: {
        [Op.or]: [
          { email: { [Op.ne]: "hr@pvschemicals.com" } },
          { email: null },
        ],
      },
    });

    // Delete all notifications related to deleted employees
    let deletedNotificationCount = 0;
    if (employeeIds.length > 0) {
      // Build OR conditions for each employeeDbId in payload
      const payloadConditions = employeeIds.map(id => ({
        payload: { [Op.like]: `%"employeeDbId":${id}%` }
      }));

      deletedNotificationCount = await Notification.destroy({
        where: {
          [Op.or]: [
            { recipientId: { [Op.in]: employeeIds } }, // Notifications sent to deleted employees
            ...payloadConditions, // Notifications about deleted employees
          ],
        },
      });
    }

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${deletedCount} employees and ${deletedNotificationCount} related notifications`,
      deletedCount,
      deletedNotificationCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset all merit data to upload state (clear all merits, approvals, and history)
// @route   POST /api/v2/employees/reset-merits
// @access  Private (HR Admin only)
export const resetMeritData = async (req, res, next) => {
  try {
    const Employee = getEmployeeModel();

    // Reset all merit-related fields to their initial state
    const [updateCount] = await Employee.update(
      {
        meritIncreasePercentage: 0,
        meritIncreaseDollar: 0,
        newAnnualSalary: 0,
        newHourlyRate: 0,
        approvalStatus: null,
        meritHistory: null,
      },
      {
        where: {
          [Op.or]: [
            { email: { [Op.ne]: "hr@pvschemicals.com" } },
            { email: null },
          ],
        },
      },
    );

    res.status(200).json({
      success: true,
      message: `Successfully reset merit data for ${updateCount} employees. All merit increases, approvals, and history have been cleared.`,
      resetCount: updateCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset supervisor's employees merit data (clear merits, approvals, and history only for their team)
// @route   POST /api/v2/employees/supervisor/reset-merits
// @access  Private (Supervisor)
export const resetSupervisorMeritData = async (req, res, next) => {
  try {
    const Employee = getEmployeeModel();
    const supervisorId =
      req.user?.userId ||
      req.user?.id ||
      req.body?.supervisorId ||
      req.query?.supervisorId;

    if (!supervisorId || supervisorId === "undefined" || supervisorId === "null") {
      return next(new AppError("Supervisor ID is required", 400));
    }

    const [updateCount] = await Employee.update(
      {
        meritIncreasePercentage: 0,
        meritIncreaseDollar: 0,
        newAnnualSalary: 0,
        newHourlyRate: 0,
        approvalStatus: null,
        meritHistory: null,
      },
      {
        where: {
          supervisorId: supervisorId,
          isActive: true,
          id: { [Op.ne]: supervisorId }, // Exclude themselves
        },
      }
    );

    res.status(200).json({
      success: true,
      message: `Successfully reset merit data for ${updateCount} employees.`,
      resetCount: updateCount,
    });
  } catch (error) {
    next(error);
  }
};
