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
  Snackbar,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PendingIcon from "@mui/icons-material/Pending";
import CancelIcon from "@mui/icons-material/Cancel";
import CommentIcon from "@mui/icons-material/Comment";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ReplayIcon from "@mui/icons-material/Replay";
import TimelineIcon from "@mui/icons-material/Timeline";
import { useSelector } from "react-redux";
import { selectUser } from "../../store/slices/userSlice";
import api from "../../utils/api";
import ConfirmDialog from "../../components/modals/ConfirmDialog";
import { ResubmitBonusModal } from "../../components/NotificationPanel";
import MeritTimelineModal from "../../components/modals/MeritTimelineModal";

const Merits = () => {
  const user = useSelector(selectUser);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [snackbarOpen, setSnackbarOpen] = useState(false);
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
    isReadOnly: false,
  });

  // Resubmit modal state (for rejected merits)
  const [resubmitModal, setResubmitModal] = useState({
    open: false,
    notification: null,
  });

  // Merit timeline modal state
  const [timelineModal, setTimelineModal] = useState({
    open: false,
    employee: null,
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
  const handleInlineSave = async (employeeId, value, remarks = null, isRemarkOnly = false) => {
    // Check if value is actually a number (including 0) or empty
    const numValue = parseFloat(value);

    // Only reject negative numbers, allow 0 and positive numbers
    if (!isNaN(numValue) && numValue < 0) {
      setError("Please enter a valid merit amount");
      return;
    }

    // Get the employee to check current merit value
    const employee = employees.find((emp) => emp.id === employeeId);
    if (!employee) return;

    // Check if the merit value is being changed (not just remarks)
    if (!isRemarkOnly && value !== "" && value !== null && value !== undefined) {
      const currentMerit = employee.salaryType === "Hourly"
        ? employee.meritIncreaseDollar
        : employee.meritIncreasePercentage;

      const newMerit = parseFloat(value);

      // If the merit was already entered and the new value is the same, reject the save
      if (employee.approvalStatus?.enteredBy && currentMerit !== null && currentMerit !== undefined) {
        if (parseFloat(currentMerit) === newMerit) {
          setError(`Merit value is already ${newMerit}${employee.salaryType === "Hourly" ? "/hr" : "%"}. Please enter a different value to modify.`);
          return;
        }
      }
    }

    setError("");
    setSuccess("");

    // Show loading indicator only for merit changes (not remarks)
    if (!isRemarkOnly) {
      setSavingRows((prev) => ({ ...prev, [employeeId]: true }));
    }

    try {
      const userId = user?.id || user?._id;
      const employee = employees.find((emp) => emp.id === employeeId);

      if (!employee) return;

      // Build payload based on employee type
      const payload = {};

      // Determine the value to save
      let valueToSave;
      if (value === "" || value === null || value === undefined) {
        // Truly empty - clear the merit
        valueToSave = null;
      } else {
        // Has a value (including 0)
        valueToSave = parseFloat(value);
      }

      if (employee.salaryType === "Hourly") {
        payload.meritIncreaseDollar = valueToSave !== null ? valueToSave : 0;
      } else {
        payload.meritIncreasePercentage = valueToSave !== null ? valueToSave : 0;
      }

      // Add remarks if provided
      if (remarks) {
        payload.remarks = remarks;
      }

      const response = await api.put(
        `/v2/employees/${employeeId}/merit?supervisorId=${userId}`,
        payload,
      );

      // Update the employee in the local state with the full response from backend
      const updatedEmployeeData = response.data?.data;
      console.log('📝 Updated employee data from server:', updatedEmployeeData);
      console.log('📝 Remarks in response:', updatedEmployeeData?.approvalStatus?.remarks);

      setEmployees((prevEmployees) =>
        prevEmployees.map((emp) =>
          emp.id === employeeId
            ? updatedEmployeeData || emp  // Replace entire employee object with server response
            : emp
        )
      );

      // Clear inline value after save so it shows the saved value
      setInlineValues((prev) => {
        const newValues = { ...prev };
        delete newValues[employeeId];
        return newValues;
      });

      // Show checkmark indicator only for merit changes (not remarks)
      if (!isRemarkOnly) {
        setSavedRows((prev) => ({ ...prev, [employeeId]: true }));
      }

      // Show appropriate success toast based on action
      if (isRemarkOnly) {
        const existingRemarks = employee.approvalStatus?.remarks || employee.remarks;
        if (existingRemarks) {
          setSuccess("Remarks updated successfully");
        } else {
          setSuccess("Remarks added successfully");
        }
      } else {
        setSuccess("Merit saved successfully");
      }
      setSnackbarOpen(true);
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

    // Set a new timer to save after user stops typing (1800ms delay)
    // This includes empty values to properly clear merits
    debounceTimers.current[employeeId] = setTimeout(() => {
      // Save valid numbers or empty values (to clear)
      if (value === "" || value === null || value === undefined) {
        handleInlineSave(employeeId, value);
      } else if (parseFloat(value) >= 0) {
        handleInlineSave(employeeId, value);
      }
    }, 1800);
  };

  // Calculate new salary based on current or inline value
  const calculateNewSalary = (employee, inlineValue) => {
    // If inline value is explicitly empty string, return null (don't fall back to saved value)
    if (inlineValue === "") return null;

    // Determine if there's an actual merit value (including 0)
    let meritValue;
    let hasMeritValue = false;

    if (inlineValue !== undefined) {
      meritValue = parseFloat(inlineValue);
      hasMeritValue = !isNaN(meritValue);
    } else {
      // Check if merit was actually entered/saved (not just default 0 from backend)
      // A merit is considered "entered" if enteredBy exists in approvalStatus
      const wasActuallyEntered = employee.approvalStatus?.enteredBy;

      if (!wasActuallyEntered) {
        // Not entered yet, treat as empty
        return null;
      }

      // Check if employee has a saved merit value (including 0)
      if (employee.salaryType === "Hourly") {
        hasMeritValue = employee.meritIncreaseDollar !== null && employee.meritIncreaseDollar !== undefined;
        meritValue = hasMeritValue ? parseFloat(employee.meritIncreaseDollar) : 0;
      } else {
        hasMeritValue = employee.meritIncreasePercentage !== null && employee.meritIncreasePercentage !== undefined;
        meritValue = hasMeritValue ? parseFloat(employee.meritIncreasePercentage) : 0;
      }
    }

    // If no merit value is set at all, return null
    if (!hasMeritValue || isNaN(meritValue)) return null;

    // Calculate new salary (even for 0% merit, show current salary)
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
    console.log('🔍 Opening remarks dialog for employee:', employee.fullName);
    console.log('🔍 Employee approvalStatus:', employee.approvalStatus);
    console.log('🔍 Existing remarks:', employee.approvalStatus?.remarks, employee.remarks);

    // Check merit history for remarks
    if (employee.meritHistory && employee.meritHistory.length > 0) {
      console.log('🔍 Merit history:', employee.meritHistory);
      const latestEntry = employee.meritHistory[employee.meritHistory.length - 1];
      console.log('🔍 Latest history entry:', latestEntry);
      console.log('🔍 Latest history remarks/comments:', latestEntry.remarks, latestEntry.comments);
    }

    // Get existing remarks from the employee's approval status or merit data
    const existingRemarks = employee.approvalStatus?.remarks || employee.remarks || "";

    // Check if merit is submitted for approval (read-only mode)
    const isSubmitted = employee.approvalStatus?.submittedForApproval;

    console.log('🔍 isSubmitted:', isSubmitted, 'existingRemarks:', existingRemarks);
    console.log('⚠️ NOTE: If isSubmitted is true, you can only VIEW remarks (read-only mode).');
    console.log('⚠️ To EDIT remarks, the merit must NOT be submitted yet, or you need to use the Reset button.');

    setRemarksDialog({
      open: true,
      employeeId: employee.id,
      employeeName: employee.fullName,
      remarks: existingRemarks,
      isReadOnly: isSubmitted,
    });
  };

  // Handle closing remarks dialog
  const handleCloseRemarksDialog = () => {
    setRemarksDialog({
      open: false,
      employeeId: null,
      employeeName: "",
      remarks: "",
      isReadOnly: false,
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
          ? employee.meritIncreaseDollar
          : employee.meritIncreasePercentage);

    // Check if there's actually no value set (not even 0)
    // Allow 0 as a valid merit value
    if (currentValue === "" || currentValue === null || currentValue === undefined) {
      setError("Please assign a merit value before adding remarks");
      return;
    }

    // Save with remarks (currentValue can be 0, which is valid)
    // Pass true for isRemarkOnly to show appropriate success message and skip checkmark
    await handleInlineSave(employeeId, currentValue, remarks, true);
    handleCloseRemarksDialog();
  };

  // Calculate variance from 3% based on current or inline value
  const calculateVariance = (employee, inlineValue) => {
    // If inline value is explicitly empty string, return null (don't fall back to saved value)
    if (inlineValue === "") return null;

    // Determine if there's an actual merit value (including 0)
    let meritValue;
    let hasMeritValue = false;

    if (inlineValue !== undefined) {
      meritValue = parseFloat(inlineValue);
      hasMeritValue = !isNaN(meritValue);
    } else {
      // Check if merit was actually entered/saved (not just default 0 from backend)
      // A merit is considered "entered" if enteredBy exists in approvalStatus
      const wasActuallyEntered = employee.approvalStatus?.enteredBy;

      if (!wasActuallyEntered) {
        // Not entered yet, treat as empty
        return null;
      }

      // Check if employee has a saved merit value (including 0)
      if (employee.salaryType === "Hourly") {
        hasMeritValue = employee.meritIncreaseDollar !== null && employee.meritIncreaseDollar !== undefined;
        meritValue = hasMeritValue ? parseFloat(employee.meritIncreaseDollar) : 0;
      } else {
        hasMeritValue = employee.meritIncreasePercentage !== null && employee.meritIncreasePercentage !== undefined;
        meritValue = hasMeritValue ? parseFloat(employee.meritIncreasePercentage) : 0;
      }
    }

    // If no merit value is set at all, return null
    if (!hasMeritValue || isNaN(meritValue)) return null;

    // Calculate variance (including for 0% merit)
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

  // Check if a merit has been rejected at the first approval level
  // This determines if supervisor can see and resubmit
  const getRejectionInfo = (employee) => {
    if (!employee || !employee.approvalStatus?.submittedForApproval) {
      return null;
    }

    // Find the first assigned approver level by checking approvalStatus
    // (approver fields may not be populated for supervisors)
    const levels = ["level1", "level2", "level3", "level4", "level5"];

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const levelStatus = employee.approvalStatus?.[level];

      // If this level has approval status data (meaning an approver is assigned)
      if (levelStatus && levelStatus.status !== undefined) {
        const status = levelStatus.status;

        // If this first approver level has rejected
        if (status === "rejected") {
          const rejectionReason = levelStatus.comments || "";
          // Try to get rejector name from approver field, otherwise use approvedBy ID
          const rejectedBy = employee[`${level}Approver`]?.fullName ||
                           `Approver ${levelStatus.approvedBy || "Unknown"}`;

          return {
            isRejected: true,
            rejectedLevel: i + 1,
            rejectedBy,
            rejectionReason,
          };
        }

        // If first level is not rejected (approved or pending), no rejection for supervisor
        break;
      }
    }

    return null;
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

        // Check if merit was rejected at first approver level (supervisor can resubmit)
        const rejectionInfo = getRejectionInfo(params.row);

        // If rejected at first level, show rejection chip with resubmit option
        if (rejectionInfo?.isRejected) {
          return (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 0.5,
                height: "100%",
                width: "100%",
                px: 1,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Tooltip title="Merit rejected — click to review and resubmit" arrow>
                  <Chip
                    label="Rejected — Resubmit"
                    color="error"
                    size="small"
                    icon={<ReplayIcon />}
                    onClick={() => {
                      setResubmitModal({
                        open: true,
                        notification: {
                          id: null,
                          payload: {
                            employeeDbId: params.row.id || params.row._id,
                            employeeId: params.row.employeeId,
                            employeeName: params.row.fullName,
                            currentMerit: params.row.salaryType === "Hourly"
                              ? params.row.meritIncreaseDollar
                              : params.row.meritIncreasePercentage,
                            salaryType: params.row.salaryType,
                            rejectedBy: rejectionInfo.rejectedBy,
                            rejectorLevel: rejectionInfo.rejectedLevel,
                            rejectionReason: rejectionInfo.rejectionReason,
                            recipientLevel: 0, // Supervisor level
                          },
                        },
                      });
                    }}
                    sx={{
                      fontWeight: 600,
                      cursor: "pointer",
                      "&:hover": {
                        filter: "none",
                        bgcolor: "error.main",
                        boxShadow: "none",
                        "& .MuiChip-label": { color: "#fff" },
                        "& .MuiChip-icon": { color: "#fff" },
                      },
                      "&:active": { filter: "none", bgcolor: "error.main" },
                      "& .MuiTouchRipple-root": { display: "none" },
                    }}
                  />
                </Tooltip>
                <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", ml: "auto" }}>
                  <Tooltip title="Add/view remarks">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenRemarksDialog(params.row)}
                      sx={{
                        p: 0.5,
                        color: (params.row.approvalStatus?.remarks || params.row.remarks) ? 'primary.main' : 'action.active'
                      }}
                    >
                      <CommentIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="View merit timeline">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setTimelineModal({
                          open: true,
                          employee: params.row,
                        });
                      }}
                      sx={{
                        p: 0.5,
                        color: 'text.secondary'
                      }}
                    >
                      <TimelineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem", lineHeight: 1.2, pl: 0 }}>
                from Level {rejectionInfo.rejectedLevel} · {rejectionInfo.rejectedBy}
              </Typography>
            </Box>
          );
        }

        // If submitted, show locked value with remarks button
        if (isSubmitted) {
          let meritDisplay;
          if (params.row.salaryType === "Hourly") {
            const merit = params.row.meritIncreaseDollar || 0;
            meritDisplay = merit > 0 ? `$${merit.toFixed(2)}/hr` : "-";
          } else {
            const merit = params.row.meritIncreasePercentage || 0;
            const annualSalary = params.row.annualSalary || 0;
            if (merit === 0) {
              meritDisplay = "-";
            } else {
              const dollarAmount = (annualSalary * merit) / 100;
              meritDisplay = (
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

          return (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                width: "100%",
                height: "100%",
                gap: 1,
                px: 1,
              }}
            >
              <Box sx={{ flex: 1, display: "flex", alignItems: "center" }}>
                {meritDisplay}
              </Box>
              <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                <Tooltip title="View remarks for this merit assignment">
                  <IconButton
                    size="small"
                    onClick={() => handleOpenRemarksDialog(params.row)}
                    sx={{
                      p: 0.5,
                      color: (params.row.approvalStatus?.remarks || params.row.remarks) ? 'primary.main' : 'action.active'
                    }}
                  >
                    <CommentIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          );
        }

        // Always show input field for non-submitted employees
        const currentValue = inlineValues[params.row.id] !== undefined
          ? inlineValues[params.row.id]
          : (() => {
              // Check if merit was actually entered/saved (not just default 0 from backend)
              const wasActuallyEntered = params.row.approvalStatus?.enteredBy;

              if (!wasActuallyEntered) {
                // Not entered yet, show empty
                return "";
              }

              // Merit was entered, show the value (including 0)
              if (params.row.salaryType === "Hourly") {
                return params.row.meritIncreaseDollar !== null && params.row.meritIncreaseDollar !== undefined
                  ? params.row.meritIncreaseDollar
                  : "";
              } else {
                return params.row.meritIncreasePercentage !== null && params.row.meritIncreasePercentage !== undefined
                  ? params.row.meritIncreasePercentage
                  : "";
              }
            })();

        const isSaving = savingRows[params.row.id];
        const isSaved = savedRows[params.row.id];

        return (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              width: "100%",
              height: "100%",
              gap: 1,
              px: 1,
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
              sx={{ flex: 1, minWidth: "120px" }}
            />
            <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
              <Tooltip title="Add remarks for this merit assignment">
                <IconButton
                  size="small"
                  onClick={() => handleOpenRemarksDialog(params.row)}
                  sx={{
                    p: 0.5,
                    color: (params.row.approvalStatus?.remarks || params.row.remarks) ? 'primary.main' : 'action.active'
                  }}
                >
                  <CommentIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
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
  // Allow 0 as a valid merit value
  const allUnsubmittedHaveMerits =
    unsubmittedEmployees.length > 0 &&
    unsubmittedEmployees.every(
      (emp) => {
        const hasPercentage = emp.meritIncreasePercentage !== null && emp.meritIncreasePercentage !== undefined && emp.meritIncreasePercentage !== '';
        const hasDollar = emp.meritIncreaseDollar !== null && emp.meritIncreaseDollar !== undefined && emp.meritIncreaseDollar !== '';
        return hasPercentage || hasDollar;
      }
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

        // Always add to salary base if employee has a current rate
        if (currentRate > 0) {
          // Assuming 2080 hours per year (40 hours/week * 52 weeks)
          totalSalaryBase += currentRate * 2080;
        }

        // Check if merit was actually entered/saved (not just default 0 from backend)
        const wasActuallyEntered = emp.approvalStatus?.enteredBy;
        const hasMerit = wasActuallyEntered && emp.meritIncreaseDollar !== null && emp.meritIncreaseDollar !== undefined;

        if (hasMerit && currentRate > 0) {
          const meritDollar = parseFloat(emp.meritIncreaseDollar);
          const percentIncrease = (meritDollar / currentRate) * 100;
          totalPercentage += percentIncrease;
          // For hourly, calculate annual impact: hourlyMerit * hoursPerYear
          totalBudgetPool += meritDollar * 2080;
          count++;
        }
      } else {
        const annualSalary = parseFloat(emp.annualSalary) || 0;

        // Always add to salary base if employee has an annual salary
        if (annualSalary > 0) {
          totalSalaryBase += annualSalary;
        }

        // Check if merit was actually entered/saved (not just default 0 from backend)
        const wasActuallyEntered = emp.approvalStatus?.enteredBy;
        const hasMerit = wasActuallyEntered && emp.meritIncreasePercentage !== null && emp.meritIncreasePercentage !== undefined;

        if (hasMerit && annualSalary > 0) {
          const merit = parseFloat(emp.meritIncreasePercentage);
          totalPercentage += merit;
          // For salaried, calculate dollar impact
          totalBudgetPool += (annualSalary * merit) / 100;
          count++;
        }
      }
    });

    const average = count > 0 ? totalPercentage / count : 0;
    const variance = count > 0 ? average - 3 : 0;
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
                sx={{ fontWeight: "bold", color: "success.main" }}
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
                sx={{ fontWeight: "bold", color: "success.main" }}
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
                sx={{ fontWeight: "bold", color: teamVariance.variance > 0 ? "error.main" : "success.main" }}
              >
                {teamVariance.average.toFixed(2)}%
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: teamVariance.variance > 0 ? "error.main" : "success.main",
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
                sx={{ fontWeight: "bold", color: teamVariance.budgetPool > teamVariance.threePercentBudget ? "error.main" : "success.main" }}
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
          {remarksDialog.isReadOnly ? "View" : (remarksDialog.remarks ? "Edit" : "Add")} Remarks for {remarksDialog.employeeName}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              autoFocus={!remarksDialog.isReadOnly}
              multiline
              rows={4}
              fullWidth
              label="Remarks"
              placeholder={remarksDialog.isReadOnly ? "No remarks available" : "Enter your remarks for this merit assignment"}
              value={remarksDialog.remarks}
              onChange={(e) => setRemarksDialog((prev) => ({ ...prev, remarks: e.target.value }))}
              helperText={remarksDialog.isReadOnly ? "This merit has been submitted for approval" : "These remarks will appear in the merit history timeline"}
              InputProps={{
                readOnly: remarksDialog.isReadOnly,
              }}
              disabled={remarksDialog.isReadOnly}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseRemarksDialog}>
            {remarksDialog.isReadOnly ? "Close" : "Cancel"}
          </Button>
          {!remarksDialog.isReadOnly && (
            <Button
              onClick={handleSaveRemarks}
              variant="contained"
              color="primary"
              disabled={!remarksDialog.remarks.trim()}
            >
              {remarksDialog.remarks ? "Update" : "Save"} Remarks
            </Button>
          )}
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

      {/* Success Toast Notification */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity="success"
          variant="filled"
          sx={{
            width: '100%',
            minWidth: '300px',
            backgroundColor: '#2e7d32',
            color: '#ffffff',
            fontWeight: 500,
            fontSize: '0.95rem',
            boxShadow: '0 4px 12px rgba(46, 125, 50, 0.4)',
            '& .MuiAlert-icon': {
              color: '#ffffff'
            }
          }}
        >
          {success}
        </Alert>
      </Snackbar>

      {/* Resubmit Merit Modal — triggered from rejection chip */}
      <ResubmitBonusModal
        open={resubmitModal.open}
        onClose={() => setResubmitModal({ open: false, notification: null })}
        notification={resubmitModal.notification}
        onSuccess={() => {
          setResubmitModal({ open: false, notification: null });
          fetchMyTeam();
        }}
      />

      {/* Merit Timeline Modal */}
      <MeritTimelineModal
        open={timelineModal.open}
        onClose={() => setTimelineModal({ open: false, employee: null })}
        employee={timelineModal.employee}
      />
    </Box>
  );
};

export default Merits;
