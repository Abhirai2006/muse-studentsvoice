import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/SiteShell";

export const Route = createFileRoute("/complaint-guide")({
  head: () => ({
    meta: [
      { title: "How to write an effective university complaint letter — MUSE Students Voice" },
      { name: "description", content: "A practical guide for MUSE students: how to structure a formal grievance, present facts, provide evidence, and improve your chances of verification." },
      { property: "og:title", content: "How to write an effective university complaint letter" },
      { property: "og:description", content: "Structure, tone, and evidence tips for writing a formal complaint that gets taken seriously by university leadership." },
      { property: "og:url", content: "https://muse-studentsvoice.lovable.app/complaint-guide" },
      { property: "og:type", content: "article" },
      { name: "twitter:title", content: "How to write an effective university complaint letter" },
      { name: "twitter:description", content: "Structure, tone, and evidence tips for writing a formal complaint that gets taken seriously by university leadership." },
    ],
    links: [{ rel: "canonical", href: "https://muse-studentsvoice.lovable.app/complaint-guide" }],
  }),
  component: ComplaintGuide,
});

function ComplaintGuide() {
  return (
    <SiteShell>
      <article className="prose prose-sm dark:prose-invert max-w-none">
        <h1 className="font-serif text-2xl font-semibold">How to write an effective complaint letter to a university</h1>
        <p className="text-sm text-muted-foreground">
          A short, practical guide for MUSE students. Well-structured complaints are more likely to
          reach the 70% peer-verification threshold on Students Voice and be taken seriously by
          college leadership.
        </p>

        <h2 className="mt-6 text-base font-semibold">1. Stick to one issue</h2>
        <p className="text-sm">
          Address one grievance per post. Mixing hostel food, exam scheduling, and lab safety into a
          single complaint makes it hard for peers to vote and for administrators to act.
        </p>

        <h2 className="mt-6 text-base font-semibold">2. Lead with the facts</h2>
        <p className="text-sm">
          Open with what happened, where, and when. Names of buildings, labs, or courses help
          verification. Avoid personal attacks — describe the behaviour, not the person.
        </p>

        <h2 className="mt-6 text-base font-semibold">3. Provide evidence</h2>
        <p className="text-sm">
          Reference dates, timetables, notices, or documents. If you have photos or files, describe
          them clearly so other students can confirm from their own experience.
        </p>

        <h2 className="mt-6 text-base font-semibold">4. State the impact</h2>
        <p className="text-sm">
          Explain how the issue affects students — attendance, learning, safety, or fees. Impact is
          what turns a personal frustration into a shared grievance.
        </p>

        <h2 className="mt-6 text-base font-semibold">5. Suggest a fix</h2>
        <p className="text-sm">
          A short, reasonable suggestion — a repair, a rescheduling, a policy clarification — helps
          leadership respond. It also shows peers you are here to solve the problem, not just vent.
        </p>

        <h2 className="mt-6 text-base font-semibold">Template</h2>
        <pre className="text-xs whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3">
{`Location: <e.g. Physics lab, Year 2 block>
Issue type: <infrastructure / cleanliness / faculty conduct / safety / academic / administrative>

What happened:
<one or two sentences describing the incident, with date and time>

Evidence:
<timetable, notice, photo description, or specific dates>

Impact on students:
<one sentence — attendance, learning, safety, fees>

Suggested fix:
<one or two sentences>`}
        </pre>
      </article>
    </SiteShell>
  );
}