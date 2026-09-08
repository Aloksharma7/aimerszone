import { PolicyPage } from "@/components/public-page";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Terms of Service",
  description: "The terms and conditions for using Aimers Zone's learning platform.",
});

export default function TermsPage() {
  return <PolicyPage title="Terms of Service" intro="By using Aimers Zone, you agree to the terms below, which explain your responsibilities as a student and what you can expect from us." sections={[
    { heading: "Your account", body: "Keep your login details private, give us accurate information when you register, and use only the access assigned to your own account. Please do not share your login with anyone else." },
    { heading: "Course and batch access", body: "Your access to a course or batch follows your enrollment status and the schedule and validity period shown on your batch page. Access is not available outside an active, approved enrollment." },
    { heading: "Acceptable use", body: "Do not try to bypass access rules, copy or share protected recordings and materials, disrupt live classes, or misuse tests and resources meant for enrolled students only." },
    { heading: "Changes to classes or content", body: "We may occasionally reschedule a class, change a teacher, or update course content when needed. We will always let you know about any change that affects your batch." },
  ]} />;
}
