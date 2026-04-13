import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
import CommentIcon from "@mui/icons-material/Comment";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useSelector } from "react-redux";
import { selectUser } from "../../store/slices/userSlice";
import api from "../../utils/api";
import ConfirmDialog from "../../components/modals/ConfirmDialog";

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

  // State for inline editing - store current input values for real-time calculation
  const [inlineValues, setInlineValues] = useState({});
  // State for tracking which rows are saving
  const [savingRows, setSavingRows] = useState({});
  // State for tracking which rows have been successfully saved (show checkmark)
  const [savedRows, setSavedRows] = useState({});

  // Ref to store debounce timers for each employee
  const debounceTimers = useRef({});

  // Reset dialog state
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Remarks dialog state
  const [remarksDialog, setRemarksDialog] = useState({
    open: false,
    employeeId: null,
    employeeName: "",
    remarks: "",
  });

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

  // Auto-clear checkmarks after 3 seconds
  useEffect(() => {
    const checkmarkTimers = Object.keys(savedRows).map((employeeId) => {
      return setTimeout(() => {
        setSavedRows((prev) => {
          const newRows = { ...prev };
          delete newRows[employeeId];
          return newRows;
        });
      }, 3000);
    });

    return () => {
      checkmarkTimers.forEach(clearTimeout);
    };
  }, [savedRows]);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

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

  // Inline save function - saves immediately on change
  const handleInlineSave = async (employeeId, value, remarks = null) => {
    if (parseFloat(value) < 0) {
      setError("Please enter a valid merit amount");
      return;
    }

    setError("");
    setSuccess("");

    // Show loading indicator
    setSavingRows((prev) => ({ ...prev, [employeeId]: true }));

    try {
      const userId = user?.id || user?._id;
      const employee = employees.find((emp) => emp.id === employeeId);

      if (!employee) return;

      // Build payload based on employee type
      const payload = {};

      // Handle empty/cleared values - send 0 to clear the merit
      if (value === "" || value === null || value === undefined) {
        if (employee.salaryType === "Hourly") {
          payload.meritIncreaseDollar = 0;
        } else {
          payload.meritIncreasePercentage = 0;
        }
      } else {
        if (employee.salaryType === "Hourly") {
          payload.meritIncreaseDollar = parseFloat(value);
        } else {
          payload.meritIncreasePercentage = parseFloat(value);
        }
      }

      // Add remarks if provided
      if (remarks) {
        payload.remarks = remarks;
      }

      const response = await api.put(
        `/v2/employees/${employeeId}/merit?supervisorId=${userId}`,
        payload,
      );

      // Update the employee in the local state instead of refetching all employees
      const savedValue = value === "" || value === null || value === undefined ? 0 : parseFloat(value);
      setEmployees((prevEmployees) =>
        prevEmployees.map((emp) =>
          emp.id === employeeId
            ? {
                ...emp,
                meritIncreaseDollar: employee.salaryType === "Hourly" ? savedValue : emp.meritIncreaseDollar,
                meritIncreasePercentage: employee.salaryType === "Hourly" ? emp.meritIncreasePercentage : savedValue,
                // Update other fields from response if available
                ...(response.data?.data || {}),
              }
            : emp
        )
      );

      // Clear inline value after save so it shows the saved value
      setInlineValues((prev) => {
        const newValues = { ...prev };
        delete newValues[employeeId];
        return newValues;
      });

      // Show checkmark indicator
      setSavedRows((prev) => ({ ...prev, [employeeId]: true }));
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "An error occurred while updating merit";
      setError(errorMessage);
    } finally {
      // Hide loading indicator
      setSavingRows((prev) => {
        const newRows = { ...prev };
        delete newRows[employeeId];
        return newRows;
      });
    }
  };

  // Input handler - debounces save to allow typing complete values like "1.5"
  const handleInlineChange = (employeeId, value) => {
    // Update the inline value immediately for real-time calculation
    setInlineValues((prev) => ({
      ...prev,
      [employeeId]: value,
    }));

    // Clear any existing timer for this employee
    if (debounceTimers.current[employeeId]) {
      clearTimeout(debounceTimers.current[employeeId]);
      delete debounceTimers.current[employeeId];
    }

    // Set a new timer to save after user stops typing (800ms delay)
    // This includes empty values to properly clear merits
    debounceTimers.current[employeeId] = setTimeout(() => {
      // Save valid numbers or empty values (to clear)
      if (value === "" || value === null || value === undefined) {
        handleInlineSave(employeeId, value);
      } else if (parseFloat(value) >= 0) {
        handleInlineSave(employeeId, value);
      }
    }, 800);
  };

  // Calculate new salary based on current or inline value
  const calculateNewSalary = (employee, inlineValue) => {
    // If inline value is explicitly empty string, return null (don't fall back to saved value)
    if (inlineValue === "") return null;

    const meritValue = inlineValue !== undefined
      ? parseFloat(inlineValue)
      : (employee.salaryType === "Hourly"
          ? parseFloat(employee.meritIncreaseDollar) || 0
          : parseFloat(employee.meritIncreasePercentage) || 0);

    if (!meritValue || meritValue === 0 || isNaN(meritValue)) return null;

    if (employee.salaryType === "Hourly") {
      const currentRate = parseFloat(employee.hourlyPayRate) || 0;
      return currentRate + meritValue;
    } else {
      const currentSalary = parseFloat(employee.annualSalary) || 0;
      return currentSalary * (1 + meritValue / 100);
    }
  };

  // Handle opening remarks dialog
  const handleOpenRemarksDialog = (employee) => {
    // Get existing remarks from the employee's approval status or merit data
    const existingRemarks = employee.approvalStatus?.remarks || employee.remarks || "";

    setRemarksDialog({
      open: true,
      employeeId: employee.id,
      employeeName: employee.fullName,
      remarks: existingRemarks,
    });
  };

  // Handle closing remarks dialog
  const handleCloseRemarksDialog = () => {
    setRemarksDialog({
      open: false,
      employeeId: null,
      employeeName: "",
      remarks: "",
    });
  };

  // Handle saving remarks
  const handleSaveRemarks = async () => {
    const { employeeId, remarks } = remarksDialog;

    if (!remarks.trim()) {
      setError("Please enter remarks");
      return;
    }

    // Get the current merit value for this employee
    const employee = employees.find((emp) => emp.id === employeeId);
    if (!employee) return;

    const currentValue = inlineValues[employeeId] !== undefined
      ? inlineValues[employeeId]
      : (employee.salaryType === "Hourly"
          ? employee.meritIncreaseDollar || ""
          : employee.meritIncreasePercentage || "");

    // Allow adding/updating remarks even if merit is 0, as long as there's a value
    if (currentValue === "" || currentValue === null || currentValue === undefined) {
      setError("Please assign a merit value before adding remarks");
      return;
    }

    // Save with remarks
    await handleInlineSave(employeeId, currentValue, remarks);
    handleCloseRemarksDialog();
  };

  // Calculate variance from 3% based on current or inline value
  const calculateVariance = (employee, inlineValue) => {
    // If inline value is explicitly empty string, return null (don't fall back to saved value)
    if (inlineValue === "") return null;

    const meritValue = inlineValue !== undefined
      ? parseFloat(inlineValue)
      : (employee.salaryType === "Hourly"
          ? parseFloat(employee.meritIncreaseDollar) || 0
          : parseFloat(employee.meritIncreasePercentage) || 0);

    if (!meritValue || meritValue === 0 || isNaN(meritValue)) return null;

    if (employee.salaryType === "Hourly") {
      const currentRate = parseFloat(employee.hourlyPayRate) || 0;
      if (currentRate === 0) return null;
      const percentIncrease = (meritValue / currentRate) * 100;
      return percentIncrease - 3;
    } else {
      return meritValue - 3;
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

  const handleReset = async () => {
    setResetLoading(true);
    setError("");
    setSuccess("");

    try {
      const userId = user?.id || user?._id;

      const response = await api.post(
        `/v2/employees/supervisor/reset-merits?supervisorId=${userId}`,
      );

      setSuccess(response.data.message);
      await fetchMyTeam();
      setInlineValues({});
      setResetDialogOpen(false);
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "An error occurred while resetting merits";
      setError(errorMessage);
    } finally {
      setResetLoading(false);
      setResetDialogOpen(false);
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

  const columns = useMemo(() => [
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
      headerName: "Pay Type",
      width: 130,
      minWidth: 120,
      flex: 0.7,
      renderCell: (params) => params.row.salaryType || "N/A",
    },
    {
      field: "currentSalary",
      headerName: "Current Pay",
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
      headerName: "Increase rate (% or $)",
      width: 240,
      minWidth: 220,
      flex: 1.2,
      renderCell: (params) => {
        const isSubmitted = params.row.approvalStatus?.submittedForApproval;

        // If submitted, show locked value
        if (isSubmitted) {
          if (params.row.salaryType === "Hourly") {
            const merit = params.row.meritIncreaseDollar || 0;
            return merit > 0 ? `$${merit.toFixed(2)}/hr` : "-";
          } else {
            const merit = params.row.meritIncreasePercentage || 0;
            const annualSalary = params.row.annualSalary || 0;
            if (merit === 0) return "-";
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
        }

        // Always show input field for non-submitted employees
        const currentValue = inlineValues[params.row.id] !== undefined
          ? inlineValues[params.row.id]
          : (params.row.salaryType === "Hourly"
              ? params.row.meritIncreaseDollar || ""
              : params.row.meritIncreasePercentage || "");

        const isSaving = savingRows[params.row.id];
        const isSaved = savedRows[params.row.id];

        return (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
              gap: 0.5,
            }}
          >
            <TextField
              size="small"
              type="number"
              value={currentValue}
              onChange={(e) => {
                handleInlineChange(params.row.id, e.target.value);
              }}
              disabled={isSaving}
              InputProps={{
                startAdornment: params.row.salaryType === "Hourly" ? "$" : undefined,
                endAdornment: isSaving ? (
                  <CircularProgress size={16} sx={{ mr: 1 }} />
                ) : isSaved ? (
                  <CheckCircleIcon size={16} sx={{ mr: 1, color: "success.main" }} />
                ) : (
                  params.row.salaryType === "Hourly" ? "/hr" : "%"
                ),
              }}
              inputProps={{
                step: params.row.salaryType === "Hourly" ? "0.01" : "0.1",
                min: "0",
              }}
              sx={{ flex: 1 }}
            />
            <Tooltip title="Add remarks for this merit assignment">
              <IconButton
                size="small"
                color="primary"
                onClick={() => handleOpenRemarksDialog(params.row)}
                sx={{ p: 0.5 }}
              >
                <CommentIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      },
    },
    {
      field: "newSalary",
      headerName: "New pay after increase",
      width: 150,
      minWidth: 130,
      flex: 0.8,
      renderCell: (params) => {
        // Use inline value if being typed, otherwise use saved value
        const inlineValue = inlineValues[params.row.id];
        const newSalary = calculateNewSalary(params.row, inlineValue);

        if (!newSalary) return "-";

        if (params.row.salaryType === "Hourly") {
          return `$${newSalary.toFixed(2)}/hr`;
        } else {
          return `$${newSalary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
      },
    },
    {
      field: "variance",
      headerName: "Variance vs budget",
      width: 180,
      minWidth: 160,
      flex: 1,
      renderCell: (params) => {
        // Use inline value if being typed, otherwise use saved value
        const inlineValue = inlineValues[params.row.id];
        const variance = calculateVariance(params.row, inlineValue);

        if (variance === null) return "-";

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
    // COMMENTED OUT: Actions column - now using inline editing
    // {
    //   field: "actions",
    //   headerName: "Actions",
    //   width: 140,
    //   minWidth: 120,
    //   flex: 0.5,
    //   sortable: false,
    //   renderCell: (params) => {
    //     const isSubmitted = params.row.approvalStatus?.submittedForApproval;

    //     // If already submitted for approval, disable editing
    //     if (isSubmitted) {
    //       return (
    //         <Tooltip title="Merit has been submitted for approval and is locked">
    //           <span>
    //             <Button
    //               variant="outlined"
    //               size="small"
    //               disabled
    //               sx={{ fontSize: "0.75rem", py: 0.5, minWidth: "auto" }}
    //             >
    //               Locked
    //             </Button>
    //           </span>
    //         </Tooltip>
    //       );
    //     }

    //     // If merit is not entered yet, show "Add Merit" button
    //     const hasMeritValue =
    //       (params.row.meritIncreasePercentage && parseFloat(params.row.meritIncreasePercentage) > 0) ||
    //       (params.row.meritIncreaseDollar && parseFloat(params.row.meritIncreaseDollar) > 0);
    //     if (!hasMeritValue) {
    //       return (
    //         <Button
    //           variant="contained"
    //           size="small"
    //           onClick={() => handleOpenMeritDialog(params.row)}
    //           sx={{ fontSize: "0.75rem", py: 0.5, minWidth: "auto" }}
    //         >
    //           Add Merit
    //         </Button>
    //       );
    //     }

    //     // If merit is entered but not submitted, show "Edit Merit" button
    //     return (
    //       <Button
    //         variant="outlined"
    //         size="small"
    //         onClick={() => handleOpenMeritDialog(params.row)}
    //         sx={{ fontSize: "0.75rem", py: 0.5, minWidth: "auto" }}
    //       >
    //         Edit Merit
    //       </Button>
    //     );
    //   },
    // },
  ], [employees, inlineValues, savingRows, savedRows, handleInlineChange, handleOpenRemarksDialog]);

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
          flexDirection: { xs: "column", lg: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", lg: "center" },
          gap: 2,
          mb: 2,
        }}
      >
        <Typography component="h2" variant="h6">
          Merit Increase Allocation
        </Typography>

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 2,
            width: { xs: "100%", lg: "auto" },
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: { xs: 2, md: 3 },
              alignItems: "flex-start",
              justifyContent: { xs: "space-between", lg: "flex-end" },
              width: "100%",
            }}
          >
            <Box sx={{ textAlign: "right", minWidth: { xs: "140px", sm: "auto" } }}>
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

            <Box sx={{ textAlign: "right", minWidth: { xs: "140px", sm: "auto" } }}>
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

            <Box sx={{ textAlign: "right", minWidth: { xs: "140px", sm: "auto" } }}>
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

            <Box sx={{ textAlign: "right", minWidth: { xs: "140px", sm: "auto" } }}>
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
            <Box sx={{ display: "flex", gap: 2, alignSelf: "flex-end" }}>
              <Button
                variant="outlined"
                color="warning"
                onClick={() => setResetDialogOpen(true)}
                disabled={resetLoading || proceedingForApproval}
                startIcon={<RestartAltIcon />}
                sx={{
                  fontWeight: "bold",
                  px: 2,
                  py: 1,
                  borderWidth: 2,
                  "&:hover": { borderWidth: 2 },
                }}
              >
                Reset
              </Button>
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
                {proceedingForApproval ? "Submitting..." : "Submit for approval"}
              </Button>
            </Box>
          )}
        </Box>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {unsubmittedEmployees.length === 0
          ? "All merits have been submitted for approval and are now locked. You cannot edit them until the approval process is complete."
          : allUnsubmittedHaveMerits
            ? "All pending employees have merits assigned. Click 'Submit for approval' to submit them for the approval process."
            : "As a supervisor, you can enter and update merit amounts for employees under your supervision. You must assign merits to ALL employees before you can submit for approval."}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
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

      {/* Remarks Dialog */}
      <Dialog
        open={remarksDialog.open}
        onClose={handleCloseRemarksDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {remarksDialog.remarks ? "Edit" : "Add"} Remarks for {remarksDialog.employeeName}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              autoFocus
              multiline
              rows={4}
              fullWidth
              label="Remarks"
              placeholder="Enter your remarks for this merit assignment"
              value={remarksDialog.remarks}
              onChange={(e) => setRemarksDialog((prev) => ({ ...prev, remarks: e.target.value }))}
              helperText="These remarks will appear in the merit history timeline"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseRemarksDialog}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveRemarks}
            variant="contained"
            color="primary"
            disabled={!remarksDialog.remarks.trim()}
          >
            {remarksDialog.remarks ? "Update" : "Save"} Remarks
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Reset Confirmation Dialog */}
      <ConfirmDialog
        open={resetDialogOpen}
        title="Reset All Merits"
        message="Are you sure you want to reset all merit data for your team? This will clear all entered merit increases that have not been fully approved. This action cannot be undone."
        onConfirm={handleReset}
        onCancel={() => setResetDialogOpen(false)}
        loading={resetLoading}
        confirmText="Yes, Reset Merits"
        confirmColor="warning"
      />
    </Box>
  );
};

export default Merits;
