<?php

namespace App\Enums;

enum RoleKey: string
{
    case Student = 'student';
    case Teacher = 'teacher';
    case Staff = 'staff';
    case Admin = 'admin';
    case SuperAdmin = 'super_admin';

    public function label(): string
    {
        return match ($this) {
            self::Student => 'Student',
            self::Teacher => 'Teacher',
            self::Staff => 'Staff',
            self::Admin => 'Admin',
            self::SuperAdmin => 'Super Admin',
        };
    }

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public function portalHome(): string
    {
        return match ($this) {
            self::Student => '/student/dashboard',
            self::Teacher => '/teacher/dashboard',
            self::Staff => '/staff/dashboard',
            self::Admin => '/admin/dashboard',
            self::SuperAdmin => '/admin/dashboard',
        };
    }

    /**
     * Highest privilege first. Used to pick portal_home when a user holds
     * more than one role.
     *
     * @return array<int, self>
     */
    public static function byPriority(): array
    {
        return [self::SuperAdmin, self::Admin, self::Staff, self::Teacher, self::Student];
    }
}
