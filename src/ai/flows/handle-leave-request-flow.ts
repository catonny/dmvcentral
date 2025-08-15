
'use server';
/**
 * @fileOverview An AI flow for handling the operational impact of an approved leave request.
 * It identifies calendar conflicts and suggests replacement colleagues.
 *
 * - handleLeaveRequest - A function that orchestrates the process.
 * - HandleLeaveRequestInput - The input type for the function.
 * - HandleLeaveRequestOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CalendarEvent, Engagement, Employee, Todo } from '@/lib/data';


// Schema Definitions
const HandleLeaveRequestInputSchema = z.object({
  leaveRequestId: z.string().describe("The ID of the approved leave request."),
});
export type HandleLeaveRequestInput = z.infer<typeof HandleLeaveRequestInputSchema>;

const HandleLeaveRequestOutputSchema = z.object({
  plan: z.array(z.object({
      conflictingEventId: z.string(),
      conflictingEventTitle: z.string(),
      engagementId: z.string().optional(),
      suggestedReplacementId: z.string().optional(),
      reasoning: z.string(),
  })).describe("An array of action plans for each conflicting event."),
});
export type HandleLeaveRequestOutput = z.infer<typeof HandleLeaveRequestOutputSchema>;


// Tool: Find conflicting calendar events for an employee
const getConflictingEvents = ai.defineTool(
    {
        name: 'getConflictingEvents',
        description: 'Finds calendar events that an employee is attending during their leave period.',
        inputSchema: z.object({
            employeeId: z.string(),
            startDate: z.string().describe("Leave start date in ISO format."),
            endDate: z.string().describe("Leave end date in ISO format."),
        }),
        outputSchema: z.array(z.custom<CalendarEvent>()),
    },
    async ({ employeeId, startDate, endDate }) => {
        const eventsRef = collection(db, "events");
        const q = query(eventsRef,
            where("attendees", "array-contains", employeeId),
            where("start", ">=", startDate),
            where("start", "<=", endDate)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as CalendarEvent);
    }
);

// Tool: Find colleagues on the same engagement
const findReplacementColleagues = ai.defineTool(
    {
        name: 'findReplacementColleagues',
        description: 'Finds other employees assigned to the same engagement, excluding the employee on leave.',
        inputSchema: z.object({
            engagementId: z.string(),
            employeeOnLeaveId: z.string(),
        }),
        outputSchema: z.array(z.custom<Employee>()),
    },
    async ({ engagementId, employeeOnLeaveId }) => {
        const engagementDoc = await getDoc(doc(db, "engagements", engagementId));
        if (!engagementDoc.exists()) return [];

        const engagement = engagementDoc.data() as Engagement;
        const colleagueIds = engagement.assignedTo.filter(id => id !== employeeOnLeaveId);
        
        if (colleagueIds.length === 0) return [];
        
        const colleaguesQuery = query(collection(db, "employees"), where("id", "in", colleagueIds));
        const snapshot = await getDocs(colleaguesQuery);
        return snapshot.docs.map(doc => doc.data() as Employee);
    }
);


// Genkit Prompt
const leaveHandlerPrompt = ai.definePrompt({
    name: 'leaveHandlerPrompt',
    input: { schema: z.object({
        leaveRequest: z.any(),
        employee: z.any(),
    }) },
    output: { schema: HandleLeaveRequestOutputSchema },
    tools: [getConflictingEvents, findReplacementColleagues],
    prompt: `You are an intelligent HR assistant for a firm of Chartered Accountants.
    An employee's leave request has been approved. Your task is to find conflicts and suggest solutions.

    Leave Details:
    Employee: {{{employee.name}}} (ID: {{{employee.id}}})
    Start Date: {{{leaveRequest.startDate}}}
    End Date: {{{leaveRequest.endDate}}}

    Instructions:
    1.  Use the getConflictingEvents tool to find all meetings for this employee during their leave.
    2.  For each conflicting event, check if it's linked to an engagement.
    3.  If an event is linked to an engagement, use the findReplacementColleagues tool to find other team members on that same engagement.
    4.  Suggest the most senior available colleague (e.g., Manager over Employee) as the replacement. If no colleagues are on the engagement, state that.
    5.  If an event is NOT linked to an engagement, state that it's a personal or general event and no replacement can be suggested.
    6.  Compile a 'plan' of all conflicting events, your suggested replacement (if any), and your reasoning.
    
    Produce a JSON object that strictly adheres to the output schema.
  `,
});


// Main Flow
const handleLeaveRequestFlow = ai.defineFlow(
  {
    name: 'handleLeaveRequestFlow',
    inputSchema: HandleLeaveRequestInputSchema,
    outputSchema: HandleLeaveRequestOutputSchema,
  },
  async ({ leaveRequestId }) => {
    const leaveRequestDoc = await getDoc(doc(db, "leaveRequests", leaveRequestId));
    if (!leaveRequestDoc.exists()) throw new Error("Leave request not found.");
    const leaveRequest = leaveRequestDoc.data();

    const employeeDoc = await getDoc(doc(db, "employees", leaveRequest.employeeId));
    if (!employeeDoc.exists()) throw new Error("Employee not found.");
    const employee = employeeDoc.data();
    
    const llmResponse = await leaveHandlerPrompt({ leaveRequest, employee });
    
    const output = llmResponse.output();
    if (!output) {
      throw new Error("The AI model failed to produce a valid plan.");
    }
    
    // Create To-Do items for suggested replacements
    for (const item of output.plan) {
        if (item.suggestedReplacementId && item.engagementId) {
             const todoRef = doc(collection(db, "todos"));
             const engagementDoc = await getDoc(doc(db, "engagements", item.engagementId));
             const engagementRemarks = engagementDoc.exists() ? engagementDoc.data().remarks : "an engagement";

             const newTodo: Todo = {
                id: todoRef.id,
                type: "GENERAL_TASK",
                text: `Cover for ${employee.name} on "${engagementRemarks}" due to their leave. Reason: ${item.reasoning}`,
                createdBy: "system", // System-generated
                assignedTo: [item.suggestedReplacementId],
                isCompleted: false,
                createdAt: new Date().toISOString(),
                relatedEntity: {
                    type: 'engagement',
                    id: item.engagementId,
                }
            };
            await setDoc(todoRef, newTodo);
        }
    }
    
    return output;
  }
);


export async function handleLeaveRequest(input: HandleLeaveRequestInput): Promise<HandleLeaveRequestOutput> {
  return handleLeaveRequestFlow(input);
}
