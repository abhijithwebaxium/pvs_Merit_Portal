import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  TextField,
  MenuItem,
  InputAdornment,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import RestoreIcon from "@mui/icons-material/Restore";
import AddEmployeeModal from "../../components/modals/AddEmployeeModal";
import UploadEmployeesModal from "../../components/modals/UploadEmployeesModal";
import EditEmployeeModal from "../../components/modals/EditEmployeeModal";
import { useSelector } from "react-redux";
import { selectUser } from "../../store/slices/userSlice";
// import api from '../../utils/api';
import api from "../../utils/api";

const Employees = () => {
  const user = useSelector(selectUser);
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [openUploadModal, setOpenUploadModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [openDeleteAllDialog, setOpenDeleteAllDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [openResetDialog, setOpenResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");

  // Check if current user is HR admin
  const isHRAdmin = user?.email === "hr@pvschemicals.com";

  const fetchEmployees = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/v2/employees");
      const { data } = response;

      setEmployees(data.data);
      setFilteredEmployees(data.data);
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

    // Company filter
    if (selectedCompany) {
      filtered = filtered.filter((emp) => emp.company === selectedCompany);
    }

    setFilteredEmployees(filtered);
  }, [searchQuery, selectedRole, selectedStatus, selectedCompany, employees]);

  const handleAddEmployee = () => {
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
  };

  const handleEmployeeAdded = () => {
    setOpenModal(false);
    fetchEmployees(); // Refresh the list
  };

  const handleUploadClick = () => {
    setOpenUploadModal(true);
  };

  const handleCloseUploadModal = () => {
    setOpenUploadModal(false);
  };

  const handleEmployeesUploaded = () => {
    setOpenUploadModal(false);
    fetchEmployees(); // Refresh the list
  };

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
    fetchEmployees(); // Refresh the list
  };

  const handleDeleteAllClick = () => {
    setOpenDeleteAllDialog(true);
  };

  const handleCloseDeleteAllDialog = () => {
    setOpenDeleteAllDialog(false);
  };

  const handleConfirmDeleteAll = async () => {
    setDeleting(true);
    setError("");

    try {
      await api.delete("/v2/employees/delete-all");
      setOpenDeleteAllDialog(false);
      fetchEmployees(); // Refresh the list
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "An error occurred while deleting employees";
      setError(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleResetClick = () => {
    setOpenResetDialog(true);
  };

  const handleCloseResetDialog = () => {
    setOpenResetDialog(false);
  };

  const handleConfirmReset = async () => {
    setResetting(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.post("/v2/employees/reset-merits");
      setOpenResetDialog(false);
      await fetchEmployees(); // Refresh the list

      // Show success message
      const message = response.data?.message || "Merit data has been successfully restored to upload state!";
      setSuccess(message);

      // Auto-hide success message after 5 seconds
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "An error occurred while resetting merit data";
      setError(errorMessage);
    } finally {
      setResetting(false);
    }
  };

  // Extract unique companies from all employees
  const uniqueCompanies = [
    ...new Set(employees.map((emp) => emp.company).filter((name) => name)),
  ].sort();

  const columns = [
    {
      field: "slNo",
      headerName: "Sl No",
      width: 80,
      minWidth: 80,
      flex: 0.4,
      renderCell: (params) => {
        const index = filteredEmployees.findIndex(
          (emp) => emp.id === params.row.id,
        );
        return index + 1;
      },
    },
    {
      field: "fullName",
      headerName: "Name",
      width: 200,
      minWidth: 150,
      flex: 1,
    },
    {
      field: "jobTitle",
      headerName: "Job Title",
      width: 180,
      minWidth: 150,
      flex: 1,
      renderCell: (params) => params.value || "N/A",
    },
    {
      field: "supervisorName",
      headerName: "Supervisor",
      width: 180,
      minWidth: 150,
      flex: 1,
      renderCell: (params) => params.value || "Not Assigned",
    },
    {
      field: "salaryType",
      headerName: "Salary Type",
      width: 130,
      minWidth: 120,
      flex: 0.7,
      renderCell: (params) => params.value || "N/A",
    },
    {
      field: "annualSalary",
      headerName: "Annual Salary",
      width: 150,
      minWidth: 130,
      flex: 0.8,
      renderCell: (params) => {
        const salary = params.value || 0;
        return salary > 0 ? `$${salary.toLocaleString()}` : "N/A";
      },
    },
    // {
    //   field: "role",
    //   headerName: "Role",
    //   width: 120,
    //   minWidth: 100,
    //   flex: 0.6,
    //   renderCell: (params) => (
    //     <Box
    //       sx={{
    //         px: 1.5,
    //         py: 0.5,
    //         borderRadius: 1,
    //         color: "primary.dark",
    //         fontWeight: "medium",
    //         textTransform: "capitalize",
    //       }}
    //     >
    //       {params.value}
    //     </Box>
    //   ),
    // },
    // {
    //   field: "isActive",
    //   headerName: "Status",
    //   width: 120,
    //   minWidth: 100,
    //   flex: 0.5,
    //   renderCell: (params) => (
    //     <Box
    //       sx={{
    //         px: 2,
    //         py: 0.5,
    //         borderRadius: 1,
    //         color: params.value ? "success.dark" : "error.dark",
    //         fontWeight: "medium",
    //       }}
    //     >
    //       {params.value ? "Active" : "Inactive"}
    //     </Box>
    //   ),
    // },
    {
      field: "actions",
      headerName: "Actions",
      width: 120,
      minWidth: 100,
      flex: 0.5,
      sortable: false,
      renderCell: (params) => (
        <Button
          startIcon={<EditIcon />}
          color="primary"
          onClick={() => handleEditClick(params.row)}
          size="small"
        >
          Edit
        </Button>
      ),
    },
  ];

  return (
    <Box sx={{ width: "100%", maxWidth: { sm: "100%", md: "1700px" } }}>
      <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
        Employees
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

      <Paper sx={{ width: "100%", mb: 2 }}>
        <Box sx={{ p: 2 }}>
          {/* Search, Filters, and Action Buttons - All in one row */}
          <Box
            sx={{
              display: "flex",
              gap: 2,
              flexWrap: "wrap",
              alignItems: "center",
              mb: 2,
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

            {/* Company Filter */}
            <TextField
              select
              size="small"
              label="Company"
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">All Companies</MenuItem>
              {uniqueCompanies.map((name) => (
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

            {/* Action Buttons - Push to the right */}
            <Box sx={{ marginLeft: "auto", display: "flex", gap: 1 }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddEmployee}
              >
                Add Employee
              </Button>
              <Button
                variant="contained"
                startIcon={<CloudUploadIcon />}
                onClick={handleUploadClick}
              >
                Upload Excel
              </Button>
              {isHRAdmin && (
                <>
                  <Button
                    variant="contained"
                    color="warning"
                    startIcon={<RestoreIcon />}
                    onClick={handleResetClick}
                    sx={{
                      color: "white",
                      "&:hover": {
                        backgroundColor: "warning.main",
                      },
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<DeleteSweepIcon />}
                    onClick={handleDeleteAllClick}
                  >
                    Delete All
                  </Button>
                </>
              )}
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
          <DataGrid
            rows={filteredEmployees}
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
              "& .MuiDataGrid-cell:hover": {
                cursor: "pointer",
              },
            }}
            autoHeight
          />
        )}
      </Paper>

      <AddEmployeeModal
        open={openModal}
        onClose={handleCloseModal}
        onEmployeeAdded={handleEmployeeAdded}
      />

      <UploadEmployeesModal
        open={openUploadModal}
        onClose={handleCloseUploadModal}
        onEmployeesUploaded={handleEmployeesUploaded}
      />

      <EditEmployeeModal
        open={openEditModal}
        onClose={handleCloseEditModal}
        onEmployeeUpdated={handleEmployeeUpdated}
        employee={selectedEmployee}
      />

      {/* Delete All Confirmation Dialog */}
      <Dialog
        open={openDeleteAllDialog}
        onClose={handleCloseDeleteAllDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete All Employees</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete all employees except hr@pvschemicals.com?
          </DialogContentText>
          <DialogContentText sx={{ mt: 2, color: "error.main", fontWeight: "bold" }}>
            This action cannot be undone! All employee records, bonuses, and approval data will be permanently deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteAllDialog} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDeleteAll}
            variant="contained"
            color="error"
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Yes, Delete All"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Merit Data Confirmation Dialog */}
      <Dialog
        open={openResetDialog}
        onClose={handleCloseResetDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reset Merit Data</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to reset all merit data to the upload state?
          </DialogContentText>
          <DialogContentText sx={{ mt: 2, color: "warning.main", fontWeight: "bold" }}>
            This will clear all merit increases, new salaries, approval statuses, and merit history for all employees (except hr@pvschemicals.com).
          </DialogContentText>
          <DialogContentText sx={{ mt: 1 }}>
            Employee base information (name, job title, current salary, etc.) will be preserved.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseResetDialog} disabled={resetting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmReset}
            variant="contained"
            color="warning"
            disabled={resetting}
            sx={{
              color: "white",
              "&:hover": {
                backgroundColor: "warning.main",
              },
            }}
          >
            {resetting ? "Resetting..." : "Yes, Reset Merit Data"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Employees;
