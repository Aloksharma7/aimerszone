import { api } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/contracts";
import {
  mapAnnouncement,
  mapCourseRecording,
  mapCourseResource,
  mapCourseTest,
  mapEnrollmentDetail,
  mapLiveSession,
  mapSyllabusModule,
} from "@/lib/data/adapters";
import type {
  ApiAnnouncement,
  ApiClassSession,
  ApiEnrollment,
  ApiRecording,
  ApiResourceFile,
  ApiSyllabusModule,
  ApiTest,
} from "@/lib/data/api-dtos";
import type {
  CourseRecording,
  CourseResource,
  CourseTest,
  DashboardAnnouncement,
  EnrollmentDetail,
  LiveSession,
  SyllabusModule,
} from "@/types/lms";

export async function fetchCourseDetail(enrollmentId: string): Promise<EnrollmentDetail> {
  const response = await api.get<ApiResponse<ApiEnrollment>>(`/api/v1/student/courses/${enrollmentId}`);
  return mapEnrollmentDetail(response.data);
}

export async function fetchCourseClasses(enrollmentId: string): Promise<LiveSession[]> {
  const response = await api.get<ApiResponse<ApiClassSession[]>>(`/api/v1/student/courses/${enrollmentId}/classes`);
  return response.data.map(mapLiveSession);
}

export async function fetchCourseRecordings(enrollmentId: string): Promise<CourseRecording[]> {
  const response = await api.get<ApiResponse<ApiRecording[]>>(`/api/v1/student/courses/${enrollmentId}/recordings`);
  return response.data.map(mapCourseRecording);
}

export async function fetchCourseResources(enrollmentId: string): Promise<CourseResource[]> {
  const response = await api.get<ApiResponse<ApiResourceFile[]>>(`/api/v1/student/courses/${enrollmentId}/resources`);
  return response.data.map(mapCourseResource);
}

export async function fetchCourseSyllabus(enrollmentId: string): Promise<SyllabusModule[]> {
  const response = await api.get<ApiResponse<ApiSyllabusModule[]>>(`/api/v1/student/courses/${enrollmentId}/syllabus`);
  return response.data.map(mapSyllabusModule);
}

export async function fetchCourseTests(enrollmentId: string): Promise<CourseTest[]> {
  const response = await api.get<ApiResponse<ApiTest[]>>(`/api/v1/student/courses/${enrollmentId}/tests`);
  return response.data.map(mapCourseTest);
}

export async function fetchCourseAnnouncements(enrollmentId: string): Promise<DashboardAnnouncement[]> {
  const response = await api.get<ApiResponse<ApiAnnouncement[]>>(`/api/v1/student/courses/${enrollmentId}/announcements`);
  return response.data.map(mapAnnouncement);
}

export async function setLessonComplete(enrollmentId: string, lessonId: string, completed: boolean): Promise<{ syllabusPercent: number }> {
  const response = await api.post<ApiResponse<{ lesson_id: string; completed: boolean; syllabus_percent: number }>>(
    `/api/v1/student/courses/${enrollmentId}/lessons/${lessonId}/complete`,
    { completed },
  );
  return { syllabusPercent: response.data.syllabus_percent };
}

export type MediaDestination = { url: string; expiresAt: string };

/** Signed, short-lived — never cached client-side, fetched fresh each time the student actually taps download. */
export async function downloadResource(resourceId: string): Promise<MediaDestination> {
  const response = await api.post<ApiResponse<{ url: string; expires_at: string; filename: string; size_bytes: number | null }>>(
    `/api/v1/student/resources/${resourceId}/download`,
  );
  return { url: response.data.url, expiresAt: response.data.expires_at };
}

/**
 * Records resume position server-side as a side effect, so it must only be
 * called when playback genuinely starts, never prefetched.
 */
export async function playRecording(recordingId: string): Promise<MediaDestination> {
  const response = await api.post<ApiResponse<{ url: string; expires_at: string }>>(`/api/v1/student/recordings/${recordingId}/playback`);
  return { url: response.data.url, expiresAt: response.data.expires_at };
}
