export type RequestCategory = "plumbing" | "electrical" | "hvac" | "appliance" | "other";
export type RequestStatus = "open" | "in_progress" | "resolved";
export type UserRole = "landlord" | "tenant";
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
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  request_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: "landlord" | "tenant";
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

export interface Activity {
  id: string;
  owner_id: string;
  type: string;
  title: string;
  subtitle: string;
  related_id: string | null;
  created_at: string;
}

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
