import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Chip,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PendingIcon from "@mui/icons-material/Pending";
import CancelIcon from "@mui/icons-material/Cancel";
import { useSelector } from "react-redux";
import { selectUser } from "../../store/slices/userSlice";
import api from "../../utils/api";

const Merits = () => {
  const user = useSelector(selectUser);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [meritDialog, setMeritDialog] = useState({
    open: false,
    employee: null,
  });
  const [meritAmount, setMeritAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [proceedingForApproval, setProceedingForApproval] = useState(false);

  const fetchMyTeam = async () => {
    setLoading(true);
    setError("");

    try {
      const userId = user?.id || user?._id;
      const response = await api.get(
        `/v2/employees/supervisor/my-team?supervisorId=${userId}`,
      );

      setEmployees(response.data.data);
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "An error occurred while fetching employees";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id || user?._id) {
      fetchMyTeam();
    }
  }, [user]);

  const handleOpenMeritDialog = (employee) => {
    setMeritDialog({
      open: true,
      employee,
    });
    // Set merit amount based on employee type
    if (employee.salaryType === "Hourly") {
      setMeritAmount(employee.meritIncreaseDollar || "");
    } else {
      setMeritAmount(employee.meritIncreasePercentage || "");
    }
  };

  const handleCloseMeritDialog = () => {
    setMeritDialog({
      open: false,
      employee: null,
    });
    setMeritAmount("");
  };

  const handleSubmitMerit = async () => {
    if (!meritAmount || parseFloat(meritAmount) < 0) {
      setError("Please enter a valid merit amount");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const userId = user?.id || user?._id;

      // Build payload based on employee type
      const payload = {};
      if (meritDialog.employee.salaryType === "Hourly") {
        payload.meritIncreaseDollar = parseFloat(meritAmount);
      } else {
        payload.meritIncreasePercentage = parseFloat(meritAmount);
      }

      await api.put(
        `/v2/employees/${meritDialog.employee.id}/merit?supervisorId=${userId}`,
        payload,
      );

      // Refresh the employee list
      await fetchMyTeam();
      handleCloseMeritDialog();
      setSuccess("Merit saved successfully");
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "An error occurred while updating merit";
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleProceedForApproval = async () => {
    setProceedingForApproval(true);
    setError("");
    setSuccess("");

    try {
      const userId = user?.id || user?._id;

      const response = await api.post(
        `/v2/employees/supervisor/submit-for-approval?supervisorId=${userId}`,
      );

      setSuccess(response.data.message);
      await fetchMyTeam();
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "An error occurred while submitting merits for approval";
      setError(errorMessage);
    } finally {
      setProceedingForApproval(false);
    }
  };

  const getApprovalStatus = (employee) => {
    if (!employee)
      return { status: "not_entered", label: "Not Entered", color: "default" };

    // A merit is considered entered if ANY of these are true:
    // 1. enteredBy metadata is present
    // 2. A merit amount (percentage or dollar) is actually set (non-zero)
    // 3. Any approval level is no longer 'not_required'
    const hasMetadata = !!employee.approvalStatus?.enteredBy;
    const hasMeritValue =
      (employee.meritIncreasePercentage && parseFloat(employee.meritIncreasePercentage) > 0) ||
      (employee.meritIncreaseDollar && parseFloat(employee.meritIncreaseDollar) > 0);

    // Check if any level is active (pending, approved, or rejected)
    const levels = ["level1", "level2", "level3", "level4", "level5"];
    const hasActiveProcess = levels.some((lvl) => {
      const status = employee.approvalStatus?.[lvl]?.status;
      return status && !["pending", "unknown"].includes(status);
    });

    if (!hasMetadata && !hasMeritValue && !hasActiveProcess) {
      return { status: "not_entered", label: "Not Entered", color: "default" };
    }

    // Check all approval levels and track progress
    let approvedCount = 0;
    let totalRequired = 0;
    let currentStage = null;
    let anyRejected = false;

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const approverField = `${level}Approver`;
      const status = employee.approvalStatus?.[level]?.status;

      // Check if this level has an approver
      if (employee[approverField]) {
        totalRequired++;

        if (status === "rejected") {
          anyRejected = true;
          break;
        }

        if (status === "approved") {
          approvedCount++;
        } else if (status === "pending") {
          if (!currentStage) {
            currentStage = i + 1;
          }
        }
      }
    }

    if (anyRejected) {
      return { status: "rejected", label: "Rejected", color: "error" };
    }

    if (approvedCount === totalRequired && totalRequired > 0) {
      return { status: "approved", label: "Fully Approved", color: "success" };
    }

    if (currentStage) {
      return {
        status: "pending",
        label: `Level ${currentStage} - ${approvedCount}/${totalRequired} Approved`,
        color: "warning",
      };
    }

    return { status: "unknown", label: "Unknown", color: "default" };
  };

  const getNextApprover = (employee) => {
    if (!employee || !employee.approvalStatus?.enteredBy) {
      return "N/A";
    }

    const levels = [
      { key: "level1", approver: employee.level1Approver },
      { key: "level2", approver: employee.level2Approver },
      { key: "level3", approver: employee.level3Approver },
      { key: "level4", approver: employee.level4Approver },
      { key: "level5", approver: employee.level5Approver },
    ];

    for (const level of levels) {
      const status = employee.approvalStatus?.[level.key]?.status;

      // Check if this level has an approver assigned
      if (level.approver) {
        // If status is pending at this level, this is the next approver
        if (status === "pending") {
          return `${level.approver.fullName} (${level.approver.employeeId})`;
        }

        // If rejected, show that
        if (status === "rejected") {
          return "Rejected";
        }

        // If not approved yet and not pending, there's an issue
        if (status !== "approved") {
          return "Pending";
        }
      }
    }

    return "All Approved";
  };

  const columns = [
    {
      field: "slNo",
      headerName: "Sl No",
      width: 80,
      minWidth: 80,
      flex: 0.4,
      renderCell: (params) => {
        const index = employees.findIndex((emp) => emp.id === params.row.id);
        return index + 1;
      },
    },
    {
      field: "fullName",
      headerName: "Name",
      width: 200,
      minWidth: 150,
      flex: 1.2,
    },
    {
      field: "jobTitle",
      headerName: "Job Title",
      width: 180,
      minWidth: 150,
      flex: 1,
      renderCell: (params) => params.row.jobTitle || "N/A",
    },
    {
      field: "salaryType",
      headerName: "Salary Type",
      width: 130,
      minWidth: 120,
      flex: 0.7,
      renderCell: (params) => params.row.salaryType || "N/A",
    },
    {
      field: "currentSalary",
      headerName: "Current Salary",
      width: 150,
      minWidth: 130,
      flex: 0.8,
      renderCell: (params) => {
        if (params.row.salaryType === "Hourly") {
          const rate = params.row.hourlyPayRate || 0;
          return rate > 0 ? `$${rate.toFixed(2)}/hr` : "N/A";
        } else {
          const salary = params.row.annualSalary || 0;
          return salary > 0 ? `$${salary.toLocaleString()}` : "N/A";
        }
      },
    },
    {
      field: "meritIncrease",
      headerName: "Merit Increase",
      width: 180,
      minWidth: 160,
      flex: 1,
      renderCell: (params) => {
        if (params.row.salaryType === "Hourly") {
          const merit = params.row.meritIncreaseDollar || 0;
          return merit > 0 ? `$${merit.toFixed(2)}/hr` : "-";
        } else {
          const merit = params.row.meritIncreasePercentage || 0;
          const annualSalary = params.row.annualSalary || 0;
          if (merit === 0) return "-";
          // Calculate dollar amount from percentage
          const dollarAmount = (annualSalary * merit) / 100;
          return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3 }}>
              <Typography sx={{ fontWeight: "bold", fontSize: "0.875rem" }}>
                {merit}%
              </Typography>
              <Typography sx={{ fontSize: "0.7rem", color: "text.secondary" }}>
                (${dollarAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
              </Typography>
            </Box>
          );
        }
      },
    },
    {
      field: "newSalary",
      headerName: "New Salary",
      width: 150,
      minWidth: 130,
      flex: 0.8,
      renderCell: (params) => {
        if (params.row.salaryType === "Hourly") {
          const newRate = params.row.newHourlyRate || 0;
          return newRate > 0 ? `$${newRate.toFixed(2)}/hr` : "-";
        } else {
          const newSalary = params.row.newAnnualSalary || 0;
          return newSalary > 0 ? `$${newSalary.toLocaleString()}` : "-";
        }
      },
    },
    {
      field: "variance",
      headerName: "Variance from 3%",
      width: 180,
      minWidth: 160,
      flex: 1,
      renderCell: (params) => {
        // For salaried employees, variance is direct comparison to 3%
        if (params.row.salaryType !== "Hourly") {
          const merit = params.row.meritIncreasePercentage || 0;
          // Only show variance if merit has been entered
          if (merit === 0) {
            return "-";
          }
          const variance = merit - 3;
          const color = variance > 0 ? "error.main" : "success.main";
          const label = variance > 0 ? "Above Limit" : "Within Limit";
          return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3 }}>
              <Typography sx={{ color, fontWeight: "bold", fontSize: "0.875rem" }}>
                {variance > 0 ? "+" : ""}{variance.toFixed(2)}%
              </Typography>
              <Typography sx={{ color, fontSize: "0.7rem", fontStyle: "italic" }}>
                {label}
              </Typography>
            </Box>
          );
        } else {
          // For hourly employees, calculate percentage increase and compare to 3%
          const currentRate = params.row.hourlyPayRate || 0;
          const meritDollar = params.row.meritIncreaseDollar || 0;
          // Only show variance if merit has been entered
          if (currentRate === 0 || meritDollar === 0) {
            return "-";
          }
          const percentIncrease = (meritDollar / currentRate) * 100;
          const variance = percentIncrease - 3;
          const color = variance > 0 ? "error.main" : "success.main";
          const label = variance > 0 ? "Above Limit" : "Within Limit";
          return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3 }}>
              <Typography sx={{ color, fontWeight: "bold", fontSize: "0.875rem" }}>
                {variance > 0 ? "+" : ""}{variance.toFixed(2)}%
              </Typography>
              <Typography sx={{ color, fontSize: "0.7rem", fontStyle: "italic" }}>
                {label}
              </Typography>
            </Box>
          );
        }
      },
    },
    // {
    //   field: "approvalStatus",
    //   headerName: "Approval Status",
    //   width: 150,
    //   flex: 0.8,
    //   renderCell: (params) => {
    //     const approvalInfo = getApprovalStatus(params.row);
    //     return (
    //       <Chip
    //         label={approvalInfo.label}
    //         color={approvalInfo.color}
    //         size="small"
    //         icon={
    //           approvalInfo.status === "approved" ? (
    //             <CheckCircleIcon />
    //           ) : approvalInfo.status === "pending" ? (
    //             <PendingIcon />
    //           ) : approvalInfo.status === "rejected" ? (
    //             <CancelIcon />
    //           ) : null
    //         }
    //       />
    //     );
    //   },
    // },
    // {
    //   field: "nextApprover",
    //   headerName: "Next Approver",
    //   width: 200,
    //   flex: 1.2,
    //   renderCell: (params) => getNextApprover(params.row),
    // },
    {
      field: "actions",
      headerName: "Actions",
      width: 140,
      minWidth: 120,
      flex: 0.5,
      sortable: false,
      renderCell: (params) => {
        const isSubmitted = params.row.approvalStatus?.submittedForApproval;

        // If already submitted for approval, disable editing
        if (isSubmitted) {
          return (
            <Tooltip title="Merit has been submitted for approval and is locked">
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  disabled
                  sx={{ fontSize: "0.75rem", py: 0.5, minWidth: "auto" }}
                >
                  Locked
                </Button>
              </span>
            </Tooltip>
          );
        }

        // If merit is not entered yet, show "Add Merit" button
        const hasMeritValue =
          (params.row.meritIncreasePercentage && parseFloat(params.row.meritIncreasePercentage) > 0) ||
          (params.row.meritIncreaseDollar && parseFloat(params.row.meritIncreaseDollar) > 0);
        if (!hasMeritValue) {
          return (
            <Button
              variant="contained"
              size="small"
              onClick={() => handleOpenMeritDialog(params.row)}
              sx={{ fontSize: "0.75rem", py: 0.5, minWidth: "auto" }}
            >
              Add Merit
            </Button>
          );
        }

        // If merit is entered but not submitted, show "Edit Merit" button
        return (
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleOpenMeritDialog(params.row)}
            sx={{ fontSize: "0.75rem", py: 0.5, minWidth: "auto" }}
          >
            Edit Merit
          </Button>
        );
      },
    },
  ];

  // Check if any employee has merits submitted for approval
  const hasSubmittedMerits = employees.some(
    (emp) => emp.approvalStatus?.submittedForApproval,
  );

  // Get employees who have NOT yet submitted for approval
  const unsubmittedEmployees = employees.filter(
    (emp) => !emp.approvalStatus?.submittedForApproval,
  );

  // Check if ALL unsubmitted employees have merits entered
  // (We need at least one unsubmitted employee, and they all must have merits)
  const allUnsubmittedHaveMerits =
    unsubmittedEmployees.length > 0 &&
    unsubmittedEmployees.every(
      (emp) =>
        (emp.meritIncreasePercentage && parseFloat(emp.meritIncreasePercentage) > 0) ||
        (emp.meritIncreaseDollar && parseFloat(emp.meritIncreaseDollar) > 0)
    );

  // Calculate team average merit percentage and variance from 3% budget
  const calculateTeamVariance = () => {
    let totalPercentage = 0;
    let count = 0;
    let totalBudgetPool = 0; // Total dollar amount allocated for merits
    let totalSalaryBase = 0; // Total annual salary base for calculating 3% budget

    employees.forEach((emp) => {
      if (emp.salaryType === "Hourly") {
        const currentRate = parseFloat(emp.hourlyPayRate) || 0;
        const meritDollar = parseFloat(emp.meritIncreaseDollar) || 0;
        if (currentRate > 0 && meritDollar > 0) {
          const percentIncrease = (meritDollar / currentRate) * 100;
          totalPercentage += percentIncrease;
          // For hourly, calculate annual impact: hourlyMerit * hoursPerYear
          // Assuming 2080 hours per year (40 hours/week * 52 weeks)
          totalBudgetPool += meritDollar * 2080;
          // Add annual salary base for this employee
          totalSalaryBase += currentRate * 2080;
          count++;
        }
      } else {
        const merit = parseFloat(emp.meritIncreasePercentage) || 0;
        const annualSalary = parseFloat(emp.annualSalary) || 0;
        if (merit > 0 && annualSalary > 0) {
          totalPercentage += merit;
          // For salaried, calculate dollar impact
          totalBudgetPool += (annualSalary * merit) / 100;
          // Add annual salary base for this employee
          totalSalaryBase += annualSalary;
          count++;
        }
      }
    });

    if (count === 0) return { average: 0, variance: 0, count: 0, budgetPool: 0, threePercentBudget: 0 };

    const average = totalPercentage / count;
    const variance = average - 3;
    // Calculate what 3% of the total salary base would be
    const threePercentBudget = (totalSalaryBase * 3) / 100;

    return { average, variance, count, budgetPool: totalBudgetPool, threePercentBudget };
  };

  const teamVariance = calculateTeamVariance();

  return (
    <Box sx={{ width: "100%", maxWidth: { sm: "100%", md: "1700px" } }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography component="h2" variant="h6">
          Assign Employee Merits
        </Typography>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexDirection: "column",
          }}
        >
          <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
            <Box sx={{ textAlign: "right" }}>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", fontWeight: "medium" }}
              >
                CUMULATIVE VARIANCE
              </Typography>
              <Typography
                variant="h5"
                sx={{ fontWeight: "bold", color: "info.main" }}
              >
                3%
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", fontWeight: "medium" }}
              >
                Target budget allocation
              </Typography>
            </Box>

            <Box sx={{ textAlign: "right" }}>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", fontWeight: "medium" }}
              >
                3% BUDGET POOL
              </Typography>
              <Typography
                variant="h5"
                sx={{ fontWeight: "bold", color: "info.main" }}
              >
                ${teamVariance.threePercentBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", fontWeight: "medium" }}
              >
                3% of total salaries
              </Typography>
            </Box>

            <Box sx={{ textAlign: "right" }}>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", fontWeight: "medium" }}
              >
                TEAM AVERAGE MERIT
              </Typography>
              <Typography
                variant="h5"
                sx={{ fontWeight: "bold", color: "primary.main" }}
              >
                {teamVariance.average.toFixed(2)}%
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: teamVariance.variance > 0 ? "error.main" : teamVariance.variance < 0 ? "warning.main" : "success.main",
                  fontWeight: "medium"
                }}
              >
                {teamVariance.variance > 0 ? "+" : ""}{teamVariance.variance.toFixed(2)}% from 3% budget
              </Typography>
            </Box>

            <Box sx={{ textAlign: "right" }}>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", fontWeight: "medium" }}
              >
                NEW BUDGET POOL
              </Typography>
              <Typography
                variant="h5"
                sx={{ fontWeight: "bold", color: "secondary.main" }}
              >
                ${teamVariance.budgetPool.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", fontWeight: "medium" }}
              >
                Total annual merit increase
              </Typography>
            </Box>
          </Box>

          {unsubmittedEmployees.length > 0 && (
            <Button
              variant="contained"
              color="success"
              onClick={handleProceedForApproval}
              disabled={proceedingForApproval || !allUnsubmittedHaveMerits}
              sx={{
                color: "#FFFFFF",
                fontWeight: "bold",
                px: 3,
                py: 1,
                "&.Mui-disabled": {
                  color: "#FFFFFF",
                  opacity: 0.7,
                  backgroundColor: "rgba(0, 0, 0, 0.12)",
                },
              }}
            >
              {proceedingForApproval ? "Submitting..." : "Proceed for Approval"}
            </Button>
          )}
        </Box>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {unsubmittedEmployees.length === 0
          ? "All merits have been submitted for approval and are now locked. You cannot edit them until the approval process is complete."
          : allUnsubmittedHaveMerits
            ? "All pending employees have merits assigned. Click 'Proceed for Approval' to submit them for the approval process."
            : "As a supervisor, you can enter and update merit amounts for employees under your supervision. You must assign merits to ALL employees before you can proceed for approval."}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      <Paper sx={{ width: "100%", mb: 2, overflow: "auto" }}>
        {loading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: 400,
            }}
          >
            <CircularProgress />
          </Box>
        ) : employees.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: 200,
              p: 3,
            }}
          >
            <Typography variant="body1" color="text.secondary">
              No employees found under your supervision
            </Typography>
          </Box>
        ) : (
          <DataGrid
            rows={employees}
            columns={columns}
            getRowId={(row) => row.id}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 10, page: 0 },
              },
            }}
            pageSizeOptions={[5, 10, 25, 50, 100, 150, 200]}
            disableRowSelectionOnClick
            sx={{
              border: 0,
              minWidth: 1200,
              "& .MuiDataGrid-cell:hover": {
                cursor: "pointer",
              },
            }}
            autoHeight
          />
        )}
      </Paper>

      {/* Merit Edit Dialog */}
      <Dialog
        open={meritDialog.open}
        onClose={handleCloseMeritDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {getApprovalStatus(meritDialog.employee).status !== "not_entered"
            ? "Edit"
            : "Add"}{" "}
          Merit for {meritDialog.employee?.fullName}
        </DialogTitle>
        <DialogContent>
          {meritDialog.employee && (
            <>
              <Box sx={{ mb: 3, mt: 2 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  <strong>Employee ID:</strong>{" "}
                  {meritDialog.employee.employeeId}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  <strong>Job Title:</strong>{" "}
                  {meritDialog.employee.jobTitle || "N/A"}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  <strong>Salary Type:</strong>{" "}
                  {meritDialog.employee.salaryType || "N/A"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Current {meritDialog.employee.salaryType === "Hourly" ? "Hourly Rate" : "Annual Salary"}:</strong>{" "}
                  {meritDialog.employee.salaryType === "Hourly"
                    ? `$${(meritDialog.employee.hourlyPayRate || 0).toFixed(2)}/hr`
                    : `$${(meritDialog.employee.annualSalary || 0).toLocaleString()}`}
                </Typography>
              </Box>

              <TextField
                autoFocus
                margin="dense"
                label={
                  meritDialog.employee.salaryType === "Hourly"
                    ? "Merit Increase ($/hour)"
                    : "Merit Increase (%)"
                }
                fullWidth
                type="number"
                value={meritAmount}
                onChange={(e) => setMeritAmount(e.target.value)}
                placeholder={
                  meritDialog.employee.salaryType === "Hourly"
                    ? "Enter dollar increase per hour (e.g., 0.50)"
                    : "Enter percentage increase (e.g., 2.5 for 2.5%)"
                }
                InputProps={{
                  startAdornment: (
                    <Typography sx={{ mr: 1 }}>
                      {meritDialog.employee.salaryType === "Hourly" ? "$" : ""}
                    </Typography>
                  ),
                  endAdornment: (
                    <Typography sx={{ ml: 1 }}>
                      {meritDialog.employee.salaryType === "Hourly" ? "/hr" : "%"}
                    </Typography>
                  ),
                }}
                helperText={
                  meritDialog.employee.salaryType === "Hourly"
                    ? "Enter the dollar amount increase per hour. Target: 3% average across team."
                    : "Enter the percentage increase. Target: 3% average across team."
                }
              />

              {meritAmount && parseFloat(meritAmount) > 0 && (
                <Box sx={{ mt: 2, p: 2, bgcolor: "primary.light", borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: "medium" }}>
                    New {meritDialog.employee.salaryType === "Hourly" ? "Hourly Rate" : "Annual Salary"}:{" "}
                    {meritDialog.employee.salaryType === "Hourly"
                      ? `$${((parseFloat(meritDialog.employee.hourlyPayRate) || 0) + parseFloat(meritAmount)).toFixed(2)}/hr`
                      : `$${((parseFloat(meritDialog.employee.annualSalary) || 0) * (1 + parseFloat(meritAmount) / 100)).toLocaleString()}`}
                  </Typography>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseMeritDialog} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmitMerit}
            variant="contained"
            color="primary"
            disabled={submitting || !meritAmount}
            sx={{
              color: "#FFFFFF",
              "&.Mui-disabled": {
                color: "#FFFFFF",
                opacity: 0.7,
                backgroundColor: "rgba(0, 0, 0, 0.12)",
              },
            }}
          >
            {submitting ? "Saving..." : "Save Merit"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Merits;
