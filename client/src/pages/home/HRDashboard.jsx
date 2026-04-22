import { useState, useEffect } from "react";
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Paper,
  TextField,
  MenuItem,
  InputAdornment,
  LinearProgress,
  Button,
  Snackbar,
  IconButton,
  Tooltip,
  Divider,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { PieChart } from "@mui/x-charts/PieChart";
import { BarChart } from "@mui/x-charts/BarChart";
import PeopleIcon from "@mui/icons-material/People";
import SearchIcon from "@mui/icons-material/Search";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import EditIcon from "@mui/icons-material/Edit";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import DeleteIcon from "@mui/icons-material/Delete";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import TimelineIcon from "@mui/icons-material/Timeline";
import useDashboardStats from "../../hooks/useDashboardStats";
import api from "../../utils/api";
import EditEmployeeMeritModal from "../../components/modals/EditEmployeeMeritModal";
import ConfirmDialog from "../../components/modals/ConfirmDialog";
import MeritTimelineModal from "../../components/modals/MeritTimelineModal";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useMeritSettings } from "../../contexts/MeritSettingsContext";

const HRDashboard = ({ user }) => {
  const {
    staffCount,
    loading: statsLoading,
    error: statsError,
  } = useDashboardStats();

  // Get dynamic merit settings
  const { budgetPercentage, meritYear } = useMeritSettings();
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openEditModal, setOpenEditModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedSupervisor, setSelectedSupervisor] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedApprovalStatus, setSelectedApprovalStatus] = useState(""); // pending, completed, or not-started

  // UKG Export states
  const [ukgExportEnabled, setUkgExportEnabled] = useState(false);
  const [ukgExportLoading, setUkgExportLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // Delete and Reset states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Timeline modal state
  const [timelineModal, setTimelineModal] = useState({
    open: false,
    employee: null,
  });

  const checkUKGExportStatus = async () => {
    try {
      const response = await api.get("/v2/employees/ukg/approvals-status");
      const { data } = response;
      setUkgExportEnabled(data.allApprovalsCompleted);
    } catch (err) {
      console.error("Error checking UKG export status:", err);
      setUkgExportEnabled(false);
    }
  };

  const handleUKGExportClick = () => {
    if (!ukgExportEnabled) {
      setSnackbarMessage(
        "This export only works after adding merits and approving all levels (Level 1-5) for all employees with merits."
      );
      setSnackbarOpen(true);
      return;
    }
    handleUKGExport();
  };

  const handleUKGExport = async () => {
    setUkgExportLoading(true);
    try {
      const response = await api.get("/v2/employees/ukg/export", {
        responseType: "blob",
      });

      // Create a blob from the response
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      // Create a temporary URL for the blob
      const url = window.URL.createObjectURL(blob);

      // Create a temporary anchor element and trigger download
      const link = document.createElement("a");
      link.href = url;
      link.download = `UKG_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSnackbarMessage("UKG export downloaded successfully!");
      setSnackbarOpen(true);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "An error occurred while exporting to UKG"
      );
    } finally {
      setUkgExportLoading(false);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // Delete All Employees Handler
  const handleDeleteAllEmployees = async () => {
    setDeleteLoading(true);
    try {
      const response = await api.delete("/v2/employees/delete-all");

      setSnackbarMessage(
        response.data.message ||
        `Successfully deleted ${response.data.deletedCount} employees`
      );
      setSnackbarOpen(true);
      setDeleteDialogOpen(false);

      // Refresh employee list
      const fetchResponse = await api.get("/v2/employees");
      const filteredData = fetchResponse.data.data.filter(emp => emp.email !== "hr@pvschemicals.com");
      setEmployees(filteredData);
      setFilteredEmployees(filteredData);
      checkUKGExportStatus();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "An error occurred while deleting employees"
      );
      setSnackbarMessage("Failed to delete employees");
      setSnackbarOpen(true);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Reset Merit Data Handler
  const handleResetMeritData = async () => {
    setResetLoading(true);
    try {
      const response = await api.post("/v2/employees/reset-merits");

      setSnackbarMessage(
        response.data.message ||
        `Successfully reset merit data for ${response.data.resetCount} employees`
      );
      setSnackbarOpen(true);
      setResetDialogOpen(false);

      // Refresh employee list
      const fetchResponse = await api.get("/v2/employees");
      const filteredData = fetchResponse.data.data.filter(emp => emp.email !== "hr@pvschemicals.com");
      setEmployees(filteredData);
      setFilteredEmployees(filteredData);
      checkUKGExportStatus();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "An error occurred while resetting merit data"
      );
      setSnackbarMessage("Failed to reset merit data");
      setSnackbarOpen(true);
    } finally {
      setResetLoading(false);
    }
  };

  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/v2/employees");
        // Filter out HR account from all displays and calculations
        const filteredData = response.data.data.filter(emp => emp.email !== "hr@pvschemicals.com");
        setEmployees(filteredData);
        setFilteredEmployees(filteredData);

        // Check UKG export status
        checkUKGExportStatus();
      } catch (err) {
        setError(
          err.response?.data?.message ||
            err.message ||
            "An error occurred while fetching employees",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  // Apply filters whenever filter values change
  useEffect(() => {
    let filtered = [...employees];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (emp) =>
          emp.employeeId?.toLowerCase().includes(query) ||
          emp.fullName?.toLowerCase().includes(query) ||
          emp.email?.toLowerCase().includes(query),
      );
    }

    // Role filter
    if (selectedRole) {
      filtered = filtered.filter((emp) => emp.role === selectedRole);
    }

    // Status filter
    if (selectedStatus !== "") {
      const isActive = selectedStatus === "active";
      filtered = filtered.filter((emp) => emp.isActive === isActive);
    }

    // Supervisor filter
    if (selectedSupervisor) {
      filtered = filtered.filter(
        (emp) => emp.supervisorName === selectedSupervisor,
      );
    }

    // Company filter
    if (selectedCompany) {
      filtered = filtered.filter((emp) => emp.company === selectedCompany);
    }

    // Approvals filter (pending, completed, or not-started)
    if (selectedApprovalStatus) {
      filtered = filtered.filter((emp) => {
        // Check if merit has been assigned
        const hasMeritAssigned = !!(
          emp.approvalStatus?.enteredBy ||
          (emp.salaryType === "Hourly" && emp.meritIncreaseDollar && parseFloat(emp.meritIncreaseDollar) > 0) ||
          (emp.salaryType !== "Hourly" && emp.meritIncreasePercentage && parseFloat(emp.meritIncreasePercentage) > 0)
        );

        // Check if all assigned approvals are completed
        let allApprovalsCompleted = true;
        let hasAnyApprover = false;

        for (let i = 1; i <= 5; i++) {
          const approver = emp[`level${i}Approver`];
          if (approver) {
            hasAnyApprover = true;
            const status = emp.approvalStatus?.[`level${i}`]?.status;
            if (status !== "approved") {
              allApprovalsCompleted = false;
              break;
            }
          }
        }

        // If employee has no approvers assigned, consider as pending
        if (!hasAnyApprover) {
          allApprovalsCompleted = false;
        }

        if (selectedApprovalStatus === "completed") {
          return allApprovalsCompleted && hasAnyApprover;
        } else if (selectedApprovalStatus === "pending") {
          return !allApprovalsCompleted && hasMeritAssigned;
        } else if (selectedApprovalStatus === "not-started") {
          return !hasMeritAssigned;
        }
        return true;
      });
    }

    setFilteredEmployees(filtered);
  }, [
    searchQuery,
    selectedRole,
    selectedStatus,
    selectedSupervisor,
    selectedCompany,
    selectedApprovalStatus,
    employees,
  ]);

  const handleEditClick = (employee) => {
    setSelectedEmployee(employee);
    setOpenEditModal(true);
  };

  const handleCloseEditModal = () => {
    setOpenEditModal(false);
    setSelectedEmployee(null);
  };

  const handleEmployeeUpdated = () => {
    setOpenEditModal(false);
    setSelectedEmployee(null);
    // Refresh the employee list
    const fetchEmployees = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/v2/employees");
        const filteredData = response.data.data.filter(emp => emp.email !== "hr@pvschemicals.com");
        setEmployees(filteredData);
        setFilteredEmployees(filteredData);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            err.message ||
            "An error occurred while fetching employees",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  };

  // Extract unique supervisors from all employees
  const uniqueSupervisors = [
    ...new Set(
      employees.map((emp) => emp.supervisorName).filter((name) => name),
    ),
  ].sort();

  // Extract unique companies from all employees
  const uniqueCompanies = [
    ...new Set(employees.map((emp) => emp.company).filter((name) => name)),
  ].sort();

  // Calculate allocated merit variance for selected supervisor
  const calculateSupervisorVariance = () => {
    if (!selectedSupervisor) return { average: 0, variance: 0 };

    const supervisorEmployees = employees.filter(
      (emp) => emp.supervisorName === selectedSupervisor
    );

    let totalPercentage = 0;
    let count = 0;

    supervisorEmployees.forEach((emp) => {
      if (emp.salaryType === "Hourly") {
        const currentRate = parseFloat(emp.hourlyPayRate) || 0;
        const meritDollar = parseFloat(emp.meritIncreaseDollar) || 0;
        if (currentRate > 0 && meritDollar > 0) {
          const percentIncrease = (meritDollar / currentRate) * 100;
          totalPercentage += percentIncrease;
          count++;
        }
      } else {
        const merit = parseFloat(emp.meritIncreasePercentage) || 0;
        if (merit > 0) {
          totalPercentage += merit;
          count++;
        }
      }
    });

    if (count === 0) return { average: 0, variance: 0 };

    const average = totalPercentage / count;
    const variance = average - budgetPercentage;

    return { average, variance };
  };

  const supervisorVariance = calculateSupervisorVariance();

  // Calculate supervisor merit statistics
  const supervisorStats = uniqueSupervisors.map((supervisorName) => {
    const supervisorEmployees = employees.filter(
      (emp) => emp.supervisorName === supervisorName,
    );
    const totalEmployees = supervisorEmployees.length;
    const employeesWithMerit = supervisorEmployees.filter(
      (emp) =>
        (parseFloat(emp.meritIncreasePercentage) > 0) ||
        (parseFloat(emp.meritIncreaseDollar) > 0)
    ).length;
    const percentage =
      totalEmployees > 0
        ? ((employeesWithMerit / totalEmployees) * 100).toFixed(1)
        : 0;

    return {
      id: supervisorName,
      supervisorName,
      totalEmployees,
      employeesWithBonus: employeesWithMerit,
      percentage: parseFloat(percentage),
    };
  });

  // Calculate approver merit statistics
  const calculateApproverStats = () => {
    const approverMap = new Map();

    // Iterate through all employees
    employees.forEach((emp) => {
      // Check each approval level (1-5)
      for (let level = 1; level <= 5; level++) {
        const approverName = emp[`level${level}ApproverName`];

        // Skip if no approver or approver is "Not Assigned" or "-"
        if (!approverName || approverName === "Not Assigned" || approverName === "-") {
          continue;
        }

        // Initialize approver stats if not exists
        if (!approverMap.has(approverName)) {
          approverMap.set(approverName, {
            approverName,
            approved: 0,
            pending: 0,
            rejected: 0,
            total: 0,
          });
        }

        const stats = approverMap.get(approverName);
        const status = emp.approvalStatus?.[`level${level}`]?.status;

        // Count based on status
        if (status === "approved") {
          stats.approved++;
        } else if (status === "rejected") {
          stats.rejected++;
        } else {
          // pending or no status
          stats.pending++;
        }
        stats.total++;
      }
    });

    // Convert map to array and add IDs
    return Array.from(approverMap.values()).map((stats, index) => ({
      id: stats.approverName,
      ...stats,
    }));
  };

  const approverStats = calculateApproverStats();

  // Calculate donut chart data - Merit allocation status
  const totalActiveEmployees = employees.filter((emp) => emp.isActive).length;
  const employeesWithMerit2025 = employees.filter(
    (emp) =>
      emp.isActive &&
      ((parseFloat(emp.meritIncreasePercentage) > 0) ||
        (parseFloat(emp.meritIncreaseDollar) > 0))
  ).length;
  const employeesWithoutMerit = totalActiveEmployees - employeesWithMerit2025;

  const bonusChartData = [
    {
      id: 0,
      value: employeesWithMerit2025,
      color: "#4caf50",
    },
    {
      id: 1,
      value: employeesWithoutMerit,
      color: "#ff9800",
    },
  ];

  // Calculate approval completion stats
  // First, get employees that need approvals (have merit + have at least one approver)
  const employeesNeedingApprovals = employees.filter((emp) => {
    // Check if merit has been assigned (same logic as "Merits Assigned" card)
    const hasMeritAssigned = !!(
      (parseFloat(emp.meritIncreasePercentage) > 0) ||
      (parseFloat(emp.meritIncreaseDollar) > 0)
    );

    const hasAnyApprover = !!(
      (emp.level1ApproverName && emp.level1ApproverName !== "-") ||
      (emp.level2ApproverName && emp.level2ApproverName !== "-") ||
      (emp.level3ApproverName && emp.level3ApproverName !== "-") ||
      (emp.level4ApproverName && emp.level4ApproverName !== "-") ||
      (emp.level5ApproverName && emp.level5ApproverName !== "-")
    );

    return hasMeritAssigned && hasAnyApprover;
  });

  const totalEmployeesNeedingApprovals = employeesNeedingApprovals.length;

  // Now count how many of those have completed all their approvals
  const fullyApprovedCount = employeesNeedingApprovals.filter((emp) => {
    // Check if all assigned levels are approved
    for (let i = 1; i <= 5; i++) {
      const approver = emp[`level${i}ApproverName`];
      if (approver && approver !== "-") {
        const status = emp.approvalStatus?.[`level${i}`]?.status;
        if (status !== "approved") {
          return false;
        }
      }
    }

    // All assigned approvals are completed
    return true;
  }).length;

  // Calculate team average merit percentage (for display in stats card)
  const calculateTeamAverageMerit = () => {
    let totalPercentage = 0;
    let totalBudgetPool = 0; // Total dollar amount allocated for merits
    let totalSalaryBase = 0; // Total annual salary base for all employees
    let totalSalaryBaseWithMerits = 0; // Salary base only for employees with merits entered
    let count = 0;

    employees.forEach((emp) => {
      if (emp.salaryType === "Hourly") {
        const currentRate = parseFloat(emp.hourlyPayRate) || 0;
        const annualizedSalary = currentRate * 2080; // 2080 hours per year

        // Always add to total salary base if employee has a current rate
        if (currentRate > 0) {
          totalSalaryBase += annualizedSalary;
        }

        const meritDollar = parseFloat(emp.meritIncreaseDollar) || 0;
        if (currentRate > 0 && meritDollar > 0) {
          const percentIncrease = (meritDollar / currentRate) * 100;
          totalPercentage += percentIncrease;
          totalBudgetPool += meritDollar * 2080; // Annualize the hourly merit increase
          totalSalaryBaseWithMerits += annualizedSalary;
          count++;
        }
      } else {
        const annualSalary = parseFloat(emp.annualSalary) || 0;

        if (annualSalary > 0) {
          totalSalaryBase += annualSalary;
        }

        const merit = parseFloat(emp.meritIncreasePercentage) || 0;
        if (merit > 0) {
          totalPercentage += merit;
          totalBudgetPool += (annualSalary * merit) / 100;
          totalSalaryBaseWithMerits += annualSalary;
          count++;
        }
      }
    });

    const simpleAverage = count > 0 ? totalPercentage / count : 0;
    // Calculate budget pool based on current budget percentage
    const budgetPool = (totalSalaryBase * budgetPercentage) / 100;

    return {
      average: simpleAverage,
      budgetPool: totalBudgetPool,
      targetBudget: budgetPool
    };
  };

  const teamAverageMeritData = calculateTeamAverageMerit();
  const teamAverageMerit = teamAverageMeritData.average;

  // Supervisor table columns
  const supervisorColumns = [
    {
      field: "slNo",
      headerName: "SL. No",
      width: 80,
      renderCell: (params) => {
        const rows = params.api.getAllRowIds();
        return rows.indexOf(params.id) + 1;
      },
    },
    {
      field: "supervisorName",
      headerName: "Supervisor Name",
      flex: 1,
      minWidth: 200,
    },
    {
      field: "totalEmployees",
      headerName: "Total Employees",
      width: 150,
      align: "center",
      headerAlign: "center",
    },
    {
      field: "employeesWithBonus",
      headerName: "Employees with Merit",
      width: 180,
      align: "center",
      headerAlign: "center",
    },
    {
      field: "percentage",
      headerName: "Merit Allocation %",
      width: 200,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => (
        <Box
          sx={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 1,
            mt: 1,
          }}
        >
          <Box sx={{ width: "100%", position: "relative" }}>
            <LinearProgress
              variant="determinate"
              value={params.value}
              sx={{
                height: 24,
                borderRadius: 2,
                backgroundColor: "action.hover",
                "& .MuiLinearProgress-bar": {
                  borderRadius: 2,
                  backgroundColor:
                    params.value >= 50 ? "success.main" : "warning.main",
                },
              }}
            />
            <Typography
              variant="caption"
              sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                fontWeight: 700,
                color: params.value > 30 ? "white" : "text.primary",
                zIndex: 1,
              }}
            >
              {params.value}%
            </Typography>
          </Box>
        </Box>
      ),
    },
  ];

  // Approval Statistics columns with progress bars
  const approvalStatsColumns = [
    {
      field: "slNo",
      headerName: "SL. No",
      width: 70,
      renderCell: (params) => {
        const rows = params.api.getAllRowIds();
        return rows.indexOf(params.id) + 1;
      },
    },
    {
      field: "fullName",
      headerName: "Employee Name",
      flex: 1,
      minWidth: 180,
    },
    {
      field: "meritAmount",
      headerName: "Merit",
      width: 120,
      renderCell: (params) => {
        const emp = params.row;
        if (emp.salaryType === "Hourly") {
          return emp.meritIncreaseDollar
            ? `$${parseFloat(emp.meritIncreaseDollar).toFixed(2)}/hr`
            : "Not assigned";
        } else {
          return emp.meritIncreasePercentage ? `${emp.meritIncreasePercentage}%` : "Not assigned";
        }
      },
    },
    {
      field: "approvalProgress",
      headerName: "Approval Progress",
      flex: 2,
      minWidth: 450,
      sortable: false,
      renderCell: (params) => {
        const emp = params.row;
        const approvalLevels = [
          { name: "Approver 1", approver: emp.level1ApproverName, status: emp.approvalStatus?.level1?.status },
          { name: "Approver 2", approver: emp.level2ApproverName, status: emp.approvalStatus?.level2?.status },
          { name: "Approver 3", approver: emp.level3ApproverName, status: emp.approvalStatus?.level3?.status },
          { name: "Approver 4", approver: emp.level4ApproverName, status: emp.approvalStatus?.level4?.status },
          { name: "Approver 5", approver: emp.level5ApproverName, status: emp.approvalStatus?.level5?.status },
        ];

        return (
          <Box sx={{ width: "100%", py: 1 }}>
            <Box sx={{ display: "flex", gap: 0.5, mb: 0.5 }}>
              {approvalLevels.map((level, i) => {
                const isActive = level.approver && level.approver !== "Not Assigned" && level.approver !== "-";
                let bgColor = "#e0e0e0"; // light teal for not assigned
                if (isActive) {
                  if (level.status === "approved") {
                    bgColor = "#4caf50"; // green
                  } else if (level.status === "rejected") {
                    bgColor = "#e11d48"; // red
                  } else {
                    bgColor = "#ffcc00"; // yellow for pending
                  }
                }

                return (
                  <Box
                    key={i}
                    sx={{
                      flex: 1,
                      height: 10,
                      borderRadius: "2px",
                      bgcolor: bgColor,
                      position: "relative",
                      overflow: "hidden",
                      ...(isActive && level.status === "pending" && {
                        animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                        "@keyframes pulse": {
                          "0%, 100%": { opacity: 1 },
                          "50%": { opacity: 0.7 },
                        },
                      }),
                    }}
                  />
                );
              })}
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              {approvalLevels.map((level, i) => {
                const isActive = level.approver && level.approver !== "Not Assigned" && level.approver !== "-";
                const approverName = isActive ? level.approver : "No Approver";
                return (
                  <Box
                    key={i}
                    sx={{
                      width: "20%",
                      textAlign: "center",
                      display: "flex",
                      flexDirection: "column",
                      gap: 0.25,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: "9px",
                        color: "text.secondary",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        fontWeight: 600,
                      }}
                    >
                      {level.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: "8px",
                        color: isActive ? "text.primary" : "#00897b",
                        lineHeight: 1.2,
                        fontWeight: 500,
                      }}
                    >
                      {approverName}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        );
      },
    },
    {
      field: "status",
      headerName: "Status",
      width: 120,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => {
        const emp = params.row;
        const approvalLevels = [
          { approver: emp.level1ApproverName, status: emp.approvalStatus?.level1?.status },
          { approver: emp.level2ApproverName, status: emp.approvalStatus?.level2?.status },
          { approver: emp.level3ApproverName, status: emp.approvalStatus?.level3?.status },
          { approver: emp.level4ApproverName, status: emp.approvalStatus?.level4?.status },
          { approver: emp.level5ApproverName, status: emp.approvalStatus?.level5?.status },
        ];

        const activeApprovals = approvalLevels.filter(
          (level) => level.approver && level.approver !== "Not Assigned" && level.approver !== "-"
        );

        const completedCount = activeApprovals.filter((level) => level.status === "approved").length;
        const totalCount = activeApprovals.length;
        const hasRejection = activeApprovals.some((level) => level.status === "rejected");

        // Check if merit is assigned
        const hasMerit = !!(
          (emp.salaryType === "Hourly" && emp.meritIncreaseDollar && parseFloat(emp.meritIncreaseDollar) > 0) ||
          (emp.salaryType !== "Hourly" && emp.meritIncreasePercentage && parseFloat(emp.meritIncreasePercentage) > 0)
        );

        let statusText = "In Progress";
        let statusColor = "text.secondary";

        if (completedCount === totalCount) {
          statusText = "Complete";
          statusColor = "success.main";
        } else if (hasRejection) {
          statusText = "Rejected";
          statusColor = "error.main";
        } else if (!hasMerit) {
          statusText = "Not Started";
          statusColor = "warning.main";
        }

        return (
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary", fontSize: "0.875rem" }}>
              {completedCount}/{totalCount}
            </Typography>
            <Typography variant="caption" sx={{ color: statusColor, fontSize: "10px" }}>
              {statusText}
            </Typography>
          </Box>
        );
      },
    },
  ];

  const columns = [
    {
      field: "slNo",
      headerName: "SL. No",
      width: 70,
      renderCell: (params) => {
        const rows = params.api.getAllRowIds();
        return rows.indexOf(params.id) + 1;
      },
    },
    {
      field: "fullName",
      headerName: "Name",
      width: 200,
      valueGetter: (value) => value?.trim() || "",
      renderCell: (params) => {
        return <div style={{ whiteSpace: "pre", userSelect: "text" }}>{params.value}</div>;
      },
    },
    {
      field: "company",
      headerName: "Subsidiary",
      width: 180,
      renderCell: (params) => params.value || "N/A",
    },
    {
      field: "email",
      headerName: "Email",
      width: 220,
      renderCell: (params) => params.value || "N/A",
    },
    {
      field: "jobTitle",
      headerName: "Job Title",
      width: 180,
      renderCell: (params) => params.value || "N/A",
    },
    {
      field: "supervisorName",
      headerName: "Supervisor",
      width: 180,
      valueGetter: (value, row) => {
        const supervisorName = value?.trim() || "Not Assigned";
        const isMeritEntered = !!(
          row.approvalStatus?.enteredBy ||
          (row.salaryType === "Hourly" && row.meritIncreaseDollar && parseFloat(row.meritIncreaseDollar) > 0) ||
          (row.salaryType !== "Hourly" && row.meritIncreasePercentage && parseFloat(row.meritIncreasePercentage) > 0)
        );
        return isMeritEntered && value ? `${supervisorName} ✓` : supervisorName;
      },
      cellClassName: (params) => {
        const isMeritEntered = !!(
          params.row.approvalStatus?.enteredBy ||
          (params.row.salaryType === "Hourly" && params.row.meritIncreaseDollar && parseFloat(params.row.meritIncreaseDollar) > 0) ||
          (params.row.salaryType !== "Hourly" && params.row.meritIncreasePercentage && parseFloat(params.row.meritIncreasePercentage) > 0)
        );
        return isMeritEntered && params.row.supervisorName ? "cell-approved" : "";
      },
    },
    {
      field: "salaryType",
      headerName: "Salary Type",
      width: 130,
      renderCell: (params) => params.value || "N/A",
    },
    {
      field: "currentSalary",
      headerName: "Current Salary",
      width: 150,
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
      width: 140,
      renderCell: (params) => {
        if (params.row.salaryType === "Hourly") {
          const merit = params.row.meritIncreaseDollar || 0;
          return merit > 0 ? `$${merit.toFixed(2)}/hr` : "-";
        } else {
          const merit = params.row.meritIncreasePercentage || 0;
          return merit > 0 ? `${merit}%` : "-";
        }
      },
    },
    {
      field: "newSalary",
      headerName: "New Salary",
      width: 150,
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
      field: "level1ApproverName",
      headerName: "Approver 1",
      width: 160,
      valueGetter: (value) => value?.trim() || "Not Assigned",
      cellClassName: (params) => {
        const status = params.row.approvalStatus?.level1?.status;
        return status === "approved" ? "cell-approved" : status === "rejected" ? "cell-rejected" : "";
      },
    },
    {
      field: "level2ApproverName",
      headerName: "Approver 2",
      width: 160,
      valueGetter: (value) => value?.trim() || "Not Assigned",
      cellClassName: (params) => {
        const status = params.row.approvalStatus?.level2?.status;
        return status === "approved" ? "cell-approved" : status === "rejected" ? "cell-rejected" : "";
      },
    },
    {
      field: "level3ApproverName",
      headerName: "Approver 3",
      width: 160,
      valueGetter: (value) => value?.trim() || "Not Assigned",
      cellClassName: (params) => {
        const status = params.row.approvalStatus?.level3?.status;
        return status === "approved" ? "cell-approved" : status === "rejected" ? "cell-rejected" : "";
      },
    },
    {
      field: "level4ApproverName",
      headerName: "Approver 4",
      width: 160,
      valueGetter: (value) => value?.trim() || "Not Assigned",
      cellClassName: (params) => {
        const status = params.row.approvalStatus?.level4?.status;
        return status === "approved" ? "cell-approved" : status === "rejected" ? "cell-rejected" : "";
      },
    },
    {
      field: "level5ApproverName",
      headerName: "Approver 5",
      width: 160,
      valueGetter: (value) => value?.trim() || "Not Assigned",
      cellClassName: (params) => {
        const status = params.row.approvalStatus?.level5?.status;
        return status === "approved" ? "cell-approved" : status === "rejected" ? "cell-rejected" : "";
      },
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 180,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <Tooltip title="Edit Merit">
            <IconButton
              size="small"
              color="primary"
              onClick={() => handleEditClick(params.row)}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="View Merit Timeline">
            <IconButton
              size="small"
              color="info"
              onClick={() => {
                setTimelineModal({
                  open: true,
                  employee: params.row,
                });
              }}
            >
              <TimelineIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  if (statsError || error) {
    return (
      <Box sx={{ mb: 4 }}>
        <Alert severity="error">
          Failed to load dashboard data: {statsError || error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 4 }}>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4, xl: 3 }}>
          <Card
            sx={{
              height: "100%",
              background:
                "linear-gradient(135deg, hsl(210, 100%, 95%) 0%, hsl(210, 100%, 92%) 100%)",
              borderRadius: 2,
              border: "1px solid",
              borderColor: "primary.light",
              boxShadow: "0 4px 20px 0 rgba(0,0,0,0.08)",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": {
                transform: "translateY(-4px)",
                boxShadow: "0 8px 30px 0 rgba(33, 150, 243, 0.15)",
              },
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      backgroundColor: "primary.main",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <PeopleIcon sx={{ fontSize: 28, color: "white" }} />
                  </Box>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      color: "primary.dark",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      fontSize: "0.75rem",
                    }}
                  >
                    Total Employees
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant="h3"
                    sx={{
                      color: "primary.dark",
                      fontWeight: 700,
                      mb: 0.5,
                    }}
                  >
                    {loading ? (
                      <CircularProgress
                        size={30}
                        sx={{ color: "primary.main" }}
                      />
                    ) : (
                      employees.length
                    )}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                      fontSize: "0.875rem",
                    }}
                  >
                    Active staff members
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 4, xl: 3 }}>
          <Card
            sx={{
              height: "100%",
              background:
                "linear-gradient(135deg, hsl(210, 100%, 95%) 0%, hsl(210, 100%, 92%) 100%)",
              borderRadius: 2,
              border: "1px solid",
              borderColor: "primary.light",
              boxShadow: "0 4px 20px 0 rgba(0,0,0,0.08)",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": {
                transform: "translateY(-4px)",
                boxShadow: "0 8px 30px 0 rgba(33, 150, 243, 0.15)",
              },
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      backgroundColor: "primary.main",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <PeopleIcon sx={{ fontSize: 28, color: "white" }} />
                  </Box>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      color: "primary.dark",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      fontSize: "0.75rem",
                    }}
                  >
                    Merits Assigned
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant="h3"
                    sx={{
                      color: "primary.dark",
                      fontWeight: 700,
                      mb: 0.5,
                    }}
                  >
                    {loading ? (
                      <CircularProgress
                        size={30}
                        sx={{ color: "primary.main" }}
                      />
                    ) : (
                      employeesWithMerit2025
                    )}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                      fontSize: "0.875rem",
                    }}
                  >
                    Out of {totalActiveEmployees} employees
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4, xl: 3 }}>
          <Card
            sx={{
              height: "100%",
              background:
                "linear-gradient(135deg, hsl(210, 100%, 95%) 0%, hsl(210, 100%, 92%) 100%)",
              borderRadius: 2,
              border: "1px solid",
              borderColor: "primary.light",
              boxShadow: "0 4px 20px 0 rgba(0,0,0,0.08)",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": {
                transform: "translateY(-4px)",
                boxShadow: "0 8px 30px 0 rgba(33, 150, 243, 0.15)",
              },
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      backgroundColor: "primary.main",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <PeopleIcon sx={{ fontSize: 28, color: "white" }} />
                  </Box>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      color: "primary.dark",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      fontSize: "0.75rem",
                    }}
                  >
                    Approvals Completed
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant="h3"
                    sx={{
                      color: "primary.dark",
                      fontWeight: 700,
                      mb: 0.5,
                    }}
                  >
                    {loading ? (
                      <CircularProgress
                        size={30}
                        sx={{ color: "primary.main" }}
                      />
                    ) : (
                      fullyApprovedCount
                    )}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                      fontSize: "0.875rem",
                    }}
                  >
                    Out of {employees.length} employees
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4, xl: 3 }}>
          <Card
            sx={{
              height: "100%",
              background:
                "linear-gradient(135deg, hsl(210, 100%, 95%) 0%, hsl(210, 100%, 92%) 100%)",
              borderRadius: 2,
              border: "1px solid",
              borderColor: "primary.light",
              boxShadow: "0 4px 20px 0 rgba(0,0,0,0.08)",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": {
                transform: "translateY(-4px)",
                boxShadow: "0 8px 30px 0 rgba(33, 150, 243, 0.15)",
              },
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      backgroundColor: "primary.main",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <AttachMoneyIcon sx={{ fontSize: 28, color: "white" }} />
                  </Box>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      color: "primary.dark",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      fontSize: "0.75rem",
                    }}
                  >
                    Team Average Merit
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
                  {/* Left Side - Percentage */}
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="h3"
                      sx={{
                        color: "primary.dark",
                        fontWeight: 700,
                        mb: 0.5,
                      }}
                    >
                      {loading ? (
                        <CircularProgress
                          size={30}
                          sx={{ color: "primary.main" }}
                        />
                      ) : (
                        `${teamAverageMerit.toFixed(2)}%`
                      )}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: teamAverageMerit - budgetPercentage > 0 ? "error.main" : teamAverageMerit - budgetPercentage < 0 ? "warning.main" : "success.main",
                        fontSize: "0.875rem",
                        fontWeight: "medium",
                      }}
                    >
                      {teamAverageMerit - budgetPercentage > 0 ? "+" : ""}{Math.abs(teamAverageMerit - budgetPercentage).toFixed(2)}% from {budgetPercentage}% budget
                    </Typography>
                  </Box>

                  {/* Vertical Divider */}
                  <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

                  {/* Right Side - Dollar Amounts */}
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ mb: 1.5 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "text.secondary",
                          fontSize: "0.7rem",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        Budget Pool
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "primary.dark",
                          fontWeight: 600,
                          fontSize: "0.875rem",
                        }}
                      >
                        ${loading ? "..." : teamAverageMeritData.budgetPool.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "text.secondary",
                          fontSize: "0.7rem",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        {budgetPercentage}% Budget Limit
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.secondary",
                          fontWeight: 600,
                          fontSize: "0.875rem",
                        }}
                      >
                        ${loading ? "..." : teamAverageMeritData.targetBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Action Buttons - Outside Table */}
      <Box sx={{ mb: 3, display: "flex", justifyContent: "space-between", gap: 2 }}>
        {/* Delete and Reset Buttons */}
        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            variant="contained"
            color="error"
            size="large"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteDialogOpen(true)}
            disabled={deleteLoading}
            disableElevation
            sx={{
              px: 3,
              py: 1.5,
              fontWeight: 600,
              "&:hover": {
                backgroundColor: "error.main",
              },
            }}
          >
            Delete All Employees
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<RestartAltIcon />}
            onClick={() => setResetDialogOpen(true)}
            disabled={resetLoading}
            sx={{
              px: 3,
              py: 1.5,
              fontWeight: 600,
              borderWidth: 2,
              borderColor: "#ff9800",
              color: "#ff9800",
              "&:hover": {
                borderWidth: 2,
                borderColor: "#f57c00",
                backgroundColor: "rgba(255, 152, 0, 0.04)",
              },
            }}
          >
            Reset Merit Approval Chain
          </Button>
        </Box>

        {/* UKG Export Button */}
        <Button
          variant="contained"
          color="success"
          size="large"
          startIcon={<FileDownloadIcon />}
          onClick={handleUKGExportClick}
          disabled={ukgExportLoading}
          sx={{
            px: 3,
            py: 1.5,
            fontWeight: 600,
            boxShadow: 3,
            opacity: !ukgExportEnabled && !ukgExportLoading ? 0.6 : 1,
            backgroundColor: "success.main",
            "&:hover": {
              backgroundColor: "success.main",
              boxShadow: 6,
            },
          }}
        >
          {ukgExportLoading ? "Exporting..." : "Final Excel Export for UKG"}
        </Button>
      </Box>

      <Paper
        sx={{
          width: "100%",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.05)",
          border: "1px solid",
          borderColor: "divider",
          mb: 4,
        }}
      >
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            {/* Table Header */}
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
                Approval Chain
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                {fullyApprovedCount}/{employees.length} employee's approval has
                been completed
              </Typography>
              {selectedSupervisor && (
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 500, color: "primary.main", mt: 0.5 }}
                >
                  Supervisor Team Average: {supervisorVariance.average.toFixed(2)}%
                  <Typography
                    component="span"
                    sx={{
                      ml: 1,
                      color: supervisorVariance.variance > 0 ? "error.main" : supervisorVariance.variance < 0 ? "warning.main" : "success.main",
                    }}
                  >
                    ({supervisorVariance.variance > 0 ? "+" : ""}{supervisorVariance.variance.toFixed(2)}% from budget)
                  </Typography>
                </Typography>
              )}
            </Box>

            {/* Filters Container */}
            <Box
              sx={{
                display: "flex",
                gap: 2,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
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

              {/* Role Filter */}
              <TextField
                select
                size="small"
                label="Role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                sx={{ minWidth: 150 }}
              >
                <MenuItem value="">All Roles</MenuItem>
                <MenuItem value="employee">Employee</MenuItem>
                <MenuItem value="approver">Approver</MenuItem>
                <MenuItem value="hr">HR</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </TextField>

              {/* Status Filter */}
              <TextField
                select
                size="small"
                label="Status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                sx={{ minWidth: 130 }}
              >
                <MenuItem value="">All Status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </TextField>

              {/* Approvals Filter */}
              <TextField
                select
                size="small"
                label="Approvals"
                value={selectedApprovalStatus}
                onChange={(e) => setSelectedApprovalStatus(e.target.value)}
                sx={{ minWidth: 150 }}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="not-started">Not Started</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
              </TextField>

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

        <Box
          sx={{ height: 600, width: "100%" }}
          onCopy={(e) => {
            // Get the selected text
            const selection = window.getSelection();
            const text = selection.toString().trim();

            // If text is selected, clean it and put it in clipboard
            if (text) {
              e.preventDefault();
              e.clipboardData.setData('text/plain', text);
            }
          }}
        >
          <DataGrid
            rows={filteredEmployees}
            columns={columns}
            getRowId={(row) => row.id}
            loading={loading}
            paginationMode="client"
            initialState={{
              pagination: {
                paginationModel: { pageSize: 12, page: 0 },
              },
            }}
            pageSizeOptions={[10, 12, 25, 50, 100, 150, 200]}
            disableRowSelectionOnClick
            sx={{
              border: 0,
              "& .MuiDataGrid-columnHeaders": {
                backgroundColor: "background.paper",
                borderBottom: "2px solid",
                borderColor: "divider",
              },
              "& .MuiDataGrid-cell": {
                borderBottom: "1px solid",
                borderColor: "divider",
              },
              "& .MuiDataGrid-cellContent": {
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              },
              "& .cell-approved": {
                color: "#4caf50",
              },
              "& .cell-rejected": {
                color: "#f44336",
              },
            }}
          />
        </Box>
      </Paper>

      {/* Supervisor Statistics and Chart Section */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column !important", xl: "row !important" },
          gap: 3,
          alignItems: "stretch",
          mb: 4,
        }}
      >
        {/* Supervisor Bonus Statistics Table */}
        <Paper
          sx={{
            flex: 1,
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.05)",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
              Supervisor Merit Statistics
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Percentage of employees allocated merit by supervisor
            </Typography>
          </Box>

          <Box sx={{ height: 750, width: "100%" }}>
            <DataGrid
              rows={supervisorStats}
              columns={supervisorColumns}
              getRowId={(row) => row.id}
              loading={loading}
              initialState={{
                pagination: {
                  paginationModel: { pageSize: 12, page: 0 },
                },
              }}
              pageSizeOptions={[5, 10, 15, 25, 50, 100, 150, 200]}
              disableRowSelectionOnClick
              sx={{
                border: 0,
                "& .MuiDataGrid-columnHeaders": {
                  backgroundColor: "background.paper",
                  borderBottom: "2px solid",
                  borderColor: "divider",
                },
                "& .MuiDataGrid-cell": {
                  borderBottom: "1px solid",
                  borderColor: "divider",
                },
              }}
            />
          </Box>
        </Paper>

        {/* Charts Column */}
        <Box
          sx={{
            display: "flex",
            flexDirection: {
              xs: "column !important",
              md: "row !important",
              xl: "column !important",
            },
            gap: 3,
          }}
        >
          {/* Bonus Allocation Donut Chart */}
          <Paper
            sx={{
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.05)",
              border: "1px solid",
              borderColor: "divider",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Box
              sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}
            >
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
                Merit Allocation Overview
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                Distribution of 2025 merit allocation
              </Typography>
            </Box>

            <Box
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                p: 2,
                position: "relative",
              }}
            >
              <Box sx={{ position: "relative" }}>
                <PieChart
                  series={[
                    {
                      data: bonusChartData,
                      innerRadius: 80,
                      outerRadius: 120,
                      paddingAngle: 2,
                      cornerRadius: 5,
                      highlightScope: { faded: "global", highlighted: "item" },
                    },
                  ]}
                  width={380}
                  height={300}
                  slotProps={{
                    legend: {
                      hidden: true,
                    },
                  }}
                />
                <Box
                  sx={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    textAlign: "center",
                  }}
                >
                  <Typography
                    variant="h4"
                    sx={{ fontWeight: 700, color: "primary.main" }}
                  >
                    {totalActiveEmployees > 0
                      ? (
                          (employeesWithMerit2025 / totalActiveEmployees) *
                          100
                        ).toFixed(1)
                      : 0}
                    %
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Overall Allocation
                  </Typography>
                </Box>
              </Box>

              {/* Custom Legend */}
              <Box
                sx={{
                  display: "flex",
                  gap: 3,
                  mt: 2,
                  justifyContent: "center",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box
                    sx={{
                      width: 15,
                      height: 15,
                      borderRadius: "3px",
                      bgcolor: "#4caf50",
                    }}
                  />
                  <Typography variant="body2">
                    With Merit ({employeesWithMerit2025})
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box
                    sx={{
                      width: 15,
                      height: 15,
                      borderRadius: "3px",
                      bgcolor: "#ff9800",
                    }}
                  />
                  <Typography variant="body2">
                    Without Merit ({employeesWithoutMerit})
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Paper>

          {/* Merit Budget Variance */}
          <Paper
            sx={{
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.05)",
              border: "1px solid",
              borderColor: "divider",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Box
              sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}
            >
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
                Budget Variance
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                Team average merit vs {budgetPercentage}% budget pool
              </Typography>
            </Box>

            <Box
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                p: 3,
                gap: 3,
              }}
            >
              {/* Two Column Layout */}
              <Box sx={{ display: "flex", gap: 4, width: "100%", justifyContent: "center", alignItems: "center" }}>
                {/* Left Column - Team Average Merit */}
                <Box sx={{ textAlign: "center", flex: 1, borderRight: 1, borderColor: "divider", pr: 3 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      fontSize: "0.7rem",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      fontWeight: 600,
                    }}
                  >
                    Team Average
                  </Typography>
                  <Typography variant="h2" sx={{ fontWeight: 700, color: "primary.main", mt: 1 }}>
                    {teamAverageMerit.toFixed(2)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem", mt: 0.5 }}>
                    Actual Merit Rate
                  </Typography>
                </Box>

                {/* Right Column - Variance */}
                <Box sx={{ textAlign: "center", flex: 1, pl: 3 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      fontSize: "0.7rem",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      fontWeight: 600,
                    }}
                  >
                    Budget Variance
                  </Typography>
                  <Typography
                    variant="h2"
                    sx={{
                      fontWeight: 700,
                      color: teamAverageMerit - budgetPercentage > 0 ? "error.main" : teamAverageMerit - budgetPercentage < 0 ? "warning.main" : "success.main",
                      mt: 1,
                    }}
                  >
                    {teamAverageMerit - budgetPercentage > 0 ? "+" : ""}{Math.abs(teamAverageMerit - budgetPercentage).toFixed(2)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem", mt: 0.5 }}>
                    From {budgetPercentage}% Target
                  </Typography>
                </Box>
              </Box>

              {/* Divider */}
              <Divider sx={{ width: "100%" }} />

              {/* Bottom Row - Dollar Variance */}
              <Box sx={{ textAlign: "center", width: "100%" }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.secondary",
                    fontSize: "0.7rem",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    fontWeight: 600,
                  }}
                >
                  Dollar Variance
                </Typography>
                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 700,
                    color: teamAverageMerit - budgetPercentage > 0 ? "error.main" : teamAverageMerit - budgetPercentage < 0 ? "warning.main" : "success.main",
                    mt: 0.5,
                  }}
                >
                  ${loading ? "..." : Math.abs(teamAverageMeritData.budgetPool - teamAverageMeritData.targetBudget).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem" }}>
                  {teamAverageMerit - budgetPercentage < 0 ? "Under" : teamAverageMerit - budgetPercentage > 0 ? "Over" : "At"} {budgetPercentage}% Budget
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Approval Statistics - Progress Bar View */}
      <Paper
        sx={{
          width: "100%",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.05)",
          border: "1px solid",
          borderColor: "divider",
          mb: 4,
        }}
      >
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
            Approval Statistics
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Linear progress bars for quick scanning
          </Typography>
          <Box sx={{ display: "flex", gap: 3, mt: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CheckCircleIcon sx={{ fontSize: 16, color: "#4caf50" }} />
              <Typography variant="caption">Approved</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box
                sx={{
                  width: 15,
                  height: 15,
                  borderRadius: "3px",
                  bgcolor: "#fdcb00",
                }}
              />
              <Typography variant="caption">Pending</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box
                sx={{
                  width: 15,
                  height: 15,
                  borderRadius: "3px",
                  bgcolor: "#e11d48",
                }}
              />
              <Typography variant="caption">Rejected</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box
                sx={{
                  width: 15,
                  height: 15,
                  borderRadius: "3px",
                  bgcolor: "#e0e0e0",
                }}
              />
              <Typography variant="caption">No Approver</Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ height: 750, width: "100%" }}>
          <DataGrid
            rows={filteredEmployees.filter((emp) => {
              // Filter employees that have at least one approver assigned
              const hasApprover = !!(
                (emp.level1ApproverName && emp.level1ApproverName !== "Not Assigned" && emp.level1ApproverName !== "-") ||
                (emp.level2ApproverName && emp.level2ApproverName !== "Not Assigned" && emp.level2ApproverName !== "-") ||
                (emp.level3ApproverName && emp.level3ApproverName !== "Not Assigned" && emp.level3ApproverName !== "-") ||
                (emp.level4ApproverName && emp.level4ApproverName !== "Not Assigned" && emp.level4ApproverName !== "-") ||
                (emp.level5ApproverName && emp.level5ApproverName !== "Not Assigned" && emp.level5ApproverName !== "-")
              );
              return hasApprover;
            })}
            columns={approvalStatsColumns}
            getRowId={(row) => row.id}
            loading={loading}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 8, page: 0 },
              },
            }}
            pageSizeOptions={[5, 10, 15, 25, 50, 100]}
            disableRowSelectionOnClick
            getRowHeight={() => 'auto'}
            sx={{
              border: 0,
              "& .MuiDataGrid-columnHeaders": {
                backgroundColor: "background.paper",
                borderBottom: "2px solid",
                borderColor: "divider",
              },
              "& .MuiDataGrid-cell": {
                borderBottom: "1px solid",
                borderColor: "divider",
                py: 2,
                display: "flex",
                alignItems: "center",
              },
              "& .MuiDataGrid-row": {
                minHeight: "80px !important",
              },
              "& .MuiDataGrid-row:hover": {
                backgroundColor: "action.hover",
              },
            }}
          />
        </Box>
      </Paper>

      <EditEmployeeMeritModal
        open={openEditModal}
        onClose={handleCloseEditModal}
        onEmployeeUpdated={handleEmployeeUpdated}
        employee={selectedEmployee}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteAllEmployees}
        title="Delete All Employees"
        message="Are you sure you want to delete all employees? This action cannot be undone. The HR account (hr@pvschemicals.com) will be preserved."
        confirmText="Delete All"
        cancelText="Cancel"
        confirmColor="error"
        loading={deleteLoading}
      />

      {/* Reset Merit Data Confirmation Dialog */}
      <ConfirmDialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
        onConfirm={handleResetMeritData}
        title="Reset All Merit Data"
        message="Are you sure you want to reset all merit data? This will clear all merit increases, approvals, and history for all employees. This action cannot be undone."
        confirmText="Reset All"
        cancelText="Cancel"
        confirmColor="warning"
        loading={resetLoading}
      />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        message={snackbarMessage}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        sx={{ mt: 2 }}
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

export default HRDashboard;
