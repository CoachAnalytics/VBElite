import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy policy — VB Elite" };

const CONTACT = "Zach@menace2sports.com";
const EFFECTIVE = "November 2, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  const mail = <a href={`mailto:${CONTACT}`} className="text-accent-ink underline">{CONTACT}</a>;
  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Privacy policy</h1>
        <p className="mt-1 text-sm text-ink-3">Effective {EFFECTIVE}</p>
      </div>

      <p className="text-sm leading-relaxed text-ink-2">
        VB Elite helps volleyball families research college programs and manage recruiting. This policy explains what we
        collect, how we use it, and the choices you have. Questions or requests: {mail}.
      </p>

      <Section title="Who should create an account">
        <p>
          Accounts are meant to be created and managed by a parent or guardian, or by an athlete 13 or older. If you believe a
          child under 13 created an account without a parent&apos;s involvement, email us and we&apos;ll delete it.
        </p>
      </Section>

      <Section title="What we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Account:</b> your email address and password (stored only as a secure hash; we can&apos;t read it).</li>
          <li><b>Athlete profile:</b> the athlete&apos;s name, graduation year, position, height, home ZIP code, and optionally birth month and year (never a full date of birth).</li>
          <li><b>Questionnaire answers:</b> measurements (standing reach, block and approach touch), club and school playing level, academics ranges, and school preferences.</li>
          <li><b>Stats and links:</b> season stats you enter or paste (kills, digs, aces, blocks, assists and similar), and the link to her MaxPreps page if you add one. We never collect anything from MaxPreps ourselves; the link is only shown to you and to the coaches you contact.</li>
          <li><b>Recruiting activity:</b> what you log, such as emails sent, coach replies, camp invitations, visits, offers and commitments, and the schools on your list.</li>
          <li><b>Coach confirmations:</b> if you send a confirmation link, the coach&apos;s name and role you enter and the coach&apos;s answers.</li>
          <li><b>Coach emails you add:</b> a coach&apos;s name, title and email address you submit for a school.</li>
        </ul>
        <p>We don&apos;t use advertising trackers or third-party analytics. We use one cookie to keep you signed in.</p>
      </Section>

      <Section title="How we use it">
        <p>
          To run VB Elite for you: estimating the level of program that fits, recommending schools, comparing measurements for
          the athlete&apos;s age, tracking recruiting, and showing her own history. Your profile, answers and recruiting log are
          visible only to your account (and to us when needed to operate or support the service).
        </p>
      </Section>

      <Section title="Anonymous statistics">
        <p>
          To make age-based comparisons and projections more accurate for every athlete, we include the following in VB
          Elite&apos;s anonymous statistics by default: the athlete&apos;s measurements (height, reach, touches) with the date
          and her age at the time, her season stats, her position and graduation year, and snapshots of offers and commitments she logs (the
          school, its level and conference, and her measurements, latest stats, age, club level and coach&apos;s projection at
          that time). Her MaxPreps link is not included.
        </p>
        <p>
          These records are stored without her name, email address or other contact details. When we analyze or export them,
          each athlete is replaced by a random code. We use them to build age-by-position norms and recruiting projections, and
          we only share or publish results as summaries that don&apos;t identify any athlete. We never sell them.
        </p>
        <p>
          You can opt out at any time on the athlete&apos;s <Link href="/profile#data" className="text-accent-ink underline">profile</Link>.
          Opting out removes her data from the statistics from then on, including records collected earlier. Her own
          comparisons and projections work the same either way.
        </p>
      </Section>

      <Section title="Coach emails families add">
        <p>
          A coach email you add appears for your account right away. After our team checks it, it&apos;s shown to other
          families on that school&apos;s page as &quot;added by a VB Elite family&quot;, without your name or email.
        </p>
      </Section>

      <Section title="Sharing">
        <p>We don&apos;t sell personal information. We share it only:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>with service providers that host the site and its database, under their own security and confidentiality terms;</li>
          <li>when you choose to share it, such as sending a coach confirmation link or emailing a coach from VB Elite;</li>
          <li>if required by law, or to protect the safety of our users or the service.</li>
        </ul>
      </Section>

      <Section title="School and recruiting data">
        <p>
          School pages show information compiled from public sources: official athletics websites, the NCAA, the U.S.
          Department of Education&apos;s College Scorecard, and public commitment announcements. To correct or remove
          information about you, email us.
        </p>
      </Section>

      <Section title="Keeping and deleting data">
        <p>
          We keep your information while your account is open. To delete your account and the athlete&apos;s profile, answers
          and recruiting log, email {mail} from the address on the account. Records in the anonymous statistics are already
          separated from her name and contact details; on request we&apos;ll remove those too.
        </p>
      </Section>

      <Section title="Security">
        <p>
          The site uses encrypted connections (HTTPS), passwords are stored as one-way hashes, and sign-in sessions expire. No
          system is perfectly secure, so please use a password you don&apos;t use elsewhere.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If we change this policy, we&apos;ll update the date above, and for significant changes we&apos;ll let you know on the
          site or by email.
        </p>
      </Section>
    </article>
  );
}
