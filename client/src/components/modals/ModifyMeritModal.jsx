import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Alert,
  Slide,
  Typography,
} from "@mui/material";
import api from "../../utils/api";

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const ModifyMeritModal = ({
  open,
  onClose,
  onMeritModified,
  employee,
  approverId,
  approverLevel,
}) => {
  const [formData, setFormData] = useState({
    meritAmount: "",
    comments: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && employee) {
      // Determine current merit amount based on employee type
      let meritValue = "";
      if (employee.salaryType === "Hourly") {
        meritValue = employee.meritIncreaseDollar || "";
      } else {
        meritValue = employee.meritIncreasePercentage || "";
      }

      setFormData({
        meritAmount: meritValue,
        comments: "",
      });
      setError("");
    }
  }, [open, employee]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.meritAmount || parseFloat(formData.meritAmount) < 0) {
      setError("Please enter a valid merit amount");
      return;
    }

    setLoading(true);

    try {
      // Build payload based on employee type
      const payload = {
        approverId: approverId,
        level: approverLevel,
        comments: formData.comments || undefined,
      };

      // Add merit field based on employee type
      if (employee.salaryType === "Hourly") {
        payload.meritIncreaseDollar = parseFloat(formData.meritAmount);
      } else {
        payload.meritIncreasePercentage = parseFloat(formData.meritAmount);
      }

      await api.post(
        `/v2/employees/${employee.id}/modify-and-approve`,
        payload
      );

      // Reset form
      setFormData({
        meritAmount: "",
        comments: "",
      });

      onMeritModified();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "An error occurred while modifying merit"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        meritAmount: "",
        comments: "",
      });
      setError("");
      onClose();
    }
  };

  // Calculate new salary based on merit
  const calculateNewSalary = () => {
    if (!formData.meritAmount || !employee) return null;

    const meritValue = parseFloat(formData.meritAmount);
    if (employee.salaryType === "Hourly") {
      const newRate = (parseFloat(employee.hourlyPayRate) || 0) + meritValue;
      return `$${newRate.toFixed(2)}/hr`;
    } else {
      const currentSalary = parseFloat(employee.annualSalary) || 0;
      const newSalary = currentSalary * (1 + meritValue / 100);
      return `$${newSalary.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slots={{
        transition: Transition,
      }}
      keepMounted
    >
      <DialogTitle>
        Modify Merit & Approve
        {employee && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {employee.fullName} ({employee.employeeId})
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
          {employee && (
            <Box sx={{ mb: 3, p: 2, bgcolor: "grey.100", borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Salary Type:</strong> {employee.salaryType || "N/A"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>
                  Current{" "}
                  {employee.salaryType === "Hourly"
                    ? "Hourly Rate"
                    : "Annual Salary"}
                  :
                </strong>{" "}
                {employee.salaryType === "Hourly"
                  ? `$${(employee.hourlyPayRate || 0).toFixed(2)}/hr`
                  : `$${(employee.annualSalary || 0).toLocaleString()}`}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Current Merit:</strong>{" "}
                {employee.salaryType === "Hourly"
                  ? `$${(employee.meritIncreaseDollar || 0).toFixed(2)}/hr`
                  : `${(employee.meritIncreasePercentage || 0).toFixed(2)}%`}
              </Typography>
              {formData.meritAmount && (
                <Typography
                  variant="body2"
                  color="primary"
                  sx={{ mt: 1, fontWeight: "bold" }}
                >
                  <strong>New Salary:</strong> {calculateNewSalary()}
                </Typography>
              )}
            </Box>
          )}

          <TextField
            fullWidth
            name="meritAmount"
            label={
              employee?.salaryType === "Hourly"
                ? "New Merit Increase ($/hour)"
                : "New Merit Increase (%)"
            }
            type="number"
            value={formData.meritAmount}
            onChange={(e) =>
              setFormData({ ...formData, meritAmount: e.target.value })
            }
            disabled={loading}
            required
            placeholder={
              employee?.salaryType === "Hourly"
                ? "Enter dollar increase per hour (e.g., 0.50)"
                : "Enter percentage increase (e.g., 2.5 for 2.5%)"
            }
            InputProps={{
              startAdornment: (
                <Typography sx={{ mr: 1 }}>
                  {employee?.salaryType === "Hourly" ? "$" : ""}
                </Typography>
              ),
              endAdornment: (
                <Typography sx={{ ml: 1 }}>
                  {employee?.salaryType === "Hourly" ? "/hr" : "%"}
                </Typography>
              ),
            }}
            inputProps={{
              step: employee?.salaryType === "Hourly" ? "0.01" : "0.01",
              min: "0",
            }}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            name="comments"
            label="Comments (Optional)"
            multiline
            rows={3}
            value={formData.comments}
            onChange={(e) =>
              setFormData({ ...formData, comments: e.target.value })
            }
            disabled={loading}
            placeholder="Add a comment explaining the modification"
            helperText="This will be logged in the merit history"
          />
        </Box>

        <Alert severity="info" sx={{ mt: 2 }}>
          Modifying the merit will update the amount and automatically approve
          it at your level. Higher-level approvals will remain intact and can
          continue reviewing.
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? "Modifying..." : "Modify & Approve"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ModifyMeritModal;
