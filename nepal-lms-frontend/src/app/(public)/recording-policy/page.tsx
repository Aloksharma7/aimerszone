import { PolicyPage } from "@/components/public-page";

export default function RecordingPolicyPage() {
  return <PolicyPage title="Recording Policy" intro="Class recordings are provided so you can revise at your own pace. This policy explains how they can be used." sections={[
    { heading: "Who can watch", body: "Recordings are available only to students with active access to that batch, and only for as long as your access period is valid." },
    { heading: "No redistribution", body: "Please do not copy, download and repost, sell, or share recording links, files or your own login with anyone outside your account. This protects the work of our teachers and keeps the content available for genuinely enrolled students." },
    { heading: "Live class recording", body: "Some live classes are recorded for this purpose. By joining a live class, you agree that the session may be recorded and made available to enrolled students in your batch." },
    { heading: "A note on hosting", body: "Recordings are hosted privately and are not intended to be publicly discoverable, but no video platform can fully prevent someone from capturing content that plays on their screen. We ask every student to respect the no-redistribution rule above." },
  ]} />;
}
