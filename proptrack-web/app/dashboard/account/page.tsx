"use client";

import { useDashboard } from "../layout";
import { User, Mail, Phone, Shield, ExternalLink } from "lucide-react";

export default function AccountPage() {
  const { profile } = useDashboard();

  const planLabels: Record<string, string> = {
    starter: "Starter (Free)",
    essential: "Essential ($9/mo)",
    pro: "Pro ($19/mo)",
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal mb-6" style={{ fontFamily: "var(--font-display)" }}>
        Account
      </h1>

      <div className="bg-white rounded-2xl border border-warm-300/50 p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-brand-faint flex items-center justify-center text-xl font-bold text-brand-dark">
            {profile?.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div>
            <p className="text-lg font-semibold text-charcoal">{profile?.name || "—"}</p>
            <p className="text-sm text-charcoal-secondary">Landlord</p>
          </div>
        </div>

        <div className="space-y-4">
          {[
            { icon: Mail, label: "Email", value: profile?.email },
            { icon: Phone, label: "Phone", value: profile?.phone || "Not set" },
            { icon: Shield, label: "Plan", value: planLabels[profile?.plan || "starter"] },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <item.icon className="w-4 h-4 text-charcoal-tertiary" strokeWidth={1.8} />
              <div>
                <p className="text-xs text-charcoal-tertiary">{item.label}</p>
                <p className="text-sm text-charcoal">{item.value || "—"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-warm-300/50 p-6">
        <h2 className="font-semibold text-charcoal mb-4">Quick links</h2>
        <div className="space-y-3">
          <a
            href="https://proptrack.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between text-sm text-charcoal-secondary hover:text-brand transition-colors"
          >
            <span>PropTrack landing page</span>
            <ExternalLink className="w-4 h-4" />
          </a>
          <a
            href="mailto:support@proptrack.app"
            className="flex items-center justify-between text-sm text-charcoal-secondary hover:text-brand transition-colors"
          >
            <span>Contact support</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
