
'use server';
/**
 * @fileOverview A flow for generating templated emails to clients.
 *
 * - generateEmail - A function that generates an email based on a template name and client.
 * - GenerateEmailInput - The input type for the generateEmail function.
 * - GenerateEmailOutput - The return type for the generateEmail function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { collection, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Client, Firm, Employee } from '@/lib/data';

// Schema Definitions
const EMAIL_TEMPLATES = [
    "New Client Onboarding",
    "Engagement Letter - Audit",
    "Recurring Service Agreement",
    "Fee Revision Approval"
] as const;

export const GenerateEmailInputSchema = z.object({
  templateName: z.enum(EMAIL_TEMPLATES).describe("The name of the email template to use."),
  clientId: z.string().describe("The ID of the client to whom the email is addressed."),
  userId: z.string().describe("The ID of the employee sending the email (usually the partner)."),
});
export type GenerateEmailInput = z.infer<typeof GenerateEmailInputSchema>;

const GenerateEmailOutputSchema = z.object({
  subject: z.string().describe("The generated subject line for the email."),
  body: z.string().describe("The generated body content for the email."),
});
export type GenerateEmailOutput = z.infer<typeof GenerateEmailOutputSchema>;


const getClientAndFirm = ai.defineTool(
    {
        name: 'getClientAndFirmDetails',
        description: 'Retrieves details for a specific client and their associated firm.',
        inputSchema: z.object({ clientId: z.string() }),
        outputSchema: z.object({
            client: z.custom<Client>(),
            firm: z.custom<Firm>(),
        }).optional(),
    },
    async ({ clientId }) => {
        const clientDoc = await getDoc(doc(db, "clients", clientId));
        if (!clientDoc.exists()) return undefined;

        const client = clientDoc.data() as Client;
        
        const firmDoc = await getDoc(doc(db, "firms", client.firmId));
        if (!firmDoc.exists()) return { client, firm: {} as Firm };

        const firm = firmDoc.data() as Firm;

        return { client, firm };
    }
);


const emailGeneratorPrompt = ai.definePrompt({
  name: 'emailGeneratorPrompt',
  input: { schema: z.object({
    templateName: z.string(),
    client: z.any(),
    firm: z.any(),
    partner: z.any(),
  })},
  output: { schema: GenerateEmailOutputSchema },
  tools: [getClientAndFirm],
  prompt: `You are an expert administrative assistant at a Chartered Accountancy firm.
  Your task is to generate a professional email to a client based on a specified template.
  
  **INSTRUCTIONS**
  1. Use the provided Client, Firm, and Partner details to personalize the email.
  2. The email body should be in plain text, with line breaks for paragraphs. Do not use HTML or Markdown.
  3. Adhere strictly to the tone and content required for the specified template.
  4. Ensure the partner's name and the firm's name are included in the signature.
  
  **DETAILS**
  - **Template to Use:** {{{templateName}}}
  - **Client Name:** {{{client.Name}}}
  - **Client Contact Person:** {{{client.Contact Person}}}
  - **Firm Name:** {{{firm.name}}}
  - **Partner Name:** {{{partner.name}}}
  - **Partner Designation:** {{{partner.designation}}}
  
  **EMAIL TEMPLATES**
  
  *   **If Template is "New Client Onboarding":**
      *   **Subject:** Welcome to [Firm Name]!
      *   **Body:** Write a warm welcome email. Thank the client for choosing the firm. Mention that you are excited to work with them and that the partner is their main point of contact.
  
  *   **If Template is "Engagement Letter - Audit":**
      *   **Subject:** Engagement Letter for Statutory Audit of [Client Name]
      *   **Body:** Write a formal email attaching an engagement letter for the audit. State the financial year for the audit. Ask the client to review, sign, and return the letter at their earliest convenience.
  
  *   **If Template is "Recurring Service Agreement":**
      *   **Subject:** Agreement for [Service Name, e.g., GST Filing] Services - [Client Name]
      *   **Body:** Write a formal email for a recurring service agreement. Specify the service name. Mention that the agreement outlines the scope, responsibilities, and fees. Ask them to review and confirm their acceptance.
  
  *   **If Template is "Fee Revision Approval":**
      *   **Subject:** Important Update: Revision of Professional Fees for [Service Name]
      *   **Body:** Write a formal email notifying the client of a fee revision for a recurring service. State the old and new fees clearly. Express appreciation for their business and provide a reason for the adjustment (e.g., "to continue providing high-quality service").
  
  Now, generate the JSON output for the email based on the template: **{{{templateName}}}**
  `,
});


const generateEmailFlow = ai.defineFlow(
  {
    name: 'generateEmailFlow',
    inputSchema: GenerateEmailInputSchema,
    outputSchema: GenerateEmailOutputSchema,
  },
  async (input) => {
    
    const clientDoc = await getDoc(doc(db, "clients", input.clientId));
    if (!clientDoc.exists()) throw new Error("Client not found.");
    const client = clientDoc.data() as Client;

    const firmDoc = await getDoc(doc(db, "firms", client.firmId));
    if (!firmDoc.exists()) throw new Error("Firm not found.");
    const firm = firmDoc.data() as Firm;
    
    const partnerDoc = await getDoc(doc(db, "employees", input.userId));
     if (!partnerDoc.exists()) throw new Error("Partner not found.");
    const partner = partnerDoc.data() as Employee;

    const llmResponse = await emailGeneratorPrompt({
        templateName: input.templateName,
        client: client,
        firm: firm,
        partner: partner
    });
    
    const output = llmResponse.output();
    if (!output) {
      throw new Error("The AI model failed to produce a valid email.");
    }
    
    return output;
  }
);


export async function generateEmail(input: GenerateEmailInput): Promise<GenerateEmailOutput> {
  return generateEmailFlow(input);
}
