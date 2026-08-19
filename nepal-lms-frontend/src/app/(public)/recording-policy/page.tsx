import { PolicyPage } from "@/components/public-page";

export default function RecordingPolicyPage() {
  return <PolicyPage title="Recording and sharing policy" intro="Recordings support revision, but unlisted hosting is not digital-rights management." sections={[
    { heading: "Authorized viewing", body: "Recordings are available only to users with active access to the relevant batch and only during the approved access period." },
    { heading: "No redistribution", body: "Users may not copy, repost, sell, publicly share or distribute recording links, files, account credentials or institution resources." },
    { heading: "Class participation", body: "Live sessions may be recorded according to an institution-approved consent notice. Students should review that notice before participation." },
    { heading: "Technical limitation", body: "Unlisted video hosting reduces public discovery but cannot guarantee that content is impossible to capture or redistribute." },
  ]} />;
}
