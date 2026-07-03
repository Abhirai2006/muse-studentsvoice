import jsPDF from "jspdf";
import type { PendingLetter } from "@/lib/escalations.functions";

type Recipient = { name: string; email: string; role: string };

/**
 * Generate a printable formal-letter PDF for a verified student complaint and
 * trigger a browser download. The letter is anonymous — no USN is included.
 */
export async function generateLetterPDF(letter: PendingLetter, recipients: Recipient[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 56;
  const contentWidth = pageWidth - margin * 2;

  const total = letter.trueCount + letter.falseCount;
  const pct = total ? Math.round((letter.trueCount * 100) / total) : 0;
  const ref = letter.postId.slice(0, 8).toUpperCase();
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  let y = margin;

  // Letterhead
  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.text("MUSE Students Voice", pageWidth / 2, y, { align: "center" });
  y += 20;
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text("Mysore University School of Engineering — Peer-verified student grievance", pageWidth / 2, y, { align: "center" });
  y += 14;
  doc.setDrawColor(120);
  doc.line(margin, y, pageWidth - margin, y);
  y += 24;

  // Meta block
  doc.setFontSize(11);
  doc.text(`Date:      ${today}`, margin, y); y += 14;
  doc.text(`Reference: SV/${ref}`, margin, y); y += 14;
  doc.text(`Submitted: ${new Date(letter.createdAt).toLocaleString("en-IN")}`, margin, y); y += 14;
  doc.text(
    `Verified:  ${letter.resolvedAt ? new Date(letter.resolvedAt).toLocaleString("en-IN") : "—"}`,
    margin, y,
  ); y += 14;
  doc.text(`Community vote: ${letter.trueCount} True / ${letter.falseCount} False (${pct}% credibility)`, margin, y);
  y += 24;

  // Recipients
  if (recipients.length > 0) {
    doc.setFont("times", "bold");
    doc.text("To:", margin, y); y += 14;
    doc.setFont("times", "normal");
    for (const r of recipients) {
      doc.text(`${r.name} (${r.role}) — ${r.email}`, margin, y); y += 14;
    }
    y += 10;
  }

  // Salutation
  doc.setFont("times", "normal");
  doc.text("Respected Sir/Madam,", margin, y); y += 20;

  const intro = "A student complaint has been verified as credible by the MUSE student community on the Students Voice platform. In line with platform policy, the grievance is forwarded to you for your kind attention and appropriate action.";
  const introLines = doc.splitTextToSize(intro, contentWidth);
  doc.text(introLines, margin, y); y += introLines.length * 14 + 10;

  // Complaint body
  doc.setFont("times", "bold");
  doc.text("Complaint (verbatim):", margin, y); y += 16;
  doc.setFont("times", "italic");
  const bodyLines = doc.splitTextToSize(letter.body, contentWidth - 20);
  for (const line of bodyLines) {
    if (y > 780) { doc.addPage(); y = margin; }
    doc.text(line, margin + 12, y); y += 14;
  }
  y += 14;

  doc.setFont("times", "normal");
  const closing = "The author's identity is withheld to protect the student, but they are a verified student of the institution whose USN was authenticated at the time of posting. The complaint has been reviewed by the student body and passed the platform's verification threshold.";
  const closingLines = doc.splitTextToSize(closing, contentWidth);
  if (y + closingLines.length * 14 > 780) { doc.addPage(); y = margin; }
  doc.text(closingLines, margin, y); y += closingLines.length * 14 + 20;

  doc.text("Respectfully submitted,", margin, y); y += 14;
  doc.setFont("times", "bold");
  doc.text("The MUSE Student Body", margin, y); y += 14;
  doc.setFont("times", "italic");
  doc.setFontSize(9);
  doc.text("via Students Voice — https://muse-studentsvoice.lovable.app", margin, y);

  doc.save(`Student-Voice-Letter-${ref}.pdf`);
}

/**
 * Build an email subject + plain-text body for a verified complaint so the
 * admin can paste it into their own email client and forward it manually.
 */
export function buildLetterEmail(letter: PendingLetter, recipients: Recipient[]) {
  const total = letter.trueCount + letter.falseCount;
  const pct = total ? Math.round((letter.trueCount * 100) / total) : 0;
  const ref = letter.postId.slice(0, 8).toUpperCase();
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  const subject = `MUSE Students Voice — Verified student complaint (Ref SV/${ref})`;
  const to = recipients.map((r) => r.email).join(",");
  const cc = "";

  const body =
`Respected Sir/Madam,

A student complaint has been verified as credible by the MUSE student community on the Students Voice platform. In line with platform policy, the grievance is forwarded to you for your kind attention and appropriate action.

Reference:    SV/${ref}
Date:         ${today}
Submitted:    ${new Date(letter.createdAt).toLocaleString("en-IN")}
Verified:     ${letter.resolvedAt ? new Date(letter.resolvedAt).toLocaleString("en-IN") : "—"}
Community vote: ${letter.trueCount} True / ${letter.falseCount} False (${pct}% credibility)

Complaint (verbatim):
"${letter.body}"

The author's identity is withheld to protect the student, but they are a verified student of the institution whose USN was authenticated at the time of posting. The complaint has passed the platform's peer-verification threshold.

A formal PDF letter is attached / available on request.

Respectfully submitted,
The MUSE Student Body
via Students Voice — https://muse-studentsvoice.lovable.app
`;

  const mailto = `mailto:${encodeURIComponent(to)}${cc ? `?cc=${encodeURIComponent(cc)}&` : "?"}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { subject, body, to, mailto };
}