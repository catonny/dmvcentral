
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { sendEmail } from './send-email-flow';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Engagement, EngagementType } from '@/lib/data';
import { format } from 'date-fns';

const BulkEmailClientSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
});

const SendBulkEmailInputSchema = z.object({
  clients: z.array(BulkEmailClientSchema),
  subjectTemplate: z.string(),
  bodyTemplate: z.string(),
  // For context to fetch engagement details
  engagementTypeId: z.string().optional(),
  status: z.string().optional(),
  financialYear: z.string().optional(),
});
export type SendBulkEmailInput = z.infer<typeof SendBulkEmailInputSchema>;

const sendBulkPersonalizedEmailFlow = ai.defineFlow(
  {
    name: 'sendBulkPersonalizedEmailFlow',
    inputSchema: SendBulkEmailInputSchema,
    outputSchema: z.object({ success: z.boolean(), sentCount: z.number() }),
  },
  async ({ clients, subjectTemplate, bodyTemplate, engagementTypeId, status, financialYear }) => {
    
    // 1. Fetch relevant engagements if context is provided
    let engagementMap = new Map<string, Engagement>();
    if (engagementTypeId) {
        let q = query(
            collection(db, "engagements"),
            where("type", "==", engagementTypeId),
            where("clientId", "in", clients.map(c => c.id))
        );
        if (status && status !== 'All') {
            q = query(q, where("status", "==", status));
        }
        if (financialYear) {
             q = query(q, where("financialYear", "==", financialYear));
        }
        
        const engagementSnapshot = await getDocs(q);
        engagementSnapshot.forEach(doc => {
            const eng = doc.data() as Engagement;
            // Assuming one relevant engagement per client for this email
            if (!engagementMap.has(eng.clientId)) {
                 engagementMap.set(eng.clientId, eng);
            }
        });
    }

    const engagementTypeSnap = await getDocs(collection(db, "engagementTypes"));
    const engagementTypeMap = new Map(engagementTypeSnap.docs.map(d => [d.id, d.data() as EngagementType]));
    
    let sentCount = 0;

    for (const client of clients) {
        const engagement = engagementMap.get(client.id);
        const engagementType = engagement ? engagementTypeMap.get(engagement.type) : undefined;
        
        let subject = subjectTemplate.replace(/\{\{clientName\}\}/g, client.name);
        let body = bodyTemplate.replace(/\{\{clientName\}\}/g, client.name);
        
        if (engagement) {
            subject = subject.replace(/\{\{engagementType\}\}/g, engagementType?.name || engagement.remarks);
            subject = subject.replace(/\{\{dueDate\}\}/g, format(new Date(engagement.dueDate), "dd MMM, yyyy"));
            
            body = body.replace(/\{\{engagementType\}\}/g, engagementType?.name || engagement.remarks);
            body = body.replace(/\{\{dueDate\}\}/g, format(new Date(engagement.dueDate), "dd MMM, yyyy"));
        }
        
        if (client.email && client.email !== 'unassigned') {
            await sendEmail({
                recipientEmails: [client.email],
                subject,
                body,
            });
            sentCount++;
        }
    }
    
    return { success: true, sentCount };
  }
);

export async function sendBulkPersonalizedEmail(input: SendBulkEmailInput): Promise<{ success: boolean; sentCount: number; }> {
  return sendBulkPersonalizedEmailFlow(input);
}
