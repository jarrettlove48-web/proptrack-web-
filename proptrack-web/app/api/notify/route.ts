import { Resend } from "resend";
import { NextResponse } from "next/server";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend && process.env.RESEND_API_KEY) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}
const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || "PropTrack <notifications@proptrack.app>";

type NotificationType = "contractor_assigned" | "contractor_accepted" | "contractor_declined";

interface NotifyPayload {
  type: NotificationType;
  recipientEmail: string;
  recipientName: string;
  data: Record<string, string>;
}

export async function POST(request: Request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not set, skipping email");
      return NextResponse.json({ success: true, skipped: true });
    }

    const body: NotifyPayload = await request.json();

    if (!body.type || !body.recipientEmail || !body.recipientName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { subject, html } = buildEmail(body.type, body.recipientName, body.data);

    const resend = getResend();
    if (!resend) {
      return NextResponse.json({ success: true, skipped: true });
    }

    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: body.recipientEmail,
      subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Notify route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function buildEmail(type: NotificationType, name: string, data: Record<string, string>): { subject: string; html: string } {
  switch (type) {
    case "contractor_assigned":
      return {
        subject: `New job assigned: ${data.category} at ${data.propertyName}`,
        html: emailWrapper(`
          <h2 style="margin:0 0 8px;font-size:20px;color:#1C1917;">You've been assigned a job</h2>
          <p style="margin:0 0 20px;color:#78716C;font-size:14px;">Hi ${name}, a landlord has assigned you to a maintenance request on PropTrack.</p>

          <div style="background:#F8F6F3;border-radius:12px;padding:16px;margin-bottom:20px;">
            <p style="margin:0 0 4px;font-size:13px;color:#78716C;">Category</p>
            <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#1C1917;">${data.category}</p>
            <p style="margin:0 0 4px;font-size:13px;color:#78716C;">Description</p>
            <p style="margin:0 0 12px;font-size:15px;color:#1C1917;">${data.description}</p>
            <p style="margin:0 0 4px;font-size:13px;color:#78716C;">Location</p>
            <p style="margin:0;font-size:15px;color:#1C1917;">${data.propertyName} · ${data.unitLabel}</p>
            ${data.tenantName ? `<p style="margin:4px 0 0;font-size:13px;color:#78716C;">Tenant: ${data.tenantName}</p>` : ""}
          </div>

          <a href="${data.portalUrl}" style="display:inline-block;background:#0C8276;color:white;font-weight:600;font-size:14px;padding:12px 28px;border-radius:12px;text-decoration:none;">
            View & respond
          </a>
          <p style="margin:16px 0 0;font-size:13px;color:#A8A29E;">Log in to accept or decline this job.</p>
        `),
      };

    case "contractor_accepted":
      return {
        subject: `${data.contractorName} accepted: ${data.category} request`,
        html: emailWrapper(`
          <h2 style="margin:0 0 8px;font-size:20px;color:#1C1917;">Contractor accepted the job</h2>
          <p style="margin:0 0 20px;color:#78716C;font-size:14px;">Hi ${name}, your contractor has accepted a maintenance request.</p>

          <div style="background:#ECFDF5;border-radius:12px;padding:16px;margin-bottom:20px;">
            <p style="margin:0 0 4px;font-size:13px;color:#059669;">Accepted by</p>
            <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#1C1917;">${data.contractorName}</p>
            <p style="margin:0 0 4px;font-size:13px;color:#059669;">Request</p>
            <p style="margin:0;font-size:15px;color:#1C1917;">${data.category} — ${data.propertyName}</p>
          </div>

          <a href="${data.dashboardUrl}" style="display:inline-block;background:#0C8276;color:white;font-weight:600;font-size:14px;padding:12px 28px;border-radius:12px;text-decoration:none;">
            View requests
          </a>
        `),
      };

    case "contractor_declined":
      return {
        subject: `${data.contractorName} declined: ${data.category} request`,
        html: emailWrapper(`
          <h2 style="margin:0 0 8px;font-size:20px;color:#1C1917;">Contractor declined the job</h2>
          <p style="margin:0 0 20px;color:#78716C;font-size:14px;">Hi ${name}, your contractor has declined a maintenance request. You may want to assign another contractor.</p>

          <div style="background:#FEF2F2;border-radius:12px;padding:16px;margin-bottom:20px;">
            <p style="margin:0 0 4px;font-size:13px;color:#DC2626;">Declined by</p>
            <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#1C1917;">${data.contractorName}</p>
            <p style="margin:0 0 4px;font-size:13px;color:#DC2626;">Request</p>
            <p style="margin:0;font-size:15px;color:#1C1917;">${data.category} — ${data.propertyName}</p>
          </div>

          <a href="${data.dashboardUrl}" style="display:inline-block;background:#0C8276;color:white;font-weight:600;font-size:14px;padding:12px 28px;border-radius:12px;text-decoration:none;">
            Assign another contractor
          </a>
        `),
      };
  }
}

function emailWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8F6F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 20px;">
    <div style="margin-bottom:24px;">
      <span style="display:inline-flex;align-items:center;gap:8px;">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;background:#0C8276;border-radius:8px;">
          <img src="https://app.proptrack.app/favicon.ico" width="18" height="18" alt="" style="display:block;" />
        </span>
        <span style="font-size:18px;font-weight:700;color:#1C1917;">PropTrack</span>
      </span>
    </div>
    <div style="background:white;border-radius:16px;padding:28px;border:1px solid #E7E5E4;">
      ${content}
    </div>
    <p style="margin:20px 0 0;font-size:12px;color:#A8A29E;text-align:center;">
      Sent by PropTrack · <a href="https://app.proptrack.app" style="color:#0C8276;">app.proptrack.app</a>
    </p>
  </div>
</body>
</html>`;
}
