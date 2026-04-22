import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Badge,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Card,
  CardContent,
  Grid,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import InfoIcon from "@mui/icons-material/Info";
import SearchIcon from "@mui/icons-material/Search";
import BusinessIcon from "@mui/icons-material/Business";
import { MenuItem, InputAdornment } from "@mui/material";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { selectUser } from "../../store/slices/userSlice";
import api from "../../utils/api";
import { useMeritSettings } from "../../contexts/MeritSettingsContext";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import ReplayIcon from "@mui/icons-material/Replay";
import TimelineIcon from "@mui/icons-material/Timeline";
import EditIcon from "@mui/icons-material/Edit";
import { ResubmitBonusModal } from "../../components/NotificationPanel";
import ModifyMeritModal from "../../components/modals/ModifyMeritModal";
import MeritTimelineModal from "../../components/modals/MeritTimelineModal";

const Approvals = () => {
  const user = useSelector(selectUser);
  const navigate = useNavigate();
  const { budgetPercentage, meritYear } = useMeritSettings();
  const [approvalsData, setApprovalsData] = useState({
    level1: [],
    level2: [],
    level3: [],
    level4: [],
    level5: [],
  });
  const [counts, setCounts] = useState({
    level1: 0,
    level2: 0,
    level3: 0,
    level4: 0,
    level5: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approvalDialog, setApprovalDialog] = useState({
    open: false,
    employee: null,
    level: null,
    action: null, // 'approve' or 'reject'
  });
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Filter states
  const [filterStatus, setFilterStatus] = useState("all"); // 'all', 'pending', 'approved'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedSupervisor, setSelectedSupervisor] = useState(""); // Supervisor State
  const [selectedCompany, setSelectedCompany] = useState(""); // Company State

  // Bulk approval states
  const [bulkApprovalDialog, setBulkApprovalDialog] = useState({
    open: false,
  });
  const [bulkComments, setBulkComments] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Bulk approval result dialog
  const [bulkResultDialog, setBulkResultDialog] = useState({
    open: false,
    approvedCount: 0,
    skippedEmployees: [],
  });

  // Resubmit modal (triggered from next-level rejected status in table)
  const [resubmitModal, setResubmitModal] = useState({
    open: false,
    notification: null,
  });

  // Modify merit modal
  const [modifyModal, setModifyModal] = useState({
    open: false,
    employee: null,
    level: null,
  });

  // Merit timeline modal
  const [timelineModal, setTimelineModal] = useState({
    open: false,
    employee: null,
  });

  const fetchApprovals = async () => {
    setLoading(true);
    setError("");

    try {
      const userId = user?.id || user?._id;
      const response = await api.get(
        `/v2/employees/approvals/my-approvals?approverId=${userId}`,
      );

      const { data } = response;
      setApprovalsData(data.data);
      setCounts(data.counts);
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "An error occurred while fetching approvals";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id || user?._id) {
      fetchApprovals();
    }
  }, [user]);

  const handleOpenApprovalDialog = (employee, level, action) => {
    setApprovalDialog({
      open: true,
      employee,
      level,
      action,
    });
    setComments("");
  };

  const handleCloseApprovalDialog = () => {
    setApprovalDialog({
      open: false,
      employee: null,
      level: null,
      action: null,
    });
    setComments("");
  };

  const handleSubmitApproval = async () => {
    setSubmitting(true);
    setError("");

    try {
      const userId = user?.id || user?._id;

      const response = await api.post(
        `/v2/employees/${approvalDialog.employee.id || approvalDialog.employee._id}/bonus-approval?approverId=${userId}`,
        {
          level: approvalDialog.level,
          action: approvalDialog.action,
          comments: comments,
        },
      );

      // Refresh the approvals list
      await fetchApprovals();
      handleCloseApprovalDialog();
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "An error occurred while processing approval";
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenBulkApprovalDialog = () => {
    setBulkApprovalDialog({ open: true });
    setBulkComments("");
  };

  const handleCloseBulkApprovalDialog = () => {
    setBulkApprovalDialog({ open: false });
    setBulkComments("");
  };

  const handleSubmitBulkApproval = async () => {
    setBulkSubmitting(true);
    setError("");

    try {
      const userId = user?.id || user?._id;

      const response = await api.post(
        `/v2/employees/approvals/bulk-approve?approverId=${userId}`,
        {
          comments: bulkComments,
        },
      );

      // Refresh the approvals list
      await fetchApprovals();
      handleCloseBulkApprovalDialog();

      // Show result dialog
      setBulkResultDialog({
        open: true,
        approvedCount: response.data.approvedCount || 0,
        skippedEmployees: response.data.skippedEmployees || [],
      });
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "An error occurred while processing bulk approval";
      setError(errorMessage);
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleCloseBulkResultDialog = () => {
    setBulkResultDialog({
      open: false,
      approvedCount: 0,
      skippedEmployees: [],
    });
  };

  const canApprove = (employee, level) => {
    // REQUIREMENT: Merit must be entered
    // Consider it entered if enteredBy metadata exists OR merit increase fields are greater than 0
    const isMeritEntered = !!(
      employee.approvalStatus?.enteredBy ||
      (employee.salaryType === "Hourly" && employee.meritIncreaseDollar && parseFloat(employee.meritIncreaseDollar) > 0) ||
      (employee.salaryType !== "Hourly" && employee.meritIncreasePercentage && parseFloat(employee.meritIncreasePercentage) > 0)
    );

    if (!isMeritEntered) {
      return { can: false, reason: "merit_missing" };
    }

    // Check if previous levels are approved
    if (level === 1) return { can: true };

    // For level 2+, check if previous levels are complete
    for (let i = 1; i < level; i++) {
      const levelKey = `level${i}`;
      const approverField = `${levelKey}Approver`;
      const status = employee.approvalStatus?.[levelKey]?.status;

      if (employee[approverField]) {
        if (status !== "approved") {
          return { can: false, reason: "prev_level_pending", prevLevel: i };
        }
      }
    }

    return { can: true };
  };

  const getActionsColumn = (level) => ({
    field: "actions",
    headerName: "Actions",
    width: 120,
    flex: 0.6,
    sortable: false,
    renderCell: (params) => {
      const currentStatus =
        params.row.approvalStatus?.[`level${level}`]?.status || "pending";
      const isPending = currentStatus === "pending";
      const isApproved = currentStatus === "approved";
      const isRejected = currentStatus === "rejected";
      const approvalState = canApprove(params.row, level);
      const canPerformAction = approvalState.can;

      const getTooltipTitle = (action) => {
        if (canPerformAction)
          return action === "approve" ? "Approve" : "Reject";
        if (approvalState.reason === "merit_missing")
          return "Merit not added";
        if (approvalState.reason === "prev_level_pending")
          return `Level ${approvalState.prevLevel} must be approved first`;
        return "Not authorized at this time";
      };

      if (isApproved) {
        return (
          <Chip
            label="Approved"
            color="success"
            size="small"
            icon={<CheckCircleIcon />}
          />
        );
      }

      if (isRejected) {
        return (
          <Chip
            label="Rejected"
            color="error"
            size="small"
            icon={<CancelIcon />}
          />
        );
      }

      return (
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <Tooltip title={getTooltipTitle("approve")}>
            <span>
              <IconButton
                size="small"
                color="success"
                disabled={!canPerformAction}
                onClick={() =>
                  handleOpenApprovalDialog(params.row, level, "approve")
                }
              >
                <CheckCircleIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={getTooltipTitle("reject")}>
            <span>
              <IconButton
                size="small"
                color="error"
                disabled={!canPerformAction}
                onClick={() =>
                  handleOpenApprovalDialog(params.row, level, "reject")
                }
              >
                <CancelIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      );
    },
  });

  const getStatusChip = (status) => {
    const statusColors = {
      pending: "warning",
      approved: "success",
      rejected: "error",
      not_required: "default",
    };

    const statusLabels = {
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      not_required: "Not Approved",
    };

    return (
      <Chip
        label={statusLabels[status] || status}
        color={statusColors[status] || "default"}
        size="small"
      />
    );
  };

  const getApproverInfo = (approver) => {
    if (!approver || !approver.fullName) return null;
    return `${approver.fullName} (${approver.employeeId || "N/A"})`;
  };

  // Base columns that are common across all levels
  const baseColumns = [
    {
      field: "slNo",
      headerName: "Sl No",
      width: 80,
      minWidth: 80,
      flex: 0.4,
      renderCell: (params) => {
        const index = filteredRows.findIndex((emp) => emp.uniqueId === params.row.uniqueId);
        return index + 1;
      },
    },
    {
      field: "fullName",
      headerName: "Name",
      minWidth: 200,
      flex: 1,
    },
    {
      field: "company",
      headerName: "Subsidiary",
      minWidth: 180,
      flex: 1,
      renderCell: (params) => params.value || "N/A",
    },
    {
      field: "jobTitle",
      headerName: "Job Title",
      minWidth: 150,
      flex: 1,
      renderCell: (params) => params.value || "N/A",
    },
    {
      field: "currentSalary",
      headerName: "Current Salary",
      minWidth: 130,
      flex: 1,
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
      minWidth: 160,
      flex: 1,
      renderCell: (params) => {
        if (params.row.salaryType === "Hourly") {
          const merit = params.row.meritIncreaseDollar || 0;
          return (
            <Typography sx={{ fontWeight: 700, fontSize: "0.875rem" }}>
              {merit > 0 ? `$${merit.toFixed(2)}/hr` : "-"}
            </Typography>
          );
        } else {
          const merit = params.row.meritIncreasePercentage || 0;
          const annualSalary = params.row.annualSalary || 0;
          if (merit === 0) {
            return (
              <Typography sx={{ fontWeight: 700, fontSize: "0.875rem" }}>
                -
              </Typography>
            );
          }
          // Calculate dollar amount from percentage
          const dollarAmount = (annualSalary * merit) / 100;
          return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3 }}>
              <Typography sx={{ fontWeight: 700, fontSize: "0.875rem" }}>
                {merit}%
              </Typography>
              <Typography sx={{ fontWeight: 700, fontSize: "0.7rem", color: "text.secondary" }}>
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
      minWidth: 130,
      flex: 0.6,
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
      headerName: `Variance from ${budgetPercentage}%`,
      minWidth: 160,
      flex: 1,
      renderCell: (params) => {
        // For salaried employees, variance is direct comparison to budget percentage
        if (params.row.salaryType !== "Hourly") {
          const merit = params.row.meritIncreasePercentage || 0;
          // Only show variance if merit has been entered
          if (merit === 0) {
            return "-";
          }
          const variance = merit - budgetPercentage;
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
          // For hourly employees, calculate percentage increase and compare to budget percentage
          const currentRate = params.row.hourlyPayRate || 0;
          const meritDollar = params.row.meritIncreaseDollar || 0;
          // Only show variance if merit has been entered
          if (currentRate === 0 || meritDollar === 0) {
            return "-";
          }
          const percentIncrease = (meritDollar / currentRate) * 100;
          const variance = percentIncrease - budgetPercentage;
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
    {
      field: "supervisorName",
      headerName: "Supervisor",
      minWidth: 150,
      flex: 1,
      renderCell: (params) => params.value || "Not Assigned",
    },
  ];

  // Helper to create Level Approver columns consistently
  const getLevelColumn = (level) => ({
    field: `approvalStatus.level${level}.status`,
    headerName: `Level ${level} (Approver)`,
    minWidth: 260,
    flex: 1.5,
    renderCell: (params) => {
      const status =
        params.row.approvalStatus?.[`level${level}`]?.status || "pending";
      const approverName = params.row[`level${level}ApproverName`];
      return (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 0.5,
            py: 1,
          }}
        >
          {getStatusChip(status)}
          {approverName && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: "0.7rem", lineHeight: 1 }}
            >
              {approverName}
            </Typography>
          )}
        </Box>
      );
    },
  });

  // Level 1 columns - no previous approvals
  const level1Columns = [
    ...baseColumns,
    getLevelColumn(1),
    getActionsColumn(1),
  ];

  // Level 2 columns - show level 1 info + level 2
  const level2Columns = [
    ...baseColumns,
    getLevelColumn(1),
    getLevelColumn(2),
    getActionsColumn(2),
  ];

  // Level 3 columns - show level 2 info + level 3
  const level3Columns = [
    ...baseColumns,
    getLevelColumn(2),
    getLevelColumn(3),
    getActionsColumn(3),
  ];

  // Level 4 columns - show level 3 info + level 4
  const level4Columns = [
    ...baseColumns,
    getLevelColumn(3),
    getLevelColumn(4),
    getActionsColumn(4),
  ];

  // Level 5 columns - show level 4 info + level 5
  const level5Columns = [
    ...baseColumns,
    getLevelColumn(4),
    getLevelColumn(5),
    getActionsColumn(5),
  ];

  // Calculate the current pending level for an employee
  const getPendingLevel = (emp) => {
    for (let i = 1; i <= 5; i++) {
      const status = emp.approvalStatus?.[`level${i}`]?.status || "pending";
      if (status === "pending" && emp[`level${i}Approver`]) {
        return i;
      }
    }
    return 1;
  };

  // Merge all levels into one array
  const mergedRows = [];
  if (
    approvalsData &&
    typeof approvalsData === "object" &&
    !Array.isArray(approvalsData)
  ) {
    Object.keys(approvalsData).forEach((levelKey) => {
      const level = parseInt(levelKey.replace("level", ""));
      const employees = approvalsData[levelKey];
      if (Array.isArray(employees)) {
        employees.forEach((emp) => {
          // Map all level approver names
          const approverNames = {};
          for (let i = 1; i <= 5; i++) {
            const approver = emp[`level${i}Approver`];
            approverNames[`level${i}ApproverName`] = approver
              ? approver.fullName
              : "N/A";
          }

          mergedRows.push({
            ...emp,
            currentPendingLevel: level,
            uniqueId: `${emp.id || emp._id}-${level}`,
            ...approverNames,
          });
        });
      }
    });
  } else if (Array.isArray(approvalsData)) {
    // Fallback if data is already a flat array
    approvalsData.forEach((emp) => {
      // Try to determine level from approvalStatus if not provided
      let level = 1;
      for (let i = 1; i <= 5; i++) {
        if (
          emp.approvalStatus?.[`level${i}`]?.status === "pending" &&
          emp[`level${i}Approver`]
        ) {
          level = i;
          break;
        }
      }

      // Map all level approver names
      const approverNames = {};
      for (let i = 1; i <= 5; i++) {
        const approver = emp[`level${i}Approver`];
        approverNames[`level${i}ApproverName`] = approver
          ? approver.fullName
          : "N/A";
      }

      mergedRows.push({
        ...emp,
        currentPendingLevel: level,
        uniqueId: `${emp.id || emp._id}-${level}`,
        ...approverNames,
      });
    });
  }

  // Determine if we need the Previous Level Approver column
  // Check if there are any rows with level > 1
  const hasHigherLevels = mergedRows.some((row) => row.currentPendingLevel > 1);

  // Previous Level Approver Column (only shown if there are approvals at level 2+)
  const previousLevelColumn = hasHigherLevels
    ? {
        field: "previousLevelApprover",
        headerName: "Previous Level Approver",
        minWidth: 160,
        flex: 1,
        renderCell: (params) => {
          const currentLevel = params.row.currentPendingLevel;

          // If level 1, this shouldn't show, but just in case
          if (currentLevel === 1) {
            return null;
          }

          // Get previous level
          const prevLevel = currentLevel - 1;
          const prevStatus =
            params.row.approvalStatus?.[`level${prevLevel}`]?.status ||
            "pending";
          const prevApproverName = params.row[`level${prevLevel}ApproverName`];

          return (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 0.5,
                p: 1,
                width: "100%",
                height: "100%",
                borderRadius: 1,
              }}
            >
              {prevStatus === "pending" ? (
                <Chip
                  label="Pending"
                  size="small"
                  sx={{
                    bgcolor: "#fff1abff",
                    color: "#ffd60a",
                    fontWeight: "bold",
                    "& .MuiChip-icon": { color: "#795301ff" },
                  }}
                  icon={<HourglassEmptyIcon />}
                />
              ) : (
                getStatusChip(prevStatus)
              )}
              {prevApproverName && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: "0.7rem", lineHeight: 1 }}
                >
                  {prevApproverName}
                </Typography>
              )}
            </Box>
          );
        },
      }
    : null;

  // Create unified columns
  const unifiedColumns = [
    ...baseColumns,
    // Add Previous Level column only if it exists
    ...(previousLevelColumn ? [previousLevelColumn] : []),
    // Approver Level Column
    {
      field: "approverLevel",
      headerName: "Approver Level",
      minWidth: 170,
      flex: 0.8,
      renderCell: (params) => {
        const currentLevel = params.row.currentPendingLevel;

        // Build tooltip content for all assigned levels
        const history = [];
        for (let i = 1; i <= 5; i++) {
          if (
            params.row[`level${i}Approver`] ||
            params.row[`level${i}ApproverName`]
          ) {
            const status =
              params.row.approvalStatus?.[`level${i}`]?.status || "pending";
            const approver = params.row[`level${i}Approver`];

            // Helper to get ordinal text
            const getOrdinalText = (num) => {
              const ordinals = ["first", "second", "third", "fourth", "fifth"];
              return ordinals[num - 1] || `${num}th`;
            };

            const approverName =
              approver && approver.fullName
                ? approver.fullName
                : params.row[`level${i}ApproverName`] && params.row[`level${i}ApproverName`] !== "N/A"
                  ? params.row[`level${i}ApproverName`]
                  : `No ${getOrdinalText(i)} approver`;
            const comments = params.row.approvalStatus?.[`level${i}`]?.comments || null;
            const hasApprover = approver && approver.fullName;
            history.push({
              level: i,
              status,
              approverName,
              comments,
              isCurrent: i === currentLevel,
              hasApprover,
            });
          }
        }

        const tooltipContent = (
          <Box sx={{ p: 1 }}>
            <Typography
              variant="subtitle2"
              sx={{
                mb: 1,
                fontWeight: "bold",
                borderBottom: "1px solid rgba(255,255,255,0.2)",
                pb: 0.5,
              }}
            >
              Approval History
            </Typography>
            {history.length === 0 ? (
              <Typography variant="caption">Initial approval level</Typography>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {history.map((h) => (
                  <Box
                    key={h.level}
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 0.5,
                      p: h.isCurrent ? 0.5 : 0,
                      borderRadius: 1,
                      bgcolor: h.isCurrent
                        ? "rgba(255,255,255,0.1)"
                        : "transparent",
                      border: h.isCurrent
                        ? "1px solid rgba(255,255,255,0.2)"
                        : "none",
                    }}
                  >
                    {h.hasApprover ? (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            minWidth: 50,
                            fontWeight: h.isCurrent ? "bold" : "normal",
                          }}
                        >
                          Level {h.level}:
                        </Typography>
                        <Chip
                          label={
                            h.status === "approved"
                              ? "APPROVED"
                              : h.status === "rejected"
                                ? "REJECTED"
                                : "NOT APPROVED"
                          }
                          size="small"
                          color={
                            h.status === "approved"
                              ? "success"
                              : h.status === "rejected"
                                ? "error"
                                : "default"
                          }
                          sx={{ height: 20, fontSize: "0.65rem" }}
                        />
                        <Typography
                          variant="caption"
                          color="inherit"
                          sx={{ fontStyle: "italic", ml: 0.5 }}
                        >
                          by {h.approverName}
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            minWidth: 50,
                            fontWeight: h.isCurrent ? "bold" : "normal",
                            color: "rgba(255,255,255,0.9)",
                          }}
                        >
                          Level {h.level}:
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            fontStyle: "italic",
                            color: "rgba(255,255,255,0.8)",
                          }}
                        >
                          {h.approverName}
                        </Typography>
                      </Box>
                    )}
                    {h.comments && (
                      <Typography
                        variant="caption"
                        sx={{
                          ml: 6.5,
                          fontStyle: "italic",
                          color: "rgba(255,255,255,0.7)",
                        }}
                      >
                        "{h.comments}"
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        );

        return (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-start", height: "100%", gap: 1 }}>
            <Chip
              label={`Level ${currentLevel}`}
              size="small"
              variant="outlined"
            />
            <Tooltip title={tooltipContent} arrow placement="right">
              <IconButton size="small" color="primary">
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      },
    },
    {
      field: "actions",
      headerName: "Actions",
      minWidth: 220,
      flex: 1.1,
      sortable: false,
      renderCell: (params) => {
        const level = params.row.currentPendingLevel;
        const currentStatus =
          params.row.approvalStatus?.[`level${level}`]?.status || "pending";
        const isApproved = currentStatus === "approved";
        const isRejected = currentStatus === "rejected";
        const approvalState = canApprove(params.row, level);
        const canPerformAction = approvalState.can;

        // Check if submitted for approval
        const isSubmittedForApproval = params.row.approvalStatus?.submittedForApproval === true;

        // If NOT submitted for approval, show LOCKED state
        if (!isSubmittedForApproval) {
          return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Chip
                label="Locked"
                size="small"
                sx={{
                  bgcolor: "grey.300",
                  color: "grey.700",
                  fontWeight: "bold",
                  "& .MuiChip-icon": { color: "grey.700" },
                }}
                icon={<CancelIcon />}
              />
              <Tooltip title="Waiting for supervisor to submit merit for approval">
                <IconButton size="small" disabled>
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          );
        }

        // ── Check if next level has rejected ─────────────────────────────
        const nextLevel = level + 1;
        const hasNextLevel = !!(params.row[`level${nextLevel}Approver`] || params.row[`level${nextLevel}ApproverId`]);
        const nextLevelRejected = hasNextLevel &&
          params.row.approvalStatus?.[`level${nextLevel}`]?.status === "rejected";

        if (nextLevelRejected) {
          const rejectedByName = params.row[`level${nextLevel}ApproverName`] ||
            params.row[`level${nextLevel}Approver`]?.fullName || "Next Approver";
          const rejectionReason = params.row.approvalStatus?.[`level${nextLevel}`]?.comments || "";
          return (
            <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 0.4, height: "100%" }}>
              <Tooltip title="Next level rejected — click to review and resubmit" arrow>
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
                          rejectedBy: rejectedByName,
                          rejectorLevel: nextLevel,
                          rejectionReason,
                          recipientLevel: level,
                        },
                      },
                    });
                  }}
                  sx={{
                    fontWeight: 600,
                    cursor: "pointer",
                    alignSelf: "flex-start",
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
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem", lineHeight: 1.2 }}>
                from Level {nextLevel} · {rejectedByName}
              </Typography>
            </Box>
          );
        }

        const getTooltipTitle = (action) => {
          if (canPerformAction)
            return action === "approve" ? "Approve" : "Reject";
          if (approvalState.reason === "merit_missing")
            return "Merit not added";
          if (approvalState.reason === "prev_level_pending")
            return `Level ${approvalState.prevLevel} must be approved first`;
          return "Not authorized at this time";
        };

        if (isApproved)
          return (
            <Chip
              label="Approved"
              color="success"
              size="small"
              icon={<CheckCircleIcon />}
            />
          );
        if (isRejected)
          return (
            <Chip
              label="Rejected"
              color="error"
              size="small"
              icon={<CancelIcon />}
            />
          );

        return (
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
            <Tooltip title={getTooltipTitle("approve")}>
              <span>
                <IconButton
                  size="small"
                  disabled={!canPerformAction}
                  sx={{ color: canPerformAction ? "green" : "inherit" }}
                  onClick={() =>
                    handleOpenApprovalDialog(params.row, level, "approve")
                  }
                >
                  <CheckCircleIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={getTooltipTitle("reject")}>
              <span>
                <IconButton
                  size="small"
                  disabled={!canPerformAction}
                  sx={{ color: canPerformAction ? "red" : "inherit" }}
                  onClick={() =>
                    handleOpenApprovalDialog(params.row, level, "reject")
                  }
                >
                  <CancelIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Modify Merit & Approve">
              <span>
                <IconButton
                  size="small"
                  disabled={!canPerformAction}
                  sx={{ color: canPerformAction ? "blue" : "inherit" }}
                  onClick={() => {
                    setModifyModal({
                      open: true,
                      employee: params.row,
                      level: level,
                    });
                  }}
                >
                  <EditIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="View Merit Timeline">
              <span>
                <IconButton
                  size="small"
                  sx={{ color: "orange" }}
                  onClick={() => {
                    setTimelineModal({
                      open: true,
                      employee: params.row,
                    });
                  }}
                >
                  <TimelineIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        );
      },
    },
  ];

  // Extract unique supervisors
  const uniqueSupervisors = [
    ...new Set(
      mergedRows.map((row) => row.supervisorName).filter((name) => name), // Remove null/undefined
    ),
  ].sort();

  // Extract unique companies
  const uniqueCompanies = [
    ...new Set(
      mergedRows.map((row) => row.company).filter((name) => name),
    ),
  ].sort();

  // 1. First, apply strict filters (Search, Branch, Role, Supervisor) excluding Status
  // This gives us the "Pool" of relevant employees for the current view
  const baseFilteredRows = mergedRows.filter((row) => {
    // Search Filter
    let searchMatch = true;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      searchMatch =
        row.employeeId?.toLowerCase().includes(query) ||
        row.fullName?.toLowerCase().includes(query) ||
        row.email?.toLowerCase().includes(query);
    }

    // Role Filter
    let roleMatch = true;
    if (selectedRole) {
      roleMatch = row.role === selectedRole;
    }

    // Supervisor Filter
    let supervisorMatch = true;
    if (selectedSupervisor) {
      supervisorMatch = row.supervisorName === selectedSupervisor;
    }

    // Company Filter
    let companyMatch = true;
    if (selectedCompany) {
      companyMatch = row.company === selectedCompany;
    }

    return searchMatch && roleMatch && supervisorMatch && companyMatch;
  });

  // 2. Determine Counts from the "Pool"
  let totalPending = 0;
  let totalApproved = 0;
  let totalRejected = 0;

  baseFilteredRows.forEach((row) => {
    const status =
      row.approvalStatus?.[`level${row.currentPendingLevel}`]?.status ||
      "pending";
    if (status === "approved") {
      totalApproved++;
    } else if (status === "rejected") {
      totalRejected++;
    } else {
      totalPending++;
    }
  });

  // 3. Finally, apply the Status Filter for the visual table list
  const filteredRows = baseFilteredRows.filter((row) => {
    let statusMatch = true;
    if (filterStatus !== "all") {
      const status =
        row.approvalStatus?.[`level${row.currentPendingLevel}`]?.status ||
        "pending";
      if (filterStatus === "pending")
        statusMatch = status !== "approved" && status !== "rejected";
      if (filterStatus === "approved") statusMatch = status === "approved";
      if (filterStatus === "rejected") statusMatch = status === "rejected";
    }
    return statusMatch;
  });

  // Count employees without merit allocation
  const employeesWithoutMerit = mergedRows.filter(
    (row) => !row.approvalStatus?.enteredBy,
  ).length;

  // Calculate team average merit from filtered rows
  const calculateTeamAverageMerit = () => {
    let totalPercentage = 0;
    let count = 0;
    let totalBudgetPool = 0; // Total dollar amount allocated for merits
    let totalSalaryBase = 0; // Total annual salary base for calculating 3% budget

    filteredRows.forEach((emp) => {
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

    if (count === 0) return { average: 0, variance: 0, count: 0, budgetPool: 0, targetBudget: 0 };
    const average = totalPercentage / count;
    const variance = average - budgetPercentage;
    // Calculate what the budget percentage of the total salary base would be
    const targetBudget = (totalSalaryBase * budgetPercentage) / 100;
    return { average, variance, count, budgetPool: totalBudgetPool, targetBudget };
  };

  const teamMeritStats = calculateTeamAverageMerit();

  // Count employees that can actually be approved (have bonus and previous levels approved)
  const approvableCount = baseFilteredRows.filter((row) => {
    const status =
      row.approvalStatus?.[`level${row.currentPendingLevel}`]?.status ||
      "pending";
    // Only count pending employees
    if (status !== "pending") return false;

    // Check if they can be approved using the canApprove function
    const approvalState = canApprove(row, row.currentPendingLevel);
    return approvalState.can;
  }).length;

  // Check if any employees have been approved or rejected
  const hasProcessedEmployees = totalApproved > 0 || totalRejected > 0;

  // Calculate company-wise statistics
  const companyStats = uniqueCompanies.map((company) => {
    const companyEmployees = mergedRows.filter((row) => row.company === company);

    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let totalBudget = 0;
    let totalSalaryBase = 0;
    let meritsAssigned = 0;

    companyEmployees.forEach((emp) => {
      const status = emp.approvalStatus?.[`level${emp.currentPendingLevel}`]?.status || "pending";

      if (status === "approved") {
        approved++;
      } else if (status === "rejected") {
        rejected++;
      } else {
        pending++;
      }

      const isMeritEntered = !!(
        emp.approvalStatus?.enteredBy ||
        (emp.salaryType === "Hourly" && emp.meritIncreaseDollar && parseFloat(emp.meritIncreaseDollar) > 0) ||
        (emp.salaryType !== "Hourly" && emp.meritIncreasePercentage && parseFloat(emp.meritIncreasePercentage) > 0)
      );
      if (isMeritEntered) meritsAssigned++;

      // Calculate budget
      if (emp.salaryType === "Hourly") {
        const currentRate = parseFloat(emp.hourlyPayRate) || 0;
        const meritDollar = parseFloat(emp.meritIncreaseDollar) || 0;
        if (currentRate > 0) {
          totalBudget += meritDollar * 2080;
          totalSalaryBase += currentRate * 2080;
        }
      } else {
        const annualSalary = parseFloat(emp.annualSalary) || 0;
        const merit = parseFloat(emp.meritIncreasePercentage) || 0;
        if (annualSalary > 0) {
          totalBudget += (annualSalary * merit) / 100;
          totalSalaryBase += annualSalary;
        }
      }
    });

    const avgMerit = totalSalaryBase > 0 ? (totalBudget / totalSalaryBase) * 100 : 0;

    return {
      company,
      total: companyEmployees.length,
      meritsAssigned,
      pending,
      approved,
      rejected,
      totalBudget,
      totalSalaryBase,
      avgMerit,
    };
  });

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
          My Approvals
        </Typography>
        {(filterStatus !== "all" || selectedCompany) && (
          <Button
            size="small"
            onClick={() => {
              setFilterStatus("all");
              setSelectedCompany("");
            }}
          >
            Clear All Filters
          </Button>
        )}
      </Box>

      {/* Merit Allocation Message */}
      {employeesWithoutMerit > 0 && (
        <Typography variant="body2" sx={{ mb: 2 }}>
          You have <strong>{employeesWithoutMerit}</strong> employee
          {employeesWithoutMerit !== 1 ? "s" : ""} awaiting merit allocation.{" "}
          <Box
            component="span"
            sx={{
              color: "primary.main",
              cursor: "pointer",
              "&:hover": { textDecoration: "underline" },
            }}
            onClick={() => navigate("/merits")}
          >
            Click here
          </Box>{" "}
          to assign merit of employees under you so that they can be sent for review.
        </Typography>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Company Cards */}
      {companyStats.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Companies Overview
          </Typography>
          <Grid container spacing={2}>
            {companyStats.map((stat) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={stat.company}>
                <Card
                  sx={{
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    border: selectedCompany === stat.company ? "2px solid" : "1px solid",
                    borderColor: selectedCompany === stat.company ? "primary.main" : "divider",
                    bgcolor: selectedCompany === stat.company ? "primary.50" : "background.paper",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: 3,
                      borderColor: "primary.main",
                    },
                  }}
                  onClick={() => {
                    if (selectedCompany === stat.company) {
                      setSelectedCompany("");
                    } else {
                      setSelectedCompany(stat.company);
                    }
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                      <BusinessIcon
                        sx={{
                          fontSize: 28,
                          color: selectedCompany === stat.company ? "primary.main" : "text.secondary"
                        }}
                      />
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: "bold",
                          color: selectedCompany === stat.company ? "primary.main" : "text.primary"
                        }}
                      >
                        {stat.company}
                      </Typography>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Employee merit assigned
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: "bold" }}>
                        {stat.meritsAssigned}/{stat.total}
                      </Typography>
                    </Box>

                    <Box sx={{ display: "flex", gap: 1, mb: 1, flexWrap: "wrap" }}>
                      <Chip
                        label={`Pending: ${stat.pending}`}
                        size="small"
                        color="warning"
                        variant="outlined"
                      />
                      <Chip
                        label={`Approved: ${stat.approved}`}
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                      <Chip
                        label={`Rejected: ${stat.rejected}`}
                        size="small"
                        color="error"
                        variant="outlined"
                      />
                    </Box>

                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 2 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Avg Merit Increase
                          </Typography>
                          <Typography
                            variant="h6"
                            sx={{
                              fontWeight: "bold",
                              color: stat.avgMerit > budgetPercentage ? "error.main" : "success.main",
                              lineHeight: 1.2
                            }}
                          >
                            {stat.avgMerit.toFixed(2)}%
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: "right" }}>
                          <Typography variant="caption" color="text.secondary">
                            Total Merit Budget
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: "bold",
                              color: stat.totalBudget > (stat.totalSalaryBase * budgetPercentage / 100) ? "error.main" : "success.main"
                            }}
                          >
                            ${stat.totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", pt: 1, borderTop: 1, borderColor: "divider" }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {budgetPercentage}% Threshold
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: "bold", color: "info.main" }}>
                            {budgetPercentage.toFixed(2)}%
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: "right" }}>
                          <Typography variant="caption" color="text.secondary">
                            {budgetPercentage}% Budget Pool
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: "bold", color: "info.main" }}>
                            ${(stat.totalSalaryBase * budgetPercentage / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Approvals Table with Filters Header */}
      <Paper sx={{ width: "100%", mb: 2, overflow: "hidden" }}>
        <Box
          sx={{
            p: 2,
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Typography variant="h4" component="div" sx={{ mb: 2 }}>
            Approval Requests{selectedCompany ? ` - ${selectedCompany}` : ""}
          </Typography>

          {/* Status Chips and Bonus Aggregates */}
          <Box sx={{ display: "flex", flexDirection: { xs: "column", lg: "row" }, justifyContent: "space-between", alignItems: { xs: "stretch", lg: "flex-start" }, mb: 2, gap: 2 }}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <Chip
                icon={<PendingActionsIcon />}
                label={`Pending: ${totalPending}`}
                color={filterStatus === "pending" ? "warning" : "default"}
                variant={filterStatus === "pending" ? "filled" : "outlined"}
                clickable
                onClick={() =>
                  setFilterStatus((prev) =>
                    prev === "pending" ? "all" : "pending",
                  )
                }
                sx={{
                  fontWeight: "bold",
                  borderColor: "warning.main",
                  color:
                    filterStatus === "pending"
                      ? "warning.contrastText"
                      : "warning.main",
                  p: 2,
                  "& .MuiChip-label": {
                    fontSize: 13,
                  },
                }}
              />
              <Chip
                icon={<CheckCircleIcon />}
                label={`Approved: ${totalApproved}`}
                color={filterStatus === "approved" ? "success" : "default"}
                variant={filterStatus === "approved" ? "filled" : "outlined"}
                clickable
                onClick={() =>
                  setFilterStatus((prev) =>
                    prev === "approved" ? "all" : "approved",
                  )
                }
                sx={{
                  fontWeight: "bold",
                  borderColor: "success.main",
                  color:
                    filterStatus === "approved"
                      ? "success.contrastText"
                      : "success.main",
                  p: 2,
                  "& .MuiChip-label": {
                    fontSize: 13,
                  },
                }}
              />
              <Chip
                icon={<CancelIcon />}
                label={`Rejected: ${totalRejected}`}
                color={filterStatus === "rejected" ? "error" : "default"}
                variant={filterStatus === "rejected" ? "filled" : "outlined"}
                clickable
                onClick={() =>
                  setFilterStatus((prev) =>
                    prev === "rejected" ? "all" : "rejected",
                  )
                }
                sx={{
                  fontWeight: "bold",
                  borderColor: "error.main",
                  color:
                    filterStatus === "rejected"
                      ? "error.contrastText"
                      : "error.main",
                  p: 2,
                  "& .MuiChip-label": {
                    fontSize: 13,
                  },
                }}
              />
            </Box>

            {/* Team Merit Statistics and Approve All Button */}
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: { xs: "stretch", lg: "flex-end" }, gap: 1, width: { xs: "100%", lg: "auto" } }}>
              <Box sx={{ display: "flex", gap: { xs: 2, md: 2 }, alignItems: "flex-start", flexWrap: "wrap", justifyContent: { xs: "space-between", lg: "flex-end" } }}>
                <Box sx={{ textAlign: "right", minWidth: { xs: "120px", sm: "auto" } }}>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", fontWeight: "medium", fontSize: "0.65rem" }}
                  >
                    Variance Threshold 
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: "bold", color: "primary.main" }}
                  >
                    {budgetPercentage}%
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", fontWeight: "medium", fontSize: "0.65rem" }}
                  >
                    Target budget
                  </Typography>
                </Box>

                <Box sx={{ textAlign: "right", minWidth: { xs: "120px", sm: "auto" } }}>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", fontWeight: "medium", fontSize: "0.65rem" }}
                  >
                    {budgetPercentage}% Current available budget
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: "bold", color: "primary.main" }}
                  >
                    ${teamMeritStats.targetBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", fontWeight: "medium", fontSize: "0.65rem" }}
                  >
                    {budgetPercentage}% of total
                  </Typography>
                </Box>

                <Box sx={{ textAlign: "right", minWidth: { xs: "120px", sm: "auto" } }}>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", fontWeight: "medium", fontSize: "0.65rem" }}
                  >
                    Cumulative Variance
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: "bold", color: teamMeritStats.variance > 0 ? "error.main" : "success.main" }}
                  >
                    {teamMeritStats.average.toFixed(2)}%
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: teamMeritStats.variance > 0 ? "error.main" : "success.main",
                      fontWeight: "medium",
                      fontSize: "0.65rem"
                    }}
                  >
                    {teamMeritStats.variance > 0 ? "+" : ""}{teamMeritStats.variance.toFixed(2)}% from {budgetPercentage}%
                  </Typography>
                </Box>

                <Box sx={{ textAlign: "right", minWidth: { xs: "120px", sm: "auto" } }}>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", fontWeight: "medium", fontSize: "0.65rem" }}
                  >
                    NEW BUDGET POOL
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: "bold", color: teamMeritStats.budgetPool > teamMeritStats.targetBudget ? "error.main" : "success.main" }}
                  >
                    ${teamMeritStats.budgetPool.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", fontWeight: "medium", fontSize: "0.65rem" }}
                  >
                    Total merit increase
                  </Typography>
                </Box>
              </Box>
              <Tooltip
                title={
                  approvableCount === 0
                    ? totalPending === 0
                      ? "There is no one to approve"
                      : "All pending employees need merit allocation or previous level approvals"
                    : hasProcessedEmployees
                      ? `Approve ${approvableCount} remaining eligible merit${approvableCount !== 1 ? "s" : ""}`
                      : "Approve all eligible pending merits"
                }
                arrow
              >
                <span>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircleIcon />}
                    onClick={handleOpenBulkApprovalDialog}
                    disabled={approvableCount === 0}
                    fullWidth={false}
                    sx={{
                      whiteSpace: "nowrap",
                      px: 3,
                      py: 1,
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      alignSelf: { xs: "stretch", lg: "flex-end" },
                      background: approvableCount > 0
                        ? "linear-gradient(135deg, #4caf50 0%, #45a049 100%)"
                        : "rgba(0, 0, 0, 0.12)",
                      boxShadow: approvableCount > 0
                        ? "0 4px 12px rgba(76, 175, 80, 0.3)"
                        : "none",
                      color: "#ffffff",
                      "&:hover": {
                        background: approvableCount > 0
                          ? "linear-gradient(135deg, #45a049 0%, #3d8b40 100%)"
                          : "rgba(0, 0, 0, 0.12)",
                        boxShadow: approvableCount > 0
                          ? "0 6px 16px rgba(76, 175, 80, 0.4)"
                          : "none",
                        transform: approvableCount > 0 ? "translateY(-2px)" : "none",
                      },
                      "&:active": {
                        transform: approvableCount > 0 ? "translateY(0px)" : "none",
                      },
                      "&.Mui-disabled": {
                        background: "rgba(0, 0, 0, 0.12)",
                        color: "rgba(0, 0, 0, 0.26)",
                      },
                      transition: "all 0.2s ease-in-out",
                    }}
                  >
                    {hasProcessedEmployees ? "Approve Remaining" : "Approve All"}
                  </Button>
                </span>
              </Tooltip>
            </Box>
          </Box>

          {/* Horizontal Rule */}
          <Box
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              mb: 2,
              width: "100%",
            }}
          />

          {/* Filters Row */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            {/* Left Side - Company and Supervisor Filters */}
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              {/* Subsidiary Filter */}
              <TextField
                select
                size="small"
                label="Subsidiary"
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                sx={{ minWidth: 200 }}
              >
                <MenuItem value="">All Subsidiaries</MenuItem>
                {uniqueCompanies.map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </TextField>

              {/* Supervisor Filter */}
              <TextField
                select
                size="small"
                label="Supervisor"
                value={selectedSupervisor}
                onChange={(e) => setSelectedSupervisor(e.target.value)}
                sx={{ minWidth: 200 }}
              >
                <MenuItem value="">All Supervisors</MenuItem>
                {uniqueSupervisors.map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            {/* Right Side - Search Filter */}
            <Box
              sx={{
                display: "flex",
                gap: 2,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              {/* Search Bar */}
              <TextField
                size="small"
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ minWidth: 250 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          </Box>
        </Box>
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
        ) : (
          <Box sx={{ p: 2 }}>
            {filteredRows.length === 0 ? (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  minHeight: 200,
                  gap: 2,
                }}
              >
                <Typography variant="body1" color="text.secondary">
                  {filterStatus === "all"
                    ? "No employees require your approval at any level."
                    : filterStatus === "approved"
                      ? "You haven't approved any employees yet."
                      : "No pending approvals found."}
                </Typography>
                {filterStatus !== "all" && (
                  <Button
                    variant="outlined"
                    onClick={() => setFilterStatus("all")}
                  >
                    Show All
                  </Button>
                )}
              </Box>
            ) : (
              <DataGrid
                rows={filteredRows}
                columns={unifiedColumns}
                getRowId={(row) => row.uniqueId}
                rowHeight={60}
                initialState={{
                  pagination: {
                    paginationModel: { pageSize: 10, page: 0 },
                  },
                }}
                pageSizeOptions={[5, 10, 25, 50, 100, 150, 200]}
                disableRowSelectionOnClick
                sx={{
                  border: 0,
                  "& .MuiDataGrid-cell": {
                    display: "flex",
                    alignItems: "center",
                  },
                  "& .MuiDataGrid-cell:hover": {
                    cursor: "pointer",
                  },
                }}
                autoHeight
              />
            )}
          </Box>
        )}
      </Paper>

      {/* Approval Dialog */}
      <Dialog
        open={approvalDialog.open}
        onClose={handleCloseApprovalDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {approvalDialog.action === "approve"
            ? "Approve Employee Merit"
            : "Reject Employee Merit"}
        </DialogTitle>
        <DialogContent>
          {approvalDialog.employee && (
            <>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Employee:</strong> {approvalDialog.employee.fullName} (
                  {approvalDialog.employee.employeeId})
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Current Level:</strong> {approvalDialog.level}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Salary Type:</strong> {approvalDialog.employee.salaryType || "N/A"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Current {approvalDialog.employee.salaryType === "Hourly" ? "Hourly Rate" : "Annual Salary"}:</strong>{" "}
                  {approvalDialog.employee.salaryType === "Hourly"
                    ? `$${(approvalDialog.employee.hourlyPayRate || 0).toFixed(2)}/hr`
                    : `$${(approvalDialog.employee.annualSalary || 0).toLocaleString()}`}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Merit Increase:</strong>{" "}
                  {approvalDialog.employee.salaryType === "Hourly"
                    ? `$${(approvalDialog.employee.meritIncreaseDollar || 0).toFixed(2)}/hr`
                    : `${(approvalDialog.employee.meritIncreasePercentage || 0)}%`}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>New {approvalDialog.employee.salaryType === "Hourly" ? "Hourly Rate" : "Annual Salary"}:</strong>{" "}
                  {approvalDialog.employee.salaryType === "Hourly"
                    ? `$${(approvalDialog.employee.newHourlyRate || 0).toFixed(2)}/hr`
                    : `$${(approvalDialog.employee.newAnnualSalary || 0).toLocaleString()}`}
                </Typography>
              </Box>

              {/* Show previous approval levels if level > 1 */}
              {approvalDialog.level > 1 && (
                <Box
                  sx={{
                    mb: 3,
                    p: 2,
                    bgcolor: "background.default",
                    borderRadius: 1,
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{ mb: 2, fontWeight: "bold" }}
                  >
                    Previous Approval History
                  </Typography>
                  {Array.from(
                    { length: approvalDialog.level - 1 },
                    (_, i) => i + 1,
                  ).map((level) => {
                    const levelKey = `level${level}`;
                    const approvalInfo =
                      approvalDialog.employee.approvalStatus?.[levelKey];
                    const approver =
                      approvalDialog.employee[`level${level}Approver`];
                    // Check if approver exists - if not, show "No approver" instead of "pending"
                    const hasApprover = !!approver;
                    const status = hasApprover ? (approvalInfo?.status || "pending") : "no_approver";
                    const approvedAt = approvalInfo?.approvedAt;
                    const levelComments = approvalInfo?.comments;

                    return (
                      <Box
                        key={level}
                        sx={{
                          mb: 2,
                          pb: 2,
                          borderBottom:
                            level < approvalDialog.level - 1
                              ? "1px solid"
                              : "none",
                          borderColor: "divider",
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mb: 1,
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: "medium" }}
                          >
                            Level {level}:
                          </Typography>
                          {status === "no_approver" ? (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ fontStyle: "italic" }}
                            >
                              No approver
                            </Typography>
                          ) : (
                            getStatusChip(status)
                          )}
                        </Box>
                        {approver && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 0.5 }}
                          >
                            <strong>Approver:</strong> {approver.fullName} ({approver.employeeId})
                          </Typography>
                        )}
                        {approvedAt && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 0.5 }}
                          >
                            <strong>Date:</strong>{" "}
                            {new Date(approvedAt).toLocaleString()}
                          </Typography>
                        )}
                        {levelComments && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 1 }}
                          >
                            <strong>Comments:</strong> {levelComments}
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              )}
            </>
          )}
          <TextField
            autoFocus
            margin="dense"
            label={`Level ${approvalDialog.level} Comments (Optional)`}
            fullWidth
            multiline
            rows={4}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Add any comments about this decision..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseApprovalDialog} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmitApproval}
            variant="contained"
            color={approvalDialog.action === "approve" ? "success" : "error"}
            disabled={submitting}
            sx={{ color: "white" }}
          >
            {submitting
              ? "Processing..."
              : approvalDialog.action === "approve"
                ? "Approve"
                : "Reject"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Approval Confirmation Dialog */}
      <Dialog
        open={bulkApprovalDialog.open}
        onClose={handleCloseBulkApprovalDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{hasProcessedEmployees ? "Approve Remaining Pending Merits" : "Approve All Pending Merits"}</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Are you sure you want to approve {hasProcessedEmployees ? "the remaining" : "all"} pending employee merits at once?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              This action will approve <strong>{approvableCount}</strong> {hasProcessedEmployees ? "remaining " : ""}pending merit{approvableCount !== 1 ? "s" : ""} that are eligible for your approval.
            </Typography>
            <Typography variant="body2" color="warning.main" sx={{ fontStyle: "italic" }}>
              Note: Only employees with merits entered and previous levels approved will be processed.
            </Typography>
          </Box>
          <TextField
            autoFocus
            margin="dense"
            label="Comments (Optional)"
            fullWidth
            multiline
            rows={4}
            value={bulkComments}
            onChange={(e) => setBulkComments(e.target.value)}
            placeholder="Add comments that will apply to all approvals..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseBulkApprovalDialog} disabled={bulkSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmitBulkApproval}
            variant="contained"
            color="success"
            disabled={bulkSubmitting}
            sx={{ color: "white" }}
          >
            {bulkSubmitting ? "Processing..." : hasProcessedEmployees ? "Yes, Approve Remaining" : "Yes, Approve All"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Resubmit Merit Modal — triggered from Next Level Status rejected chip */}
      <ResubmitBonusModal
        open={resubmitModal.open}
        onClose={() => setResubmitModal({ open: false, notification: null })}
        notification={resubmitModal.notification}
        onSuccess={() => {
          setResubmitModal({ open: false, notification: null });
          fetchApprovals();
        }}
      />

      {/* Modify Merit Modal */}
      <ModifyMeritModal
        open={modifyModal.open}
        onClose={() => setModifyModal({ open: false, employee: null, level: null })}
        employee={modifyModal.employee}
        approverId={user?.id || user?._id}
        approverLevel={modifyModal.level}
        onMeritModified={() => {
          setModifyModal({ open: false, employee: null, level: null });
          fetchApprovals();
        }}
      />

      {/* Merit Timeline Modal */}
      <MeritTimelineModal
        open={timelineModal.open}
        onClose={() => setTimelineModal({ open: false, employee: null })}
        employee={timelineModal.employee}
      />

      {/* Bulk Approval Result Dialog */}
      <Dialog
        open={bulkResultDialog.open}
        onClose={handleCloseBulkResultDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CheckCircleIcon color="success" fontSize="large" />
            <Typography variant="h6">Bulk Approval Complete</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            {bulkResultDialog.approvedCount > 0 ? (
              <Alert severity="success" sx={{ mb: 2 }}>
                Successfully approved <strong>{bulkResultDialog.approvedCount}</strong> employee{bulkResultDialog.approvedCount !== 1 ? "s" : ""}!
              </Alert>
            ) : (
              <Alert severity="info" sx={{ mb: 2 }}>
                No employees were approved.
              </Alert>
            )}

            {bulkResultDialog.skippedEmployees && bulkResultDialog.skippedEmployees.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: "bold" }}>
                  Skipped {bulkResultDialog.skippedEmployees.length} employee{bulkResultDialog.skippedEmployees.length !== 1 ? "s" : ""}:
                </Typography>
                <Box
                  sx={{
                    maxHeight: 300,
                    overflow: "auto",
                    bgcolor: "background.default",
                    borderRadius: 1,
                    p: 2,
                  }}
                >
                  {bulkResultDialog.skippedEmployees.map((emp, index) => (
                    <Box
                      key={index}
                      sx={{
                        mb: 1.5,
                        pb: 1.5,
                        borderBottom: index < bulkResultDialog.skippedEmployees.length - 1 ? "1px solid" : "none",
                        borderColor: "divider",
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: "medium" }}>
                        {emp.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Reason: {emp.reason}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseBulkResultDialog} variant="contained" color="primary">
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Approvals;
