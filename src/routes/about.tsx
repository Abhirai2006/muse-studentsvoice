import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/SiteShell";
import { QUORUM, THRESHOLD_PCT } from "@/lib/posts";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "How it works — MUSE Students Voice" },
      {
        name: "description",
        content:
          "Step-by-step guide to MUSE Students Voice: posting with USN, peer voting, the 30-vote quorum, the 70% threshold, and escalation to Director and VC.",
      },
      { property: "og:title", content: "How it works — MUSE Students Voice" },
      {
        property: "og:description",
        content:
          "How complaints at Mysore University School of Engineering get posted, peer-voted, verified at 70% credibility, and escalated to college leadership.",
      },
      { name: "twitter:title", content: "How it works — MUSE Students Voice" },
      {
        name: "twitter:description",
        content:
          "How complaints at Mysore University School of Engineering get posted, peer-voted, verified at 70% credibility, and escalated to college leadership.",
      },
      { property: "og:url", content: "https://muse-studentsvoice.lovable.app/about" },
    ],
    links: [{ rel: "canonical", href: "https://muse-studentsvoice.lovable.app/about" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Who can post a complaint?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Only students with a registered MUSE USN can post. One account per USN, one USN per student, capped at three complaints per day.",
              },
            },
            {
              "@type": "Question",
              name: `What is the voting quorum?`,
              acceptedAnswer: {
                "@type": "Answer",
                text: `A post can only auto-resolve after it collects at least ${QUORUM} peer votes.`,
              },
            },
            {
              "@type": "Question",
              name: "What credibility threshold verifies a complaint?",
              acceptedAnswer: {
                "@type": "Answer",
                text: `Once the ${QUORUM}-vote quorum is met, a complaint is marked verified when at least ${THRESHOLD_PCT}% of votes are True, and removed when at least ${THRESHOLD_PCT}% are False.`,
              },
            },
            {
              "@type": "Question",
              name: "What happens after a complaint is verified?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Verified complaints are compiled into an anonymised PDF letter for the Director and VC of Mysore University School of Engineering. No student identity is shared.",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: About,
});

function About() {
  return (
    <SiteShell>
      <article className="prose prose-sm dark:prose-invert max-w-none">
        <h1 className="font-serif text-2xl font-semibold">How Students Voice works</h1>
        <p className="text-sm text-muted-foreground">
          A peer-moderated record of student grievances at MUSE — Mysore University School of
          Engineering.
        </p>

        <h2 className="mt-6 text-base font-semibold">1. Posting</h2>
        <p className="text-sm">
          You must sign in with a registered USN to post. One account per USN; one USN per student.
          You can post up to 3 complaints per day. Each complaint must be tagged with both a{" "}
          <strong>Location</strong> (where it happened — a specific lab, year block, library, admin
          dept, garden, etc.) and an
          <strong> Issue type</strong> (infrastructure, cleanliness, faculty conduct, safety,
          academic, administrative, or other) so issues are easy to filter and trends are visible.
        </p>

        <h2 className="mt-6 text-base font-semibold">2. Voting</h2>
        <p className="text-sm">
          Other verified students mark each post <strong>True</strong> or <strong>False</strong>.
          One vote per USN per post. You can change or clear your vote any time before the post
          resolves.
        </p>

        <h2 className="mt-6 text-base font-semibold">3. The quorum &amp; threshold</h2>
        <p className="text-sm">
          A post can only auto-resolve once it has at least <strong>{QUORUM} total votes</strong>{" "}
          and is older than 48 hours. At that point:
        </p>
        <ul className="ml-5 list-disc text-sm">
          <li>
            If ≥<strong>{THRESHOLD_PCT}%</strong> of votes say true → the post is marked{" "}
            <strong>Verified</strong>, kept on record forever, and emailed to the Director &amp;
            Vice-Chancellor.
          </li>
          <li>
            If ≥<strong>{THRESHOLD_PCT}%</strong> say false → the post is auto-removed.
          </li>
          <li>Anything in between stays open and keeps collecting votes.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold">4. Flags</h2>
        <p className="text-sm">
          Anyone signed in can flag a post that looks like spam, abuse, or defamation. Flags go to
          the admin moderation queue and are reviewed independently of voting.
        </p>

        <h2 className="mt-6 text-base font-semibold">5. Privacy</h2>
        <p className="text-sm">
          Your USN is never shown publicly and is <strong>never included</strong> in the letter sent
          to leadership. Read the full{" "}
          <Link to="/privacy" className="underline">
            Privacy &amp; Anonymity
          </Link>{" "}
          note.
        </p>
      </article>
    </SiteShell>
  );
}
