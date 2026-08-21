import { checkOverdueOutpasses } from "../modules/hostel/hostel.service";
import { logger } from "../utils/logger";

/**
 * Scheduled job to check for outpasses that have passed their expectedReturnAt
 * time without the student gating back in.
 */
export async function runHostelOutpassOverdueJob() {
  try {
    const result = await checkOverdueOutpasses();
    if (result.overdueCount > 0) {
      logger.info(`Hostel outpass overdue job flagged ${result.overdueCount} overdue passes.`);
    }
    return result;
  } catch (err) {
    logger.error("Error executing hostel outpass overdue job:", err);
    throw err;
  }
}
