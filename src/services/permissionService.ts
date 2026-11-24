/**
 * Complete Mobile & Web Permission Control Matrix Service
 *
 * Implements RBAC and action-level permission checking matching the web application:
 * - Module Visibility: View keys (e.g. 'lead.view', 'expense.view_my')
 * - Action Button Controls: Create, Edit, Delete, Export, Import, Status, Assign
 */

export const PERMISSIONS = {
  // ── Leads ──
  LEAD_VIEW: 'lead.view',
  LEAD_CREATE: 'lead.create',
  LEAD_EDIT: 'lead.edit',
  LEAD_DELETE: 'lead.delete',
  LEAD_EXPORT: 'lead.export',
  LEAD_IMPORT: 'lead.import',
  LEAD_ASSIGN: 'lead.assign',
  LEAD_TRASH: 'lead.trash',

  // ── Employees ──
  EMPLOYEE_VIEW: 'employee.view',
  EMPLOYEE_VIEW_ONE: 'employee.view_one',
  EMPLOYEE_CREATE: 'employee.create',
  EMPLOYEE_EDIT: 'employee.edit',
  EMPLOYEE_DELETE: 'employee.delete',
  EMPLOYEE_STATUS: 'employee.status',
  EMPLOYEE_EXPORT: 'employee.export',
  EMPLOYEE_IMPORT: 'employee.import',

  // ── Leaves ──
  LEAVE_VIEW: 'leave.view',
  LEAVE_CREATE: 'leave.create',
  LEAVE_EDIT: 'leave.edit',
  LEAVE_DELETE: 'leave.delete',
  LEAVE_STATUS: 'leave.status', // Approve / Reject
  LEAVE_EXPORT: 'leave.export',

  // ── Attendance ──
  ATTENDANCE_PUNCH_VIEW: 'attendance.punch.view',
  ATTENDANCE_CALENDAR_VIEW: 'attendance.calendar.view',
  ATTENDANCE_EDIT: 'attendance.edit', // Admin override
  ATTENDANCE_EXPORT: 'attendance.export',
  ATTENDANCE_IMPORT: 'attendance.import',

  // ── Expenses ──
  EXPENSE_VIEW_MY: 'expense.view_my',
  EXPENSE_VIEW_ALL: 'expense.view_all',
  EXPENSE_SUBMIT: 'expense.submit',
  EXPENSE_APPROVE: 'expense.approve', // Approve / Reject

  // ── Projects ──
  PROJECT_VIEW: 'project.view',
  PROJECT_CREATE: 'project.create',
  PROJECT_EDIT: 'project.edit',
  PROJECT_DELETE: 'project.delete',
  PROJECT_ASSIGN: 'project.assign',
  PROJECT_VALUE: 'project.value',
  PROJECT_DOCUMENTS: 'project.documents',
  PROJECT_EXPORT: 'project.export',

  // ── Tasks ──
  TASK_VIEW: 'task.view',
  TASK_CREATE: 'task.create',
  TASK_EDIT: 'task.edit',
  TASK_DELETE: 'task.delete',
  TASK_ASSIGN: 'task.assign',
  TASK_EXPORT: 'task.export',

  // ── Companies (Clients) ──
  COMPANY_VIEW: 'company.view',
  COMPANY_CREATE: 'company.create',
  COMPANY_EDIT: 'company.edit',
  COMPANY_DELETE: 'company.delete',
  COMPANY_OVERVIEW: 'company.overview',

  // ── Work & Fund Vouchers ──
  WORK_APPROVAL_VIEW: 'work_approval.view',
  WORK_APPROVAL_CREATE: 'work_approval.create',
  WORK_APPROVAL_EDIT_DRAFT: 'work_approval.edit_draft',
  WORK_APPROVAL_DELETE: 'work_approval.delete',
  WORK_APPROVAL_MANAGER_APPROVE: 'work_approval.manager_approve',
  WORK_APPROVAL_ADMIN_APPROVE: 'work_approval.admin_approve',
  WORK_APPROVAL_APPLY_ON_BEHALF: 'work_approval.apply_on_behalf',
  WORK_APPROVAL_ADD_REMARK: 'work_approval.add_remark',
  WORK_APPROVAL_PRINT_INVOICE: 'work_approval.print_invoice',

  // ── Receipt Vouchers ──
  RECEIPT_VOUCHER_VIEW: 'receipt_voucher.view',
  RECEIPT_VOUCHER_VIEW_ALL: 'receipt_voucher.view_all',
  RECEIPT_VOUCHER_CREATE: 'receipt_voucher.create',
  RECEIPT_VOUCHER_EDIT: 'receipt_voucher.edit',
  RECEIPT_VOUCHER_DELETE: 'receipt_voucher.delete',
  RECEIPT_VOUCHER_PRINT: 'receipt_voucher.print',

  // ── Payroll ──
  PAYROLL_SALARY_VIEW: 'payroll.salary.view',
  PAYROLL_GENERATE_VIEW: 'payroll.generate.view',
  PAYROLL_EXPORT: 'payroll.export',

  // ── Announcements ──
  ANNOUNCEMENT_VIEW: 'announcement.view',
  ANNOUNCEMENT_CREATE: 'announcement.create',
  ANNOUNCEMENT_DELETE: 'announcement.delete',

  // ── Digital Assets (DAM) ──
  DAM_VIEW: 'dam.view',
  DAM_CREATE: 'dam.create',
  DAM_EDIT: 'dam.edit',
  DAM_DELETE: 'dam.delete',
  DAM_EXPORT: 'dam.export',
  DAM_IMPORT: 'dam.import',

  // ── AMC ──
  AMC_VIEW: 'amc.view',
  AMC_CREATE: 'amc.create',
  AMC_EDIT: 'amc.edit',
  AMC_DELETE: 'amc.delete',
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS] | string;

/**
 * Mapping of common module aliases between frontend and backend.
 * (e.g. 'tasks' <-> 'task', 'leaves' <-> 'leave', 'expenses' <-> 'expense')
 */
export const MODULE_ALIASES: Record<string, string[]> = {
  leaves: ['leave', 'leaves'],
  leave: ['leave', 'leaves'],
  tasks: ['task', 'tasks'],
  task: ['task', 'tasks'],
  leads: ['lead', 'leads'],
  lead: ['lead', 'leads'],
  employees: ['employee', 'employees'],
  employee: ['employee', 'employees'],
  projects: ['project', 'projects'],
  project: ['project', 'projects'],
  expenses: ['expense', 'expenses'],
  expense: ['expense', 'expenses'],
  announcements: ['announcement', 'announcements'],
  announcement: ['announcement', 'announcements'],
  companies: ['company', 'companies'],
  company: ['company', 'companies'],
  attendance: ['attendance'],
  payroll: ['payroll'],
  chat: ['chat'],
  amc: ['amc'],
  work_approval: ['work_approval'],
  receipt_voucher: ['receipt_voucher'],
  dam: ['digital-assets', 'dam'],
};

/**
 * Mapping of top-level modules to their required viewing permissions.
 * Having ANY of the mapped permissions will allow viewing the module.
 */
export const MODULE_VIEW_PERMISSIONS: Record<string, string[]> = {
  attendance: [
    PERMISSIONS.ATTENDANCE_PUNCH_VIEW,
    PERMISSIONS.ATTENDANCE_CALENDAR_VIEW,
    'attendance.view',
    'attendance.punch.view',
    'attendance',
  ],
  leaves: [PERMISSIONS.LEAVE_VIEW, 'leave.view', 'leaves.view', 'leave', 'leaves'],
  leave: [PERMISSIONS.LEAVE_VIEW, 'leave.view', 'leaves.view', 'leave', 'leaves'],
  tasks: [PERMISSIONS.TASK_VIEW, 'task.view', 'tasks.view', 'task', 'tasks'],
  task: [PERMISSIONS.TASK_VIEW, 'task.view', 'tasks.view', 'task', 'tasks'],
  expenses: [
    PERMISSIONS.EXPENSE_VIEW_MY,
    PERMISSIONS.EXPENSE_VIEW_ALL,
    PERMISSIONS.EXPENSE_APPROVE,
    'expense.view',
    'expense.view_my',
    'expenses.view',
    'expense',
    'expenses',
  ],
  expense: [
    PERMISSIONS.EXPENSE_VIEW_MY,
    PERMISSIONS.EXPENSE_VIEW_ALL,
    PERMISSIONS.EXPENSE_APPROVE,
    'expense.view',
    'expense.view_my',
    'expenses.view',
    'expense',
    'expenses',
  ],
  leads: [PERMISSIONS.LEAD_VIEW, 'lead.view', 'leads.view', 'lead', 'leads'],
  lead: [PERMISSIONS.LEAD_VIEW, 'lead.view', 'leads.view', 'lead', 'leads'],
  employees: [
    PERMISSIONS.EMPLOYEE_VIEW,
    PERMISSIONS.EMPLOYEE_VIEW_ONE,
    'employee.view',
    'employees.view',
    'employee',
    'employees',
  ],
  employee: [
    PERMISSIONS.EMPLOYEE_VIEW,
    PERMISSIONS.EMPLOYEE_VIEW_ONE,
    'employee.view',
    'employees.view',
    'employee',
    'employees',
  ],
  projects: [PERMISSIONS.PROJECT_VIEW, 'project.view', 'projects.view', 'project', 'projects'],
  project: [PERMISSIONS.PROJECT_VIEW, 'project.view', 'projects.view', 'project', 'projects'],
  payroll: [
    PERMISSIONS.PAYROLL_SALARY_VIEW,
    PERMISSIONS.PAYROLL_GENERATE_VIEW,
    'payroll.view',
    'payroll',
  ],
  announcements: [PERMISSIONS.ANNOUNCEMENT_VIEW, 'announcement.view', 'announcements.view', 'announcement', 'announcements'],
  announcement: [PERMISSIONS.ANNOUNCEMENT_VIEW, 'announcement.view', 'announcements.view', 'announcement', 'announcements'],
  companies: [PERMISSIONS.COMPANY_VIEW, 'company.view', 'companies.view', 'company', 'companies'],
  company: [PERMISSIONS.COMPANY_VIEW, 'company.view', 'companies.view', 'company', 'companies'],
  work_approval: [PERMISSIONS.WORK_APPROVAL_VIEW, 'work_approval'],
  receipt_voucher: [
    PERMISSIONS.RECEIPT_VOUCHER_VIEW,
    PERMISSIONS.RECEIPT_VOUCHER_VIEW_ALL,
    'receipt_voucher',
  ],
  dam: [PERMISSIONS.DAM_VIEW, 'dam', 'digital-assets'],
  amc: [PERMISSIONS.AMC_VIEW, 'amc'],
  chat: ['chat'],
};

/**
 * Normalizes raw permissions list from the user object into a clean string array.
 */
export function extractPermissions(user: any): string[] {
  if (!user) return [];
  const raw =
    user.permissions ||
    user.permissionList ||
    (typeof user.role === 'object' && user.role !== null ? user.role.permissions : null) ||
    [];

  if (Array.isArray(raw)) {
    return raw
      .map((item: any) => {
        if (typeof item === 'string') return item.trim();
        if (typeof item === 'object' && item !== null) {
          return (item.name || item.code || item.key || item.permission || '').trim();
        }
        return '';
      })
      .filter((p: string) => p.length > 0);
  }

  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [];
}

/**
 * Checks if a module is enabled at the company subscription / settings level.
 */
export function isModuleEnabledInCompany(company: any, moduleName: string): boolean {
  if (!company) return true;
  const aliases = MODULE_ALIASES[moduleName] || [moduleName];

  // If disabledModules exists, verify module is not explicitly disabled
  if (Array.isArray(company.disabledModules) && company.disabledModules.length > 0) {
    if (aliases.some((alias) => company.disabledModules.includes(alias))) {
      return false;
    }
  }

  // If enabledModules exists, verify module is included in company package
  if (Array.isArray(company.enabledModules) && company.enabledModules.length > 0) {
    if (!aliases.some((alias) => company.enabledModules.includes(alias))) {
      return false;
    }
  }

  return true;
}

/**
 * Checks whether the user has a specific permission key.
 */
export function hasPermission(user: any, permissionKey: PermissionKey): boolean {
  if (!user) return false;

  const role = (typeof user.role === 'string' ? user.role : user.role?.name || '').toLowerCase();
  if (role === 'superadmin') {
    return true;
  }

  const permissions = extractPermissions(user);

  // If wildcard access
  if (permissions.includes('*')) {
    return true;
  }

  // Check exact permission or wildcard
  if (permissions.length > 0) {
    if (permissions.includes(permissionKey)) {
      return true;
    }
    const [module] = permissionKey.split('.');
    if (module && permissions.includes(`${module}.*`)) {
      return true;
    }
    return false;
  }

  // If user is admin and no explicit permissions array is configured, default to true
  if (role === 'admin') {
    return true;
  }

  return false;
}

/**
 * Checks whether the user has AT LEAST ONE of the specified permissions.
 */
export function hasAnyPermission(user: any, permissionKeys: PermissionKey[]): boolean {
  if (!user) return false;
  return permissionKeys.some((key) => hasPermission(user, key));
}

/**
 * Checks whether the user has ALL of the specified permissions.
 */
export function hasAllPermissions(user: any, permissionKeys: PermissionKey[]): boolean {
  if (!user) return false;
  return permissionKeys.every((key) => hasPermission(user, key));
}

/**
 * Checks whether the user has permission to view a specific module.
 */
export function canViewModule(user: any, moduleName: keyof typeof MODULE_VIEW_PERMISSIONS | string): boolean {
  if (!user) return false;

  // 1. Check company subscription / enabled modules
  if (!isModuleEnabledInCompany(user.company, moduleName)) {
    return false;
  }

  // 2. Superadmin always has access to all enabled modules
  const role = (typeof user.role === 'string' ? user.role : user.role?.name || '').toLowerCase();
  if (role === 'superadmin') {
    return true;
  }

  // 3. Check specific view permissions
  const requiredKeys = MODULE_VIEW_PERMISSIONS[moduleName] || [
    `${moduleName}.view`,
    moduleName,
  ];
  return hasAnyPermission(user, requiredKeys);
}
