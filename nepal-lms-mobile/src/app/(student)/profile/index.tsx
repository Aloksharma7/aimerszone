import { ProfileOverviewScreen } from "@/components/account/profile-overview-screen";

export default function StudentProfileScreen() {
  return <ProfileOverviewScreen basePath="/(student)/profile" supportPath="/(student)/support" receiptsPath="/(student)/receipts" />;
}
