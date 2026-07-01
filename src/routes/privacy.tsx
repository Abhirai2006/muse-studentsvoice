import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/SiteShell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy & Anonymity — MUSE Student Voice" },
      { name: "description", content: "Plain-language explanation of how MUSE Student Voice handles your USN, what is shown to other students, and what is shared with the Director and VC." },
      { property: "og:title", content: "Privacy & Anonymity — MUSE Student Voice" },
      { property: "og:description", content: "Pseudonymous, not fully anonymous: exactly what we store about MUSE students, what is public, and what reaches college leadership." },
      { name: "twitter:title", content: "Privacy & Anonymity — MUSE Student Voice" },
      { name: "twitter:description", content: "Pseudonymous, not fully anonymous: exactly what we store about MUSE students, what is public, and what reaches college leadership." },
      { property: "og:url", content: "https://muse-studentsvoice.lovable.app/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://muse-studentsvoice.lovable.app/privacy" }],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <SiteShell>
      <article className="prose prose-sm dark:prose-invert max-w-none">
        <h1 className="font-serif text-2xl font-semibold">Privacy &amp; Anonymity</h1>
        <p className="text-sm text-muted-foreground">
          Plain-language version. Last updated June 2026.
        </p>

        <h2 className="mt-6 text-base font-semibold">Pseudonymous, not fully anonymous</h2>
        <p className="text-sm">
          MUSE Student Voice is <strong>pseudonymous</strong>. We collect your USN,
          email, and password (or a Google sign-in) so that we can enforce one
          account per student and stop duplicate voting. We do not collect your
          full name, phone number, or year/section beyond what your USN encodes.
        </p>

        <h2 className="mt-6 text-base font-semibold">What other students see</h2>
        <ul className="ml-5 list-disc text-sm">
          <li>Your USN is <strong>never shown</strong> on posts, votes, or comments.</li>
          <li>
            Comments use a stable per-post handle like <code>Student #A7F2</code>.
            The same student gets the same handle on a given post, but a
            different handle on a different post — so people can follow a
            thread without anyone being identifiable across posts.
          </li>
          <li>Vote tallies are public, but who voted which way is not.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold">What the system stores internally</h2>
        <p className="text-sm">
          The database knows which account owns which USN, which posts were
          written by that account, and which way that account voted. Row-level
          security policies prevent any normal student from reading this; the
          author of a post can identify their own posts, and that's it.
        </p>

        <h2 className="mt-6 text-base font-semibold">Who can see the link between USN and post</h2>
        <p className="text-sm">
          Only the platform administrator (currently the project maintainer)
          has the database access required to join a USN to a specific post.
          That access is used only for abuse handling — investigating spam,
          defamation, or threats reported via the flag system — and is never
          shared with the college, faculty, or leadership in the normal course
          of operation.
        </p>

        <h2 className="mt-6 text-base font-semibold">What leadership receives</h2>
        <p className="text-sm">
          When a complaint is verified and escalated, the email sent to the
          Director and Vice-Chancellor contains:
        </p>
        <ul className="ml-5 list-disc text-sm">
          <li>The complaint body, exactly as posted.</li>
          <li>The community vote tally (e.g. "82% credibility, 41 votes").</li>
          <li>A reference ID and a link to the public post.</li>
        </ul>
        <p className="text-sm">
          The email does <strong>not</strong> include your USN, your email, or
          any other identifier that would let leadership trace the post back to
          you. The author of a verified complaint stays anonymous to the
          college.
        </p>

        <h2 className="mt-6 text-base font-semibold">Legal compulsion</h2>
        <p className="text-sm">
          If a court, law enforcement agency, or the university issues a valid
          legal request that specifically names a post, the administrator may
          be compelled to disclose the linked account. This has not happened
          and we will publish a note here if it ever does.
        </p>

        <p className="mt-8 text-xs text-muted-foreground">
          Questions? Email{" "}
          <a className="underline" href="mailto:studentvoice.muse@gmail.com">
            studentvoice.muse@gmail.com
          </a>
          . See also our <Link to="/terms" className="underline">Terms of Use</Link>.
        </p>
      </article>
    </SiteShell>
  );
}