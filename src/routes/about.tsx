import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/SiteShell";
import { QUORUM, THRESHOLD_PCT } from "@/lib/posts";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "How it works — Student Voice" },
      { name: "description", content: "How posting, voting, verification, and escalation work on Student Voice." },
      { property: "og:description", content: "Step-by-step: how complaints are posted, peer-voted, verified, and escalated to MU SoE leadership." },
      { name: "twitter:description", content: "Step-by-step: how complaints are posted, peer-voted, verified, and escalated to MU SoE leadership." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <SiteShell>
      <article className="prose prose-sm dark:prose-invert max-w-none">
        <h1 className="font-serif text-2xl font-semibold">How Student Voice works</h1>
        <p className="text-sm text-muted-foreground">
          A peer-moderated record of student grievances at MU School of Engineering.
        </p>

        <h2 className="mt-6 text-base font-semibold">1. Posting</h2>
        <p className="text-sm">
          You must sign in with a registered USN to post. One account per USN; one
          USN per student. You can post up to 3 complaints per day, picking a
          category so issues are easy to find.
        </p>

        <h2 className="mt-6 text-base font-semibold">2. Voting</h2>
        <p className="text-sm">
          Other verified students mark each post <strong>True</strong> or{" "}
          <strong>False</strong>. One vote per USN per post. You can change or
          clear your vote any time before the post resolves.
        </p>

        <h2 className="mt-6 text-base font-semibold">3. The quorum &amp; threshold</h2>
        <p className="text-sm">
          A post can only auto-resolve once it has at least{" "}
          <strong>{QUORUM} total votes</strong> and is older than 48 hours. At
          that point:
        </p>
        <ul className="ml-5 list-disc text-sm">
          <li>
            If ≥<strong>{THRESHOLD_PCT}%</strong> of votes say true → the post
            is marked <strong>Verified</strong>, kept on record forever, and
            emailed to the Director &amp; Vice-Chancellor.
          </li>
          <li>
            If ≥<strong>{THRESHOLD_PCT}%</strong> say false → the post is
            auto-removed.
          </li>
          <li>Anything in between stays open and keeps collecting votes.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold">4. Flags</h2>
        <p className="text-sm">
          Anyone signed in can flag a post that looks like spam, abuse, or
          defamation. Flags go to the admin moderation queue and are reviewed
          independently of voting.
        </p>

        <h2 className="mt-6 text-base font-semibold">5. Privacy</h2>
        <p className="text-sm">
          Your USN is never shown publicly and is{" "}
          <strong>never included</strong> in the letter sent to leadership.
          Read the full <Link to="/privacy" className="underline">Privacy &amp; Anonymity</Link> note.
        </p>
      </article>
    </SiteShell>
  );
}