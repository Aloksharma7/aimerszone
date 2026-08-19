import { expect, test, type Page } from "@playwright/test";

const workspaces = [
  ["/", /Study with a clear plan/i],
  ["/student/dashboard", /Welcome back, Riya/i],
  ["/teacher/dashboard", /Good evening, Aarav/i],
  ["/staff/dashboard", /Good evening, Sanjay/i],
  ["/accounting/dashboard", /Payment review dashboard/i],
  ["/admin/dashboard", /System overview/i],
] as const;

for (const [path, heading] of workspaces) {
  test(`${path} loads its primary workspace`, async ({ page }: { page: Page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
  });
}

test("student catalogue remains inside the protected student shell", async ({ page }) => {
  await page.goto("/student/explore");
  await expect(page.getByRole("heading", { name: "Explore Courses" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Recorded Classes|Recordings/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /PDFs/ }).first()).toBeVisible();
});

test("student recording and resource libraries are available", async ({ page }) => {
  await page.goto("/student/recordings");
  await expect(page.getByRole("heading", { name: "Recorded Classes" })).toBeVisible();
  await page.goto("/student/resources");
  await expect(page.getByRole("heading", { name: "PDFs & Resources" })).toBeVisible();
});

test("Enrollment Officer can open course management and creation", async ({ page }) => {
  await page.goto("/staff/courses");
  await expect(page.getByRole("heading", { name: "Courses" })).toBeVisible();
  await page.getByRole("link", { name: /Add course/i }).click();
  await expect(page).toHaveURL(/\/staff\/courses\/new$/);
  await expect(page.getByRole("heading", { name: /Create course/i })).toBeVisible();
});
