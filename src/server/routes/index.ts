import type { Router } from '../http/router';
import { marketingRoutes } from './marketing';
import { authRoutes } from './auth';
import { customerRoutes } from './customer';
import { terminalRoutes } from './terminal';
import { onboardingRoutes } from './onboarding';
import { dashboardCoreRoutes } from './dashboard-core';
import { dashboardManageRoutes } from './dashboard-manage';
import { dashboardSettingsRoutes } from './dashboard-settings';
import { adminRoutes } from './admin';

export function registerRoutes(r: Router) {
  marketingRoutes(r);
  authRoutes(r);
  customerRoutes(r);
  terminalRoutes(r);
  onboardingRoutes(r);
  dashboardCoreRoutes(r);
  dashboardManageRoutes(r);
  dashboardSettingsRoutes(r);
  adminRoutes(r);
}
