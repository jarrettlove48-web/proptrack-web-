import type { Activity, Property } from "./types";

/**
 * Maps an activity to a navigation route.
 * Supports both new activities (with related_id) and old ones (fallback by name matching).
 */
export function getActivityRoute(activity: Activity, properties?: Property[]): string | null {
  switch (activity.type) {
    case "property_added": {
      if (activity.related_id) return `/dashboard/property/${activity.related_id}`;
      // Fallback: subtitle is the property name
      if (properties) {
        const match = properties.find((p) => p.name === activity.subtitle);
        if (match) return `/dashboard/property/${match.id}`;
      }
      return null;
    }
    case "unit_added":
    case "tenant_invited": {
      if (activity.related_property_id) return `/dashboard/property/${activity.related_property_id}`;
      // Fallback: subtitle pattern "Unit X at PropertyName"
      if (properties) {
        const atIdx = activity.subtitle.lastIndexOf(" at ");
        if (atIdx !== -1) {
          const propName = activity.subtitle.slice(atIdx + 4);
          const match = properties.find((p) => p.name === propName);
          if (match) return `/dashboard/property/${match.id}`;
        }
      }
      return null;
    }
    case "expense_added":
      return `/dashboard/expenses`;
    case "request_created":
      return `/dashboard/requests`;
    default:
      return null;
  }
}
