
'use server';
/**
 * @fileOverview An AI flow for intelligently scheduling and assigning new engagements in bulk.
 *
 * - scheduleEngagements - A function that takes a list of clients and an assignment prompt
 *   and returns a structured assignment plan.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Client, Employee, Department } from '@/lib/data';

// Schema Definitions
const ScheduleEngagementsInputSchema = z.object({
  clientIds: z.array(z.string()).describe("A list of client IDs to create engagements for."),
  assignmentPrompt: z.string().describe("User's instructions on how to assign the engagements."),
});
export type ScheduleEngagementsInput = z.infer<typeof ScheduleEngagementsInputSchema>;

const AssignmentPlanSchema = z.object({
    plan: z.array(z.object({
        clientId: z.string(),
        clientName: z.string(),
        assignedToId: z.string(),
        assignedToName: z.string(),
        reportedToId: z.string(),
        reportedToName: z.string(),
    })).describe("The final assignment plan for all clients."),
});
export type AssignmentPlan = z.infer<typeof AssignmentPlanSchema>;


// Tool to get employees by department
const getEmployeesByDepartment = ai.defineTool(
    {
        name: 'getEmployeesByDepartment',
        description: "Retrieves all employees belonging to a specific department.",
        inputSchema: z.object({ departmentName: z.string() }),
        outputSchema: z.array(z.custom<Employee>()),
    },
    async ({ departmentName }) => {
        const q = query(collection(db, "employees"), where("role", "array-contains", departmentName));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as Employee);
    }
);

// Tool to get a client's default manager and partner
const getManagerAndPartnerForClient = ai.defineTool(
    {
        name: 'getManagerAndPartnerForClient',
        description: "Finds the default manager and partner assigned to a specific client.",
        inputSchema: z.object({ clientId: z.string() }),
        outputSchema: z.object({
            manager: z.custom<Employee>().optional(),
            partner: z.custom<Employee>().optional(),
        }),
    },
    async ({ clientId }) => {
        const clientDoc = await getDoc(doc(db, "clients", clientId));
        if (!clientDoc.exists()) return {};
        const client = clientDoc.data() as Client;

        let partner: Employee | undefined;
        if (client.partnerId) {
            const partnerDoc = await getDoc(doc(db, "employees", client.partnerId));
            if (partnerDoc.exists()) partner = partnerDoc.data() as Employee;
        }

        // Note: The concept of a default 'manager' per client isn't in the schema.
        // We will default the manager to be the partner unless logic changes.
        // The AI will use the partner as the manager if no other manager is specified.
        return { partner, manager: partner };
    }
);


// Genkit Prompt
const engagementSchedulerPrompt = ai.definePrompt({
    name: 'engagementSchedulerPrompt',
    input: { schema: z.object({
        clients: z.array(z.custom<Client>()),
        assignmentPrompt: z.string(),
    })},
    output: { schema: AssignmentPlanSchema },
    tools: [getEmployeesByDepartment, getManagerAndPartnerForClient],
    prompt: `You are an expert resource manager for a Chartered Accountancy firm.
    Your task is to create a detailed assignment plan for a batch of new engagements based on the user's instructions.

    **CONTEXT:**
    - You have been given a list of clients who need a new engagement.
    - The user has provided a prompt explaining how to assign these engagements.
    - The "Allotted To" employee is the primary person responsible for the work.
    - The "Reported To" field should be the manager or partner responsible for overseeing the work.

    **INSTRUCTIONS:**
    1.  Analyze the user's 'assignmentPrompt' to understand their intent (e.g., equal distribution, percentage-based, assigning to specific people or departments).
    2.  Use the \`getEmployeesByDepartment\` tool if the user mentions a department (e.g., "Articles", "Employee").
    3.  For each client, use the \`getManagerAndPartnerForClient\` tool to find their default partner. This partner should be the default "Reported To" person unless the assigned user *is* the partner, in which case the "Reported To" person is also the partner.
    4.  Construct a clear, balanced, and logical assignment plan based on the user's prompt and the data from the tools.
    5.  Distribute the work as evenly as possible if the prompt asks for equal distribution.
    6.  The final output MUST be a JSON object that perfectly matches the 'AssignmentPlan' schema, containing a 'plan' array with an entry for EVERY client.

    **USER PROMPT:**
    {{{assignmentPrompt}}}

    **CLIENTS TO ASSIGN:**
    {{#each clients}}
    - Client ID: {{id}}, Client Name: {{Name}}
    {{/each}}
  `,
});


// Main Flow
const engagementSchedulerFlow = ai.defineFlow(
  {
    name: 'engagementSchedulerFlow',
    inputSchema: ScheduleEngagementsInputSchema,
    outputSchema: AssignmentPlanSchema,
  },
  async ({ clientIds, assignmentPrompt }) => {
    // 1. Fetch all client documents based on IDs
    const clientPromises = clientIds.map(id => getDoc(doc(db, "clients", id)));
    const clientSnapshots = await Promise.all(clientPromises);
    const clients = clientSnapshots.map(snap => snap.data() as Client).filter(Boolean);

    if (clients.length === 0) {
        throw new Error("No valid clients found for the provided IDs.");
    }

    // 2. Call the LLM with the prompt and client data
    const llmResponse = await engagementSchedulerPrompt({
        clients,
        assignmentPrompt
    });

    const output = llmResponse.output();
    if (!output || !output.plan) {
        throw new Error("The AI model failed to produce a valid assignment plan.");
    }
    
    return output;
  }
);


export async function scheduleEngagements(input: ScheduleEngagementsInput): Promise<AssignmentPlan> {
  return engagementSchedulerFlow(input);
}
