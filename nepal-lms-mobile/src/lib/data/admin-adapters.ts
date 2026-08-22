import { formatDateTime } from "@/lib/data/format";
import type {
  ApiAdminAnnouncement,
  ApiAdminAnnouncementQueue,
  ApiAdminBatch,
  ApiAdminCategory,
  ApiAdminCourseOption,
  ApiAdminCourseSummary,
  ApiAdminDashboard,
  ApiAdminFaq,
  ApiAdminPaymentMethod,
  ApiAdminPermission,
  ApiAdminRole,
  ApiAdminSettings,
  ApiAdminTeacherOption,
  ApiAdminUser,
  ApiAdminUserDetail,
  ApiAuditLogEntry,
  ApiIntegrationEvent,
  ApiIntegrationStatus,
} from "@/lib/data/api-dtos";
import type {
  AdminAnnouncement,
  AdminAnnouncementQueue,
  AdminBatch,
  AdminCategory,
  AdminCourseOption,
  AdminCourseSummary,
  AdminDashboard,
  AdminFaq,
  AdminPaymentMethod,
  AdminPermission,
  AdminRole,
  AdminSettings,
  AdminTeacherOption,
  AdminUser,
  AdminUserDetail,
  AuditLogEntry,
  IntegrationEvent,
  IntegrationStatus,
} from "@/types/lms";

export function mapAdminPaymentMethod(value: ApiAdminPaymentMethod): AdminPaymentMethod {
  return {
    id: value.id,
    name: value.name,
    accountName: value.account_name,
    accountReference: value.account_reference,
    bankName: value.bank_name,
    branch: value.branch,
    qrImageUrl: value.qr_image_url,
    status: value.status,
    sortOrder: value.sort_order,
  };
}

export function mapAdminSettings(value: ApiAdminSettings): AdminSettings {
  return {
    institution: {
      name: value.institution.name,
      shortName: value.institution.short_name,
      tagline: value.institution.tagline,
      primaryPhone: value.institution.primary_phone,
      supportEmail: value.institution.support_email,
      whatsapp: value.institution.whatsapp,
      website: value.institution.website,
      address: value.institution.address,
      logoUrl: value.institution.logo_url,
      faviconUrl: value.institution.favicon_url,
    },
    paymentMethods: value.payment_methods.map(mapAdminPaymentMethod),
    security: {
      publicRegistration: value.security.public_registration,
      emailVerification: value.security.email_verification,
      privilegedMfa: value.security.privileged_mfa,
      forcePasswordChange: value.security.force_password_change,
      sessionTimeoutHours: value.security.session_timeout_hours,
      failedLoginAttempts: value.security.failed_login_attempts,
      lockoutMinutes: value.security.lockout_minutes,
    },
    operations: {
      maintenanceNotice: value.operations.maintenance_notice,
      automaticReceipts: value.operations.automatic_receipts,
      dailyIntegrationHealthCheck: value.operations.daily_integration_health_check,
    },
    features: {
      singleDeviceLogin: value.features.single_device_login,
      dynamicWatermark: value.features.dynamic_watermark,
      smsNotifications: value.features.sms_notifications,
      esewaCheckout: value.features.esewa_checkout,
      studentSupportTickets: value.features.student_support_tickets,
      publicFreeCourses: value.features.public_free_courses,
    },
    sms: {
      provider: value.sms.provider,
      endpoint: value.sms.endpoint,
      senderId: value.sms.sender_id,
      tokenConfigured: value.sms.token_configured,
      notifyClassStarting: value.sms.notify_class_starting,
      notifyPaymentDecision: value.sms.notify_payment_decision,
      notifyEnrollmentActivated: value.sms.notify_enrollment_activated,
    },
    esewa: { environment: value.esewa.environment, merchantCode: value.esewa.merchant_code, secretKeyConfigured: value.esewa.secret_key_configured },
    content: { watermarkOpacity: value.content.watermark_opacity, watermarkIntervalSeconds: value.content.watermark_interval_seconds },
  };
}

export function mapIntegrationStatus(value: ApiIntegrationStatus): IntegrationStatus {
  return { connected: value.connected, status: value.status, missing: value.missing, failuresLastDay: value.failures_last_day };
}

export function mapIntegrationEvent(value: ApiIntegrationEvent): IntegrationEvent {
  return { id: value.id, action: value.action, reference: value.reference, status: value.status, message: value.message, occurredAt: formatDateTime(value.occurred_at) };
}

export function mapAdminRole(value: ApiAdminRole): AdminRole {
  return {
    id: value.id,
    key: value.key,
    name: value.name,
    usersCount: value.users_count,
    description: value.description,
    permissions: value.permissions,
    protected: value.protected,
  };
}

export function mapAdminPermission(value: ApiAdminPermission): AdminPermission {
  return { id: value.id, key: value.key, group: value.group, description: value.description };
}

export function mapAdminFaq(value: ApiAdminFaq): AdminFaq {
  return {
    id: value.id,
    question: value.question,
    answer: value.answer,
    category: value.category,
    sortOrder: value.sort_order,
    isPublished: value.is_published,
  };
}

export function mapAuditLogEntry(value: ApiAuditLogEntry): AuditLogEntry {
  return {
    id: value.id,
    actorLabel: value.actor_label,
    action: value.action,
    targetLabel: value.target_label,
    occurredAt: formatDateTime(value.occurred_at),
    reason: value.reason,
  };
}

export function mapAdminAnnouncement(value: ApiAdminAnnouncement): AdminAnnouncement {
  return {
    id: value.id,
    title: value.title,
    audienceLabel: value.audience_label,
    authorName: value.author_name,
    channelLabel: value.channel_label,
    scheduledLabel: value.scheduled_label,
    status: value.status,
  };
}

export function mapAdminAnnouncementQueue(value: ApiAdminAnnouncementQueue): AdminAnnouncementQueue {
  return {
    items: value.items.map(mapAdminAnnouncement),
    metrics: {
      publishedMonth: value.metrics.published_month,
      scheduled: value.metrics.scheduled,
      nextScheduledLabel: value.metrics.next_scheduled_label,
      deliveryRatePercent: value.metrics.delivery_rate_percent,
    },
  };
}

export function mapAdminBatch(value: ApiAdminBatch): AdminBatch {
  return {
    id: value.id,
    title: value.title,
    courseTitle: value.course_title,
    teacherName: value.teacher_name,
    teacherNames: value.teacher_names,
    scheduleSummary: value.schedule_summary,
    studentsCount: value.students_count,
    capacity: value.capacity,
    startAt: value.start_at,
    endAt: value.end_at,
    status: value.status,
    courseId: value.course_id,
    teacherIds: value.teacher_ids,
    startDate: value.start_date,
    endDate: value.end_date,
    accessUntilDate: value.access_until_date,
    priceNpr: value.price_npr,
  };
}

export function mapAdminTeacherOption(value: ApiAdminTeacherOption): AdminTeacherOption {
  return { id: value.user_id ?? value.id, name: value.name };
}

export function mapAdminCourseOption(value: ApiAdminCourseOption): AdminCourseOption {
  return { id: value.id, title: value.title };
}

export function mapAdminCourseSummary(value: ApiAdminCourseSummary): AdminCourseSummary {
  return {
    id: value.id,
    slug: value.slug,
    code: value.code,
    title: value.title,
    shortTitle: value.short_title,
    shortDescription: value.short_description,
    description: value.description,
    categoryId: value.category?.id ?? null,
    categoryName: value.category?.name ?? null,
    thumbnailUrl: value.thumbnail_url,
    accessType: value.access_type,
    startingPriceNpr: value.starting_price_npr,
    originalPriceNpr: value.original_price_npr,
    published: value.published,
    availableBatches: value.available_batches,
    features: value.features,
    modulesCount: value.modules_count,
    lessonsCount: value.lessons_count,
    batches: (value.batches ?? []).map((batch) => ({ id: batch.id, title: batch.title, status: batch.status, priceNpr: batch.price_npr })),
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

export function mapAdminCategory(value: ApiAdminCategory): AdminCategory {
  return {
    id: value.id,
    name: value.name,
    slug: value.slug,
    description: value.description,
    sortOrder: value.sort_order,
    isActive: value.is_active,
    courseCount: value.course_count,
  };
}

export function mapAdminDashboard(value: ApiAdminDashboard): AdminDashboard {
  return {
    metrics: {
      activeStudents: value.metrics.active_students,
      activeBatches: value.metrics.active_batches,
      publishedCourses: value.metrics.published_courses,
      activeEnrollments: value.metrics.active_enrollments,
      pendingPayments: value.metrics.pending_payments,
      collectionsMonthNpr: value.metrics.collections_month_npr,
    },
    attention: value.attention.map((item) => ({ id: item.id, title: item.title, detail: item.detail, tone: item.tone })),
  };
}

export function mapAdminUser(value: ApiAdminUser): AdminUser {
  return {
    id: value.id,
    name: value.name,
    email: value.email,
    mobile: value.mobile,
    primaryRole: value.primary_role,
    status: value.status,
    lastSeenAt: value.last_seen_at ? formatDateTime(value.last_seen_at) : null,
    mfaEnabled: value.mfa_enabled,
  };
}

export function mapAdminUserDetail(value: ApiAdminUserDetail): AdminUserDetail {
  return {
    user: { ...mapAdminUser(value.user), studentCode: value.user.student_code, emailVerified: value.user.email_verified },
    metrics: {
      activeEnrollments: value.metrics.active_enrollments,
      approvedPayments: value.metrics.approved_payments,
      learningProgressPercent: value.metrics.learning_progress_percent,
      lastSignInLabel: value.metrics.last_sign_in_label,
    },
    enrollments: value.enrollments.map((enrollment) => ({
      id: enrollment.id,
      courseTitle: enrollment.course_title,
      batchTitle: enrollment.batch_title,
      accessLabel: enrollment.access_label,
      basisLabel: enrollment.basis_label,
      status: enrollment.status,
    })),
    activity: value.activity.map((entry) => ({ id: entry.id, occurredAt: formatDateTime(entry.occurred_at), action: entry.action, detail: entry.detail })),
  };
}
