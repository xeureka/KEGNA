export interface Paginated<T> {
	items: T[];
	total: number;
	page: number;
	pageSize: number;
}

export interface SessionUser {
	id: string;
	name: string;
	email: string;
	isSuperAdmin?: boolean;
}

export interface SessionContext {
	user: SessionUser;
	tenant: {
		id: string;
		name: string;
		slug: string;
		logoUrl?: string | null;
		brandColor?: string;
	};
	membership: { id: string; status: string };
	role: { name: string };
	permissions: string[];
	token: string;
}

export interface TenantBranding {
	name: string;
	slug: string;
	logoUrl: string | null;
	brandColor: string;
}

export interface PlatformTenant {
	id: string;
	name: string;
	slug: string;
	status: string;
	logoUrl: string | null;
	brandColor: string;
}

export type RoleName =
	| "OWNER"
	| "ADMIN"
	| "DOCTOR"
	| "RECEPTIONIST"
	| "ACCOUNTANT";
export type MembershipStatus = "ACTIVE" | "INVITED" | "SUSPENDED" | "INACTIVE";

export interface Patient {
	id: string;
	patientNumber: string;
	firstName: string;
	lastName: string;
	dateOfBirth: string | null;
	gender: string | null;
	phone: string | null;
	email: string | null;
	address: string | null;
	emergencyContactName: string | null;
	emergencyContactPhone: string | null;
	membershipTier: string | null;
	createdAt: string;
}

export interface Doctor {
	id: string;
	userId: string;
	licenseNumber: string;
	specialization: string | null;
	bio: string | null;
	isAvailable: boolean;
	userName: string;
	userEmail: string;
}

export type AppointmentStatus =
	| "SCHEDULED"
	| "CONFIRMED"
	| "CHECKED_IN"
	| "IN_PROGRESS"
	| "COMPLETED"
	| "CANCELLED"
	| "NO_SHOW";

export interface Appointment {
	id: string;
	patientId: string;
	doctorId: string;
	startAt: string;
	endAt: string;
	status: AppointmentStatus;
	reason: string | null;
	notes: string | null;
	cancelledAt: string | null;
	cancelledReason: string | null;
	patientName: string;
	doctorName: string;
}

export type QueueEntry = Appointment;

export interface MedicalRecord {
	id: string;
	patientId: string;
	doctorId: string | null;
	appointmentId: string | null;
	chiefComplaint: string | null;
	diagnosis: string | null;
	treatment: string | null;
	notes: string | null;
	patientName: string;
	doctorName: string | null;
	createdAt: string;
}

export type BillStatus =
	| "DRAFT"
	| "PENDING"
	| "PARTIALLY_PAID"
	| "PAID"
	| "CANCELLED"
	| "VOID";
export type PaymentMethod =
	| "CASH"
	| "CARD"
	| "BANK_TRANSFER"
	| "MOBILE_MONEY"
	| "OTHER";

export interface BillItem {
	id: string;
	description: string;
	quantity: string;
	unitPrice: string;
	discountAmount: string;
	taxAmount: string;
	totalAmount: string;
}

export interface Bill {
	id: string;
	patientId: string;
	appointmentId: string | null;
	billNumber: string;
	status: BillStatus;
	subtotal: string;
	discountAmount: string;
	taxAmount: string;
	totalAmount: string;
	notes: string | null;
	createdAt: string;
	patientName: string;
	amountPaid: string;
}

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

export interface AuditLog {
	id: string;
	actorUserId: string | null;
	action: AuditAction;
	entityType: string;
	entityId: string | null;
	oldValues: unknown;
	newValues: unknown;
	ipAddress: string | null;
	createdAt: string;
}

export type Member = {
	id: string;
	userId: string;
	roleId: string;
	roleName: RoleName;
	status: MembershipStatus;
	joinedAt: string | null;
	userName: string;
	userEmail: string;
};

export type DiscountType = "NONE" | "PERCENTAGE" | "FIXED";

export interface Procedure {
	id: string;
	code: string | null;
	name: string;
	category: string | null;
	defaultPrice: string;
	defaultDurationMinutes: number | null;
	discountType: DiscountType;
	discountValue: string;
	isActive: boolean;
	createdAt: string;
}

/** Legacy alias for `Procedure` kept so existing pages compile unchanged. */
export type Service = Procedure;

export type DentalChartStatus = "PLANNED" | "COMPLETED" | "CANCELLED";

export interface DentalChartEntry {
	id: string;
	patientId: string;
	doctorId: string;
	appointmentId: string | null;
	toothNumber: number;
	surface: string | null;
	procedureId: string | null;
	procedureName: string;
	notes: string | null;
	charge: string;
	status: DentalChartStatus;
	datePerformed: string | null;
	createdAt: string;
}

export interface ScheduleDaySlot {
	id: string;
	doctorId: string;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	isAvailable: boolean;
}

export interface DashboardQueueItem {
	id: string;
	patientName: string;
	doctorName: string;
	startAt: string;
	endAt: string;
	status: AppointmentStatus;
}

export interface DashboardData {
	date: string;
	role: string | null;
	outstandingBalance: number;
	today: {
		total: number;
		checkedIn: number;
		inProgress: number;
		completed: number;
		cancelled: number;
		revenueCollected: number;
		queue: DashboardQueueItem[];
	};
	upcoming: { items: DashboardQueueItem[]; total: number };
	month: {
		appointments: number;
		newPatients: number;
		billsIssued: number;
		revenueCollected: number;
	};
	statusDistribution: Array<{ status: string; value: number }>;
}

/** Legacy alias so the dashboard page compiles until migrated. */
export type DashboardStats = DashboardData;

export interface DailyReport {
	date: string;
	appointments: {
		scheduled: number;
		confirmed: number;
		checkedIn: number;
		inProgress: number;
		completed: number;
		cancelled: number;
		noShow: number;
		total: number;
	};
	patientsSeen: number;
	billsIssued: number;
	invoiced: number;
	revenueCollected: number;
}

export interface FinancialReport {
	dateFrom: string;
	dateTo: string;
	bills: number;
	invoiced: number;
	collected: number;
	outstanding: number;
}
