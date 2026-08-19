import { PolicyPage } from "@/components/public-page";

export default function TermsPage() {
  return <PolicyPage title="Terms of use" intro="These terms describe the expected rules for account, learning and platform use." sections={[
    { heading: "Account responsibility", body: "Keep login details private, provide accurate information and use only the access assigned to your own account." },
    { heading: "Learning access", body: "Course and batch access follows the approved enrollment status, release schedule and access-expiry policy shown in the platform." },
    { heading: "Acceptable use", body: "Do not attempt to bypass access rules, copy protected account information, disrupt classes or misuse tests, recordings and resources." },
    { heading: "Service changes", body: "The institution may reschedule classes, replace teachers or adjust content when necessary, while communicating material changes clearly." },
  ]} />;
}
