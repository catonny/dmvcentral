
'use server';
/**
 * @fileOverview An AI flow for intelligently reallocating an inactive employee's workload.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { collection, query, where, getDocs, startOfMonth, endOfMonth } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Employee, Engagement, EngagementType } from '@/lib/data';

// Input and Output Schemas
const ReallocateEngagementsInputSchema = z.object({
  inactiveEmployeeId: z.string().describe("The ID of the employee who is now inactive."),
});
export type ReallocateEngagementsInput = z.infer<typeof ReallocateEngagementsInputSchema>;

const ReallocationPlanSchema = z.object({
  plan: z.array(z.object({
    engagementId: z.string(),
    engagementRemarks: z.string(),
    newAssigneeId: z.string(),
    newAssigneeName: z.string(),
    reasoning: z.string().describe("A brief explanation for why this reassignment is suggested."),
  })).describe("The proposed reallocation plan."),
});
export type ReallocationPlan = z.infer<typeof ReallocationPlanSchema>;


// Tool to get active engagements for an employee
const getActiveEngagements = ai.defineTool(
    {
        name: 'getActiveEngagementsForEmployee',
        description: "Retrieves all active (not Completed or Cancelled) engagements for a specific employee.",
        inputSchema: z.object({ employeeId: z.string() }),
        outputSchema: z.array(z.custom<Engagement>()),
    },
    async ({ employeeId }) => {
        const q = query(
            collection(db, "engagements"),
            where("assignedTo", "array-contains", employeeId),
            where("status", "in", ["Pending", "In Process", "Awaiting Documents", "Partner Review", "On Hold"])
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as Engagement);
    }
);

// Tool to get workloads of all active employees within a specific time window
const getEmployeeWorkloads = ai.defineTool(
    {
        name: 'getEmployeeWorkloads',
        description: "Calculates the current workload for all active employees based on standard hours of their assigned engagements within a specific date range. The calculation includes both active and completed work in that period.",
        inputSchema: z.object({ 
            excludeEmployeeId: z.string(),
            reallocationEndDate: z.string().describe("The due date of the latest engagement being reallocated. This sets the end of the workload calculation window."),
        }),
        outputSchema: z.array(z.object({
            employeeId: z.string(),
            employeeName: z.string(),
            workloadHours: z.number(),
        })),
    },
    async ({ excludeEmployeeId, reallocationEndDate }) => {
        const periodStart = startOfMonth(new Date());
        const periodEnd = endOfMonth(new Date(reallocationEndDate));

        const [employeesSnap, engagementsSnap, engagementTypesSnap] = await Promise.all([
            getDocs(query(collection(db, "employees"), where("isActive", "!=", false))),
            getDocs(query(
                collection(db, "engagements"),
                where("dueDate", ">=", periodStart.toISOString()),
                where("dueDate", "<=", periodEnd.toISOString()),
            )),
            getDocs(collection(db, "engagementTypes")),
        ]);

        const engagementTypesMap = new Map(engagementTypesSnap.docs.map(d => [d.id, d.data() as EngagementType]));
        const activeEmployees = employeesSnap.docs.map(d => d.data() as Employee).filter(e => e.id !== excludeEmployeeId);
        
        // Filter engagements to include only active or completed ones within the window
        const relevantEngagements = engagementsSnap.docs.map(d => d.data() as Engagement).filter(e => e.status !== "Cancelled");

        return activeEmployees.map(emp => {
            const workloadHours = relevantEngagements
                .filter(eng => eng.assignedTo.includes(emp.id))
                .reduce((total, eng) => {
                    const engType = engagementTypesMap.get(eng.type);
                    return total + (eng.budgetedHours || engType?.standardHours || 10); // Use budgeted, then standard, then default
                }, 0);
            
            return { employeeId: emp.id, employeeName: emp.name, workloadHours };
        });
    }
);

// Genkit Prompt for Reallocation
const reallocateEngagementsPrompt = ai.definePrompt({
    name: 'reallocateEngagementsPrompt',
    input: { schema: z.object({
        inactiveEmployeeName: z.string(),
        engagementsToReallocate: z.array(z.custom<Engagement>()),
        employeeWorkloads: z.array(z.any())
    })},
    output: { schema: ReallocationPlanSchema },
    tools: [getActiveEngagements, getEmployeeWorkloads],
    prompt: `You are an expert HR and resource manager for a Chartered Accountancy firm.
    An employee, {{{inactiveEmployeeName}}}, has become inactive, and their workload must be redistributed.
    
    Your task is to create a fair and balanced reallocation plan.

    **CONTEXT:**
    - You have a list of all active engagements that belonged to {{{inactiveEmployeeName}}}.
    - You have a list of all other active employees and their current total workload in standard hours for the relevant period. The workload already includes completed and pending work.
    
    **INSTRUCTIONS:**
    1.  Review the list of engagements that need to be reassigned.
    2.  Review the current workloads of all available active employees.
    3.  For each engagement, assign it to the employee you believe is the best fit, aiming to distribute the new work as evenly as possible. Prioritize assigning work to employees with lower current workloads.
    4.  Provide a brief 'reasoning' for each assignment (e.g., "Lowest current workload", "Has capacity for this engagement").
    5.  The final output must be a JSON object that perfectly matches the 'ReallocationPlan' schema, containing a 'plan' array with an entry for EVERY engagement that needs to be reassigned.

    **Engagements to Reallocate:**
    {{#each engagementsToReallocate}}
    - Engagement ID: {{id}}, Remarks: "{{remarks}}", Due: {{dueDate}}
    {{/each}}
    
    **Current Employee Workloads (in hours):**
    {{#each employeeWorkloads}}
    - {{employeeName}}: {{workloadHours}} hours
    {{/each}}
  `,
});

// Main Flow
const reallocateEngagementsFlow = ai.defineFlow(
  {
    name: 'reallocateEngagementsFlow',
    inputSchema: ReallocateEngagementsInputSchema,
    outputSchema: ReallocationPlanSchema,
  },
  async ({ inactiveEmployeeId }) => {
    
    const engagementsToReallocate = await getActiveEngagements({ employeeId: inactiveEmployeeId });

    if (engagementsToReallocate.length === 0) {
        return { plan: [] }; // No active engagements to reallocate.
    }
    
    // Find the latest due date among the engagements to reallocate to set the time window
    const latestDueDate = engagementsToReallocate.reduce((latest, eng) => {
        const engDate = new Date(eng.dueDate);
        return engDate > latest ? engDate : latest;
    }, new Date(0)).toISOString();

    const [employeeWorkloads, inactiveEmployeeDoc] = await Promise.all([
        getEmployeeWorkloads({ excludeEmployeeId: inactiveEmployeeId, reallocationEndDate: latestDueDate }),
        getDocs(query(collection(db, "employees"), where("id", "==", inactiveEmployeeId)))
    ]);
    
    const inactiveEmployeeName = inactiveEmployeeDoc.docs[0]?.data().name || 'Unknown Employee';

    const llmResponse = await reallocateEngagementsPrompt({
        inactiveEmployeeName,
        engagementsToReallocate,
        employeeWorkloads
    });

    return llmResponse.output() || { plan: [] };
  }
);


export async function reallocateEngagements(input: ReallocateEngagementsInput): Promise<ReallocationPlan> {
  return reallocateEngagementsFlow(input);
}
