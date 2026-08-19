<?php

namespace App\Providers;

use App\Models\Announcement;
use App\Models\Batch;
use App\Models\ClassSession;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Payment;
use App\Models\Recording;
use App\Models\Resource;
use App\Models\SupportTicket;
use App\Models\Test;
use App\Models\User;
use App\Policies\AnnouncementPolicy;
use App\Policies\BatchPolicy;
use App\Policies\ClassSessionPolicy;
use App\Policies\CoursePolicy;
use App\Policies\EnrollmentPolicy;
use App\Policies\PaymentPolicy;
use App\Policies\RecordingPolicy;
use App\Policies\ResourcePolicy;
use App\Policies\SupportTicketPolicy;
use App\Policies\TestPolicy;
use App\Policies\UserPolicy;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Gate;

class AuthServiceProvider extends ServiceProvider
{
    protected $policies = [
        Announcement::class => AnnouncementPolicy::class,
        Batch::class => BatchPolicy::class,
        ClassSession::class => ClassSessionPolicy::class,
        Course::class => CoursePolicy::class,
        Enrollment::class => EnrollmentPolicy::class,
        Payment::class => PaymentPolicy::class,
        Recording::class => RecordingPolicy::class,
        Resource::class => ResourcePolicy::class,
        SupportTicket::class => SupportTicketPolicy::class,
        Test::class => TestPolicy::class,
        User::class => UserPolicy::class,
    ];

    public function boot(): void
    {
        /*
         * Only Super Admin bypasses individual policy methods unconditionally
         * — every action still runs through the audit logger. Admin is
         * broad but not absolute: it passes policy checks through its real
         * permission grants (most policies already delegate to
         * hasPermission()), which is what keeps settings/integrations/role
         * management and other-admin accounts out of its reach. Suspended
         * accounts never bypass anything.
         */
        Gate::before(function (User $user) {
            if (! $user->isActive()) {
                return false;
            }

            return $user->isSuperAdmin() ? true : null;
        });

        // Permission keys used by both middleware and Blade-free policy checks.
        Gate::define('permission', fn (User $user, string $permission) => $user->hasPermission($permission));
    }
}
