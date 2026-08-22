<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Laravel's default morphs() made tokenable_id a bigint, but every model
     * in this app (User included) has a ULID string primary key — inserts
     * failed with "Data truncated for column 'tokenable_id'" on MySQL (SQLite's
     * lenient typing hid this in the test suite). Table is empty, so this is
     * a safe structural fix, not a data migration.
     */
    public function up(): void
    {
        Schema::table('personal_access_tokens', function (Blueprint $table) {
            $table->dropMorphs('tokenable');
        });

        Schema::table('personal_access_tokens', function (Blueprint $table) {
            $table->ulidMorphs('tokenable');
        });
    }

    public function down(): void
    {
        Schema::table('personal_access_tokens', function (Blueprint $table) {
            $table->dropMorphs('tokenable');
        });

        Schema::table('personal_access_tokens', function (Blueprint $table) {
            $table->morphs('tokenable');
        });
    }
};
