
'use server';
/**
 * @fileOverview An AI flow for processing incoming client emails.
 *
 * - processEmail - A function that analyzes an email, links it to a client,
 *   summarizes it, and determines the intended audience.
 * - ProcessEmailInput - The input type for the processEmail function.
 * - ProcessEmailOutput - The return type for the processEmail function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Client, Employee, Engagement } from '@/lib/data';


// Schema Definitions
const ProcessEmailInputSchema = z.object({
  from: z.string().email().describe("The sender's email address."),
  subject: z.string().describe("The subject line of the email."),
  body: z.string().describe("The full body content of the email."),
});
export type ProcessEmailInput = z.infer<typeof ProcessEmailInputSchema>;

const ProcessEmailOutputSchema = z.object({
  clientId: z.string().optional().describe("The ID of the client linked to this email, if found."),
  clientName: z.string().optional().describe("The name of the client linked to this email, if found."),
  summary: z.string().describe("A concise summary of the email's content."),
  category: z.enum(["Query", "Document Submission", "Follow-up", "Appreciation", "Urgent", "General"]).describe("The category of the email."),
  actionItems: z.array(z.string()).describe("A list of clear, actionable items derived from the email."),
  visibleTo: z.array(z.string()).describe("A list of employee IDs who should see this email."),
});
export type ProcessEmailOutput = z.infer<typeof ProcessEmailOutputSchema>;


// Tool Definition to find client and their team by email
const getClientAndTeamByEmail = ai.defineTool(
    {
        name: 'getClientAndTeamByEmail',
        description: 'Finds a client by their email address and retrieves the IDs of the partner, manager, and all employees assigned to their active engagements.',
        inputSchema: z.object({ email: z.string().email() }),
        outputSchema: z.object({
            client: z.custom<Client>(),
            teamMemberIds: z.array(z.string()),
        }).optional(),
    },
    async ({ email }) => {
        const clientsRef = collection(db, "clients");
        const q = query(clientsRef, where("mailId", "==", email));
        const clientSnapshot = await getDocs(q);

        if (clientSnapshot.empty) {
            return undefined;
        }

        const client = { id: clientSnapshot.docs[0].id, ...clientSnapshot.docs[0].data() } as Client;
        const teamMemberIds = new Set<string>();

        if (client.partnerId) {
            teamMemberIds.add(client.partnerId);
        }

        const engagementsRef = collection(db, "engagements");
        const engagementsQuery = query(engagementsRef, where("clientId", "==", client.id));
        const engagementSnapshot = await getDocs(engagementsQuery);

        engagementSnapshot.forEach(doc => {
            const engagement = doc.data() as Engagement;
            if (engagement.reportedTo) {
                teamMemberIds.add(engagement.reportedTo);
            }
            engagement.assignedTo.forEach(id => teamMemberIds.add(id));
        });
        
        return { client, teamMemberIds: Array.from(teamMemberIds) };
    }
);


// Genkit Prompt
const emailProcessorPrompt = ai.definePrompt({
    name: 'emailProcessorPrompt',
    input: { schema: ProcessEmailInputSchema },
    output: { schema: ProcessEmailOutputSchema },
    tools: [getClientAndTeamByEmail],
    prompt: `You are an intelligent assistant for a firm of Chartered Accountants.
    Your task is to process an incoming email, analyze its content, and prepare a structured output.

    Email Details:
    From: {{from}}
    Subject: {{{subject}}}
    Body:
    {{{body}}}

    Instructions:
    1.  Use the getClientAndTeamByEmail tool to find the client associated with the sender's email address.
    2.  If a client is found, extract their ID, name, and the list of team members (visibleTo).
    3.  If no client is found, the 'visibleTo' list should contain only the ID of the main partner ('S001') as a fallback for manual assignment. **Crucially, if no client is found, you MUST OMIT the 'clientId' and 'clientName' fields from the JSON output.**
    4.  Read the email body and subject carefully.
    5.  Summarize the email's content concisely.
    6.  Categorize the email based on its content into one of the following: "Query", "Document Submission", "Follow-up", "Appreciation", "Urgent", "General".
    7.  Extract any clear action items for the team. If there are no specific actions, provide an empty array.
    
    Produce a JSON object that strictly adheres to the output schema.
  `,
});


// Main Flow
const processEmailFlow = ai.defineFlow(
  {
    name: 'processEmailFlow',
    inputSchema: ProcessEmailInputSchema,
    outputSchema: ProcessEmailOutputSchema,
  },
  async (input) => {
    const llmResponse = await emailProcessorPrompt(input);
    const output = llmResponse.output();

    if (!output) {
      throw new Error("The AI model failed to produce a valid output.");
    }
    
    // If visibleTo is empty (client not found), assign to default partner
    if (!output.visibleTo || output.visibleTo.length === 0) {
        output.visibleTo = ['S001']; // Default to Tonny Varghese
    }

    return output;
  }
);


export async function processEmail(input: ProcessEmailInput): Promise<ProcessEmailOutput> {
  return processEmailFlow(input);
}
