import { authenticatePasswordAdmin } from '../services/adminPasswordAuth.js';

export const requireAdmin = [authenticatePasswordAdmin];
