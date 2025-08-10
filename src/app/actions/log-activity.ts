
'use server';

import { db as pgDb } from '@/lib/db';
import type { ActivityLogType, Employee, Engagement } from '@/lib/data';

interface LogActivityOptions {
    engagement: Engagement;
    type: ActivityLogType;
    user: Employee;
    details: {
        from?: string;
        to?: string;
        taskName?: string;
    };
}

export const logActivity = async ({ engagement, type, user, details }: LogActivityOptions) => {
    try {
        const queryText = `
            INSERT INTO activity_log (engagement_id, client_id, type, user_id, user_name, details, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        const values = [
            engagement.id,
            engagement.clientId,
            type,
            user.id,
            user.name,
            {
                engagementName: engagement.remarks,
                ...details,
            },
            new Date().toISOString(),
        ];
        await pgDb.query(queryText, values);
    } catch (error) {
        console.error("Failed to log activity to PostgreSQL:", error);
        // Depending on requirements, you might want to re-throw the error
        // or handle it silently. For now, we log it.
    }
}
