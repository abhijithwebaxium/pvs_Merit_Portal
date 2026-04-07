import { Router } from "express";
import {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  toggleEmployeeStatus,
  getMyApprovals,
  getMySupervisedEmployees,
  updateEmployeeBonus,
  bulkCreateEmployees,
  downloadTemplate,
  submitBonusesForApproval,
  getMyBonusApprovals,
  processBonusApproval,
  bulkApproveAll,
  checkAllApprovalsCompleted,
  exportToUKG,
  resubmitAndApprove,
  deleteAllEmployees,
  resetMeritData,
  modifyAndApproveMerit,
} from "../../controllers/v2/employeeController.js";
import { protect } from "../../middlewares/auth.js";

const router = Router();

// Public routes for testing (or add protect middleware as needed)
router.get("/approvals/my-approvals", getMyApprovals);
router.get("/supervisor/my-team", getMySupervisedEmployees);
router.post("/supervisor/submit-for-approval", submitBonusesForApproval);

// Bonus approval routes
router.get("/bonus-approvals/my-approvals", getMyBonusApprovals);
router.post("/:employeeId/bonus-approval", processBonusApproval);
router.post("/approvals/bulk-approve", bulkApproveAll);
router.post("/:id/resubmit-and-approve", resubmitAndApprove);

// Merit modification route
router.post("/:employeeId/modify-and-approve", modifyAndApproveMerit);

// Template download route (before protect middleware to allow download)
router.get("/template/download", downloadTemplate);

// Protected routes
router.use(protect);

router.route("/").get(getEmployees).post(createEmployee);

// Bulk upload route
router.post("/bulk", bulkCreateEmployees);

// Delete all employees route (HR Admin only) - MUST be before /:id routes
router.delete("/delete-all", deleteAllEmployees);

// Reset merit data route (HR Admin only) - MUST be before /:id routes
router.post("/reset-merits", resetMeritData);

// UKG Export routes - must be before /:id routes
router.get("/ukg/approvals-status", checkAllApprovalsCompleted);
router.get("/ukg/export", exportToUKG);

router
  .route("/:id")
  .get(getEmployee)
  .put(updateEmployee)
  .delete(deleteEmployee);

router.patch("/:id/toggle-status", toggleEmployeeStatus);
router.put("/:id/bonus", updateEmployeeBonus);
router.put("/:id/merit", updateEmployeeBonus); // Merit endpoint (alias for bonus)

export default router;
