export type RequestCategory = "plumbing" | "electrical" | "hvac" | "appliance" | "other";
export type RequestStatus = "open" | "in_progress" | "resolved";
export type UserRole = "landlord" | "tenant" | "contractor";
export type PlanTier = "starter" | "essential" | "pro";

export interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  plan: PlanTier;
  dark_mode: boolean;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  unit_count: number;
  created_at: string;
}

export interface Unit {
  id: string;
  property_id: string;
  owner_id: string;
  label: string;
  tenant_name: string;
  tenant_phone: string;
  tenant_email: string;
  move_in_date: string;
  is_occupied: boolean;
  is_invited: boolean;
  invited_at: string | null;
  invite_code: string | null;
  tenant_portal_active: boolean;
  tenant_user_id: string | null;
  lease_end_date: string | null;
  created_at: string;
}

export interface MaintenanceRequest {
  id: string;
  unit_id: string;
  property_id: string;
  owner_id: string;
  category: RequestCategory;
  description: string;
  status: RequestStatus;
  photo_uri: string | null;
  tenant_name: string;
  unit_label: string;
  property_name: string;
  service_date: string | null;
  requested_date: string | null;
  assigned_contractor_id: string | null;
  contractor_status: ContractorStatus | null;
  proposed_times: ProposedTimeSlot[] | null;
  confirmed_time: string | null;
  confirmed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  request_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: "landlord" | "tenant" | "contractor";
  body: string;
  created_at: string;
}

export interface Expense {
  id: string;
  request_id: string | null;
  property_id: string;
  unit_id: string | null;
  owner_id: string;
  description: string;
  amount: number;
  category: "repair" | "maintenance" | "upgrade" | "inspection" | "other";
  date: string;
  vendor: string | null;
  receipt_uri: string | null;
  is_recurring: boolean;
  created_at: string;
}

export interface Tenant {
  id: string;
  unit_id: string;
  property_id: string;
  owner_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  user_id: string | null;
  lease_start: string | null;
  lease_end: string | null;
  move_in_date: string | null;
  move_out_date: string | null;
  is_active: boolean;
  invite_code: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  owner_id: string;
  type: string;
  title: string;
  subtitle: string;
  related_id: string | null;
  related_property_id: string | null;
  created_at: string;
}

export type CalendarEventType = "maintenance" | "rent_reminder" | "move_in" | "move_out" | "inspection" | "other";

export interface CalendarEvent {
  id: string;
  owner_id: string;
  property_id: string | null;
  unit_id: string | null;
  title: string;
  description: string | null;
  event_date: string;
  event_type: CalendarEventType;
  created_at: string;
}

export const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  maintenance: "Maintenance",
  rent_reminder: "Rent Reminder",
  move_in: "Move-in",
  move_out: "Move-out",
  inspection: "Inspection",
  other: "Other",
};

export const STATUS_LABELS: Record<RequestStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
};

export const CATEGORY_LABELS: Record<RequestCategory, string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  hvac: "HVAC",
  appliance: "Appliance",
  other: "Other",
};

// Contractor types
export type ContractorCategory =
  | "plumber"
  | "electrician"
  | "general_contractor"
  | "landscaper"
  | "painter"
  | "roofer"
  | "hvac_tech"
  | "other";

export type ContractorStatus = "pending" | "accepted" | "declined";

export interface Contractor {
  id: string;
  owner_id: string;
  first_name: string;
  last_name: string;
  company: string | null;
  website: string | null;
  category: ContractorCategory;
  phone: string | null;
  email: string | null;
  notes: string | null;
  invite_code: string;
  user_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RequestMedia {
  id: string;
  request_id: string;
  media_url: string;
  media_type: string;
  uploaded_by: string | null;
  created_at: string;
}

export const CONTRACTOR_CATEGORY_LABELS: Record<ContractorCategory, string> = {
  plumber: "Plumber",
  electrician: "Electrician",
  general_contractor: "General Contractor",
  landscaper: "Landscaper",
  painter: "Painter",
  roofer: "Roofer",
  hvac_tech: "HVAC Tech",
  other: "Other",
};

export const CONTRACTOR_STATUS_LABELS: Record<ContractorStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
};

export interface ProposedTimeSlot {
  date: string;      // "YYYY-MM-DD"
  startTime: string; // "HH:MM" (24h)
  endTime: string;   // "HH:MM" (24h)
}

/** Maps request category → best-match contractor category */
export const REQUEST_TO_CONTRACTOR_CATEGORY: Record<RequestCategory, ContractorCategory> = {
  plumbing: "plumber",
  electrical: "electrician",
  hvac: "hvac_tech",
  appliance: "general_contractor",
  other: "other",
};
