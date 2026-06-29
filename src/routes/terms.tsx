import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/SiteShell";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — MUSE Student Voice" },
      { name: "description", content: "Acceptable-use rules for MUSE Student Voice: who can post, what is not allowed, how moderation works, and what is not guaranteed." },
      { property: "og:title", content: "Terms of Use — MUSE Student Voice" },
      { property: "og:description", content: "House rules for MUSE Student Voice: posting limits, prohibited content, moderation, and admin escalation policy." },
      { name: "twitter:title", content: "Terms of Use — MUSE Student Voice" },
      { name: "twitter:description", content: "House rules for MUSE Student Voice: posting limits, prohibited content, moderation, and admin escalation policy." },
      { property: "og:url", content: "https://muse-studentsvoice.lovable.app/terms" },
    ],
    links: [{ rel: "canonical", href: "https://muse-studentsvoice.lovable.app/terms" }],
  }),
  component: Terms,
});

function Terms() {
  return (
    <SiteShell>
      <article className="prose prose-sm dark:prose-invert max-w-none">
        <h1 className="font-serif text-2xl font-semibold">Terms of Use</h1>
        <p className="text-sm text-muted-foreground">Last updated June 2026.</p>

        <h2 className="mt-6 text-base font-semibold">Who can use this</h2>
        <p className="text-sm">
          MUSE Student Voice is open to students of <strong>Mysore University
          School of Engineering (MUSE)</strong> whose USN is on the registry.
          One account per USN.
        </p>

        <h2 className="mt-6 text-base font-semibold">What you must not post</h2>
        <ul className="ml-5 list-disc text-sm">
          <li>Personal attacks, names of specific students, or harassment.</li>
          <li>Defamatory statements presented as fact without basis.</li>
          <li>Spam, advertising, or attempts to vote-brigade.</li>
          <li>Content that is illegal under Indian law.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold">Moderation</h2>
        <p className="text-sm">
          Posts and comments may be removed by the platform administrator if
          they violate these rules, regardless of how the community has voted.
          Repeated violations may result in the associated account being
          suspended and its USN released back to the registry.
        </p>

        <h2 className="mt-6 text-base font-semibold">No guarantees</h2>
        <p className="text-sm">
          Student Voice is provided as-is by a student maintainer. We make no
          guarantee that complaints will be acted upon by the college.
        </p>
      </article>
    </SiteShell>
  );
}