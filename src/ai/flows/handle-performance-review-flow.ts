

'use server';
/**
 * @fileOverview An AI flow for reviewing an employee's monthly performance,
 * identifying hour deficits and budget overruns, and notifying the partner.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { collection, query, where, getDocs, doc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Employee, Engagement, Timesheet, Department, EngagementType, Todo } from '@/lib/data';
import { startOfMonth, endOfMonth, format } from 'date-fns';

// Schema Definitions
const HandlePerformanceReviewInputSchema = z.object({
  employeeId: z.string().describe("The ID of the employee to review."),
  period: z.string().describe("The review period in 'yyyy-MM' format."),
  reviewerId: z.string().describe("The ID of the partner or manager initiating the review."),
});
export type HandlePerformanceReviewInput = z.infer<typeof HandlePerformanceReviewInputSchema>;

const PerformanceReviewOutputSchema = z.object({
  summary: z.string().describe("A concise summary of the performance issues found."),
  deficitHours: z.number().optional().describe("The total deficit in monthly target hours."),
  overrunEngagements: z.array(z.object({
      engagementId: z.string(),
      engagementName: z.string(),
      overrunHours: z.number(),
  })).describe("A list of engagements where budgeted hours were exceeded."),
});
export type PerformanceReviewOutput = z.infer<typeof PerformanceReviewOutputSchema>;


const getMonthlyTimesheets = ai.defineTool(
    {
        name: 'getMonthlyTimesheetsForEmployee',
        description: "Retrieves all of an employee's timesheets for a given month.",
        inputSchema: z.object({ employeeId: z.string(), period: z.string() }),
        outputSchema: z.array(z.custom<Timesheet>()),
    },
    async ({ employeeId, period }) => {
        const [year, month] = period.split('-').map(Number);
        const monthStart = startOfMonth(new Date(year, month - 1));
        const monthEnd = endOfMonth(new Date(year, month - 1));
        
        const q = query(
            collection(db, "timesheets"), 
            where("userId", "==", employeeId),
            where("weekStartDate", ">=", monthStart.toISOString()),
            where("weekStartDate", "<=", monthEnd.toISOString()),
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as Timesheet);
    }
);

const getEngagementsForEmployee = ai.defineTool(
    {
        name: 'getEngagementsForEmployee',
        description: "Retrieves all engagements an employee worked on during a period.",
        inputSchema: z.object({ employeeId: z.string() }),
        outputSchema: z.array(z.custom<Engagement & { engagementTypeName?: string }>()),
    },
     async ({ employeeId }) => {
        const q = query(collection(db, "engagements"), where("assignedTo", "array-contains", employeeId));
        const engagementSnapshot = await getDocs(q);
        const engagements = engagementSnapshot.docs.map(doc => doc.data() as Engagement);
        
        const typeIds = [...new Set(engagements.map(e => e.type))];
        if(typeIds.length === 0) return engagements;

        const typeSnapshot = await getDocs(query(collection(db, "engagementTypes"), where("id", "in", typeIds)));
        const typeMap = new Map(typeSnapshot.docs.map(d => [d.id, d.data().name]));

        return engagements.map(e => ({...e, engagementTypeName: typeMap.get(e.type) || ''}));
    }
);

const performanceReviewPrompt = ai.definePrompt({
    name: 'performanceReviewPrompt',
    input: { schema: z.object({
        employee: z.custom<Employee>(),
        department: z.custom<Department>(),
        timesheets: z.array(z.custom<Timesheet>()),
        engagements: z.array(z.custom<Engagement & {engagementTypeName?: string}>()),
    })},
    output: { schema: PerformanceReviewOutputSchema },
    tools: [getMonthlyTimesheets, getEngagementsForEmployee],
    prompt: `You are an expert HR and Performance Analyst for a CA firm.
    Your task is to analyze an employee's monthly performance based on their timesheets and engagement data.

    **Employee Details:**
    - Name: {{{employee.name}}}
    - Department: {{{department.name}}}
    - Monthly Target Hours: {{{multiply department.standardWeeklyHours 4}}}

    **Instructions:**
    1.  Calculate the total hours logged by the employee across all provided timesheets.
    2.  Compare the total logged hours against their monthly target. If logged hours are less than the target, calculate the deficit.
    3.  For each engagement the employee worked on, compare the logged hours against the budgeted hours (use 'budgetedHours' if available, otherwise use standard engagement type hours).
    4.  Identify any engagement where logged hours exceed budgeted hours by more than 5 hours. List these as overruns.
    5.  Generate a concise, professional summary of your findings. Mention the key issues (e.g., "significant hour deficit", "budget overrun on 2 projects").
    
    **DATA:**
    Timesheets:
    {{#each timesheets}}
    - Week of {{weekStartDate}}: {{totalHours}} hours
        {{#each entries}}
        - Engagement: {{engagementId}}, Hours: {{hours}}
        {{/each}}
    {{/each}}
    
    Engagements:
    {{#each engagements}}
    - ID: {{id}}, Name: {{remarks}}, Budget: {{budgetedHours}}
    {{/each}}
    
    Produce a JSON object strictly adhering to the output schema.
  `,
});

// Main Flow
const handlePerformanceReviewFlow = ai.defineFlow(
  {
    name: 'handlePerformanceReviewFlow',
    inputSchema: HandlePerformanceReviewInputSchema,
    outputSchema: PerformanceReviewOutputSchema,
  },
  async ({ employeeId, period, reviewerId }) => {
    
    // 1. Fetch all data
    const employeeDoc = await getDoc(doc(db, "employees", employeeId));
    if (!employeeDoc.exists()) throw new Error("Employee not found");
    const employee = employeeDoc.data() as Employee;
    
    const departmentQuery = query(collection(db, "departments"), where("name", "==", employee.role[0]));
    const deptSnapshot = await getDocs(departmentQuery);
    if(deptSnapshot.empty) throw new Error(`Department '${employee.role[0]}' not found`);
    const department = deptSnapshot.docs[0].data() as Department;

    const timesheets = await getMonthlyTimesheets({ employeeId, period });
    const engagements = await getEngagementsForEmployee({ employeeId });
    
    // 2. Call the LLM to analyze
    const llmResponse = await performanceReviewPrompt({
        employee,
        department,
        timesheets,
        engagements
    });

    const output = llmResponse.output();
    if (!output) {
      throw new Error("The AI model failed to produce a valid performance review.");
    }
    
    // 3. Create a To-Do for the partner
    const partnerId = employee.managerId || 'S001'; // Default to Tonny if no manager
    const todoRef = doc(collection(db, "todos"));
    const newTodo: Todo = {
        id: todoRef.id,
        type: "PERFORMANCE_REVIEW",
        text: `Review performance for ${employee.name} for ${format(new Date(period), 'MMMM yyyy')}. Issues: ${output.summary}`,
        createdBy: reviewerId,
        assignedTo: [partnerId],
        isCompleted: false,
        createdAt: new Date().toISOString(),
        relatedEntity: {
            type: 'client', // No 'employee' type, so using client as a placeholder
            id: employee.id,
        }
    };
    await setDoc(todoRef, newTodo);

    return output;
  }
);


export async function handlePerformanceReview(input: HandlePerformanceReviewInput): Promise<PerformanceReviewOutput> {
  return handlePerformanceReviewFlow(input);
}
