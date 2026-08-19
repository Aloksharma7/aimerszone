<?php

namespace App\Policies;

use App\Models\Course;
use App\Models\User;

class CoursePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('courses.view');
    }

    public function view(User $user, Course $course): bool
    {
        return $course->published || $user->hasPermission('courses.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('courses.create');
    }

    public function update(User $user, Course $course): bool
    {
        // Archived courses are historical records; they are restored first.
        if ($course->status->value === 'archived') {
            return $user->isAdmin();
        }

        return $user->hasPermission('courses.update');
    }

    public function publish(User $user, Course $course): bool
    {
        return $user->hasPermission('courses.publish');
    }

    public function delete(User $user, Course $course): bool
    {
        // A course with enrollments carries financial and academic history.
        return $user->isAdmin() && ! $course->enrollments()->exists();
    }
}
