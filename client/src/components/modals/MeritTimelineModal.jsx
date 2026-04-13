import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Slide,
  Chip,
} from "@mui/material";
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from "@mui/lab";
import {
  CheckCircle,
  Cancel,
  Edit,
  Send,
  Assignment,
  HourglassEmpty,
} from "@mui/icons-material";

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const MeritTimelineModal = ({ open, onClose, employee }) => {
  // Get merit history from employee
  const meritHistory = employee?.meritHistory || [];

  // Function to get icon based on action type
  const getActionIcon = (action) => {
    switch (action) {
      case "assigned":
        return <Assignment />;
      case "submitted_for_approval":
        return <Send />;
      case "approved":
        return <CheckCircle />;
      case "rejected":
        return <Cancel />;
      case "modified_and_approved":
      case "modified_by_supervisor":
        return <Edit />;
      case "resubmitted_and_approved":
        return <Send />;
      default:
        return <HourglassEmpty />;
    }
  };

  // Function to get color based on action type
  const getActionColor = (action) => {
    switch (action) {
      case "approved":
      case "modified_and_approved":
      case "resubmitted_and_approved":
        return "success";
      case "rejected":
        return "error";
      case "assigned":
      case "submitted_for_approval":
        return "primary";
      case "modified_by_supervisor":
        return "warning";
      default:
        return "grey";
    }
  };

  // Function to get action label
  const getActionLabel = (action) => {
    switch (action) {
      case "assigned":
        return "Merit Assigned";
      case "submitted_for_approval":
        return "Submitted for Approval";
      case "approved":
        return "Approved";
      case "rejected":
        return "Rejected";
      case "modified_and_approved":
        return "Modified & Approved";
      case "modified_by_supervisor":
        return "Modified by Supervisor";
      case "resubmitted_and_approved":
        return "Resubmitted & Approved";
      default:
        return action;
    }
  };

  // Function to get level label
  const getLevelLabel = (level) => {
    if (level === 0) return "Supervisor";
    return `Level ${level}`;
  };

  // Function to format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Function to format merit value
  const formatMeritValue = (value, salaryType) => {
    if (value === null || value === undefined) return "N/A";
    if (salaryType === "Hourly") {
      return `$${parseFloat(value).toFixed(2)}/hr`;
    } else {
      return `${parseFloat(value).toFixed(2)}%`;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slots={{
        transition: Transition,
      }}
      keepMounted
    >
      <DialogTitle>
        Merit Timeline
        {employee && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {employee.fullName} ({employee.employeeId})
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {employee && (
          <Box sx={{ mb: 3, p: 2, bgcolor: "grey.100", borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Salary Type:</strong> {employee.salaryType || "N/A"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>
                Current {employee.salaryType === "Hourly" ? "Hourly Rate" : "Annual Salary"}:
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
            <Typography variant="body2" color="text.secondary">
              <strong>
                New{" "}
                {employee.salaryType === "Hourly"
                  ? "Hourly Rate"
                  : "Annual Salary"}
                :
              </strong>{" "}
              {employee.salaryType === "Hourly"
                ? `$${(employee.newHourlyRate || 0).toFixed(2)}/hr`
                : `$${(employee.newAnnualSalary || 0).toLocaleString()}`}
            </Typography>
          </Box>
        )}

        {meritHistory.length === 0 ? (
          <Box
            sx={{
              p: 4,
              textAlign: "center",
              color: "text.secondary",
            }}
          >
            <HourglassEmpty sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
            <Typography variant="body1">
              No merit history available yet
            </Typography>
          </Box>
        ) : (
          <Timeline position="right">
            {meritHistory.map((entry, index) => (
              <TimelineItem key={index}>
                <TimelineOppositeContent
                  sx={{ flex: 0.3, py: "12px", px: 2 }}
                  variant="body2"
                  color="text.secondary"
                >
                  {formatDate(entry.timestamp)}
                </TimelineOppositeContent>
                <TimelineSeparator>
                  <TimelineDot color={getActionColor(entry.action)}>
                    {getActionIcon(entry.action)}
                  </TimelineDot>
                  {index < meritHistory.length - 1 && <TimelineConnector />}
                </TimelineSeparator>
                <TimelineContent sx={{ py: "12px", px: 2 }}>
                  <Box>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <Typography variant="h6" component="span">
                        {getActionLabel(entry.action)}
                      </Typography>
                      <Chip
                        label={getLevelLabel(entry.level)}
                        size="small"
                        color={getActionColor(entry.action)}
                        variant="outlined"
                      />
                      {entry.bulkApproval && (
                        <Chip
                          label="Bulk"
                          size="small"
                          color="info"
                          variant="outlined"
                        />
                      )}
                    </Box>

                    <Typography variant="body2" color="text.secondary">
                      <strong>By:</strong> {entry.actor?.name || "Unknown"} (
                      {entry.actor?.employeeId || "N/A"})
                    </Typography>

                    {/* Show merit value or old/new values */}
                    {entry.oldValue !== undefined &&
                    entry.newValue !== undefined ? (
                      <Typography variant="body2" color="text.secondary">
                        <strong>Merit changed:</strong>{" "}
                        {formatMeritValue(entry.oldValue, entry.salaryType)} →{" "}
                        {formatMeritValue(entry.newValue, entry.salaryType)}
                      </Typography>
                    ) : entry.meritValue !== undefined ? (
                      <Typography variant="body2" color="text.secondary">
                        <strong>Merit:</strong>{" "}
                        {formatMeritValue(entry.meritValue, entry.salaryType)}
                      </Typography>
                    ) : null}

                    {entry.comments && (
                      <Box
                        sx={{
                          mt: 1,
                          p: 1,
                          bgcolor: "grey.50",
                          borderRadius: 1,
                          borderLeft: 3,
                          borderColor: getActionColor(entry.action) + ".main",
                        }}
                      >
                        <Typography variant="body2" fontStyle="italic">
                          "{entry.comments}"
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MeritTimelineModal;
