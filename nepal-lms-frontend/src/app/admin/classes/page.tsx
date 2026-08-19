/*
 * Administrator oversight of the class schedule.
 *
 * The admin menu used to link straight at /teacher/classes. That navigated out
 * of the admin portal: the URL changed to /teacher/... and the sidebar was
 * replaced by the teacher menu, with no way back to admin except the browser
 * button. The screen is the same; only the route it lives at has changed, so
 * an administrator stays an administrator throughout.
 */
export { default } from "@/app/teacher/classes/page";
