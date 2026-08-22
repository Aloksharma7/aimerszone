# Feature audit: what mobile actually needs to build

The instruction behind this document: build what's real and used on the web
app, not everything that technically exists in its code. This is that
audit — every feature area, whether it's genuinely wired up on web, and
whether it belongs in mobile.

## Explicitly excluded

**Preferred language (English/Nepali).** A `preferred_language` field is
collected on the student-creation form and stored on the account, but
nothing anywhere in the codebase reads it back to change any UI text —
there is no translation library, no locale files, no language switch. It's
a stored value with zero effect. Confirmed by searching the whole frontend
for any i18n/locale implementation: none exists. **Not built in mobile v1.**
If real localization is ever added, it should be designed once and added to
both web and mobile together, not bolted onto mobile alone from a field
that doesn't do anything yet on either platform.

**Enrollment Requests, Learning Operations.** Both were removed from the web
app entirely during this project (dead/undiscoverable workflow and a
pure-aggregation screen with no unique action, respectively). Not relevant
to mobile since they no longer exist anywhere.

## Per-role feature inventory (web, real and working)

Used to build the phase order in `docs/ROADMAP.md`. "Mobile-worth" is a
judgment call on whether the feature is meaningfully better or more
convenient on a phone than on a laptop someone already has open — not
whether it's technically portable.

### Student
| Feature | Mobile-worth | Notes |
|---|---|---|
| Dashboard | High | Natural landing screen |
| Explore / My Courses (syllabus, live join, recordings, resources, tests, attendance) | High | "Join live class" and "watch a recording" are core on-the-go use cases |
| Payments (submit + status) | High | Photographing a payment screenshot/slip *from* the phone is a real advantage over web here |
| Receipts (list, view, download) | Medium | Useful, less time-sensitive |
| Notifications | High | Push is the actual point of mobile notifications — see Phase 6 |
| Profile & Security | Medium | 2FA/session management, needed but not urgent |
| Support tickets | Medium | |

### Teacher
| Feature | Mobile-worth | Notes |
|---|---|---|
| Dashboard | High | |
| Batches | Medium | |
| Classes: join/start live, recurring setup | High | Starting a class or checking today's schedule from a phone while walking into a room is a real scenario |
| Attendance finalize | High | Physically in the room, phone in hand, is exactly when this gets used |
| Content (recordings/resources/tests) build & manage | Low | Genuinely a desktop task — authoring a test on a phone keyboard is painful |
| Announcements | Medium | |

### Staff (merged enrollment + accounting)
| Feature | Mobile-worth | Notes |
|---|---|---|
| Dashboard | Medium | |
| Students / Enroll flow | Medium | Enrolling a walk-in student from a tablet at a counter is plausible |
| Payment Submissions / Review / Adjustments / Refunds | Medium | Reviewing a proof image is fine on mobile; heavy data-entry (adjustments) is not |
| Courses/Categories/Syllabus CRUD | Low | Desktop task — authoring content on a phone is painful |
| Support Inbox | Medium | |

### Admin
| Feature | Mobile-worth | Notes |
|---|---|---|
| Dashboard / attention panel | Medium | Good for a quick check, not for acting |
| Users & Roles | Low | Rare, high-consequence actions better done deliberately at a desk |
| Reports (academic/enrollments/finance) | Low | Reading a data table on a phone is worse than on web; a *summary* view might be worth it later, not a port of the web table |
| Platform Settings (branding, security, integrations) | Very low | Infrequent, detail-heavy, easy to fat-finger on a small screen |

This "worth" column is exactly why the phase order in `docs/ROADMAP.md` goes
Student → Teacher → Staff → Admin, and why some admin/staff screens may
never get a full mobile build even in a mature version of this app —
some things are just better left as desktop-only, and that's fine.
