'use server';
/**
 * @fileOverview An AI flow for generating an HTML invoice for a completed engagement.
 *
 * - generateInvoice - A function that takes an engagement ID and returns structured invoice data.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Engagement, Client, Firm } from '@/lib/data';
import { format } from 'date-fns';

// Schema Definitions
const GenerateInvoiceInputSchema = z.object({
  engagementId: z.string().describe("The ID of the engagement to create an invoice for."),
});
export type GenerateInvoiceInput = z.infer<typeof GenerateInvoiceInputSchema>;

const GenerateInvoiceOutputSchema = z.object({
  htmlContent: z.string().describe("The full HTML content of the invoice."),
  recipientEmail: z.string().email().describe("The client's email address."),
  subject: z.string().describe("The subject line for the invoice email."),
});
export type GenerateInvoiceOutput = z.infer<typeof GenerateInvoiceOutputSchema>;


// Tool to get all necessary data for an invoice
const getInvoiceData = ai.defineTool(
    {
        name: 'getInvoiceData',
        description: "Retrieves all necessary data for building an invoice from an engagement ID.",
        inputSchema: z.object({ engagementId: z.string() }),
        outputSchema: z.object({
            engagement: z.custom<Engagement>(),
            client: z.custom<Client>(),
            firm: z.custom<Firm>(),
        }).optional(),
    },
    async ({ engagementId }) => {
        const engagementDoc = await getDoc(doc(db, "engagements", engagementId));
        if (!engagementDoc.exists()) return undefined;
        const engagement = engagementDoc.data() as Engagement;

        const clientDoc = await getDoc(doc(db, "clients", engagement.clientId));
        if (!clientDoc.exists()) return undefined;
        const client = clientDoc.data() as Client;

        const firmDoc = await getDoc(doc(db, "firms", client.firmId));
        if (!firmDoc.exists()) return undefined;
        const firm = firmDoc.data() as Firm;

        return { engagement, client, firm };
    }
);


// Genkit Prompt
const invoiceGeneratorPrompt = ai.definePrompt({
  name: 'invoiceGeneratorPrompt',
  input: { schema: z.object({
      engagement: z.custom<Engagement>(),
      client: z.custom<Client>(),
      firm: z.custom<Firm>(),
      currentDate: z.string(),
      invoiceNumber: z.string(),
  })},
  output: { schema: GenerateInvoiceOutputSchema },
  tools: [getInvoiceData],
  prompt: `You are an expert accountant responsible for generating professional invoices.
  Your task is to create a well-formatted, professional HTML invoice based on the provided data.

  **INSTRUCTIONS:**
  1. Use the provided Client, Firm, and Engagement details to populate the invoice.
  2. The invoice should be a complete HTML document, styled with inline CSS for maximum email client compatibility. Use a clean, professional, two-column layout.
  3. The "Bill To" section must contain the client's name and address.
  4. The invoice table must list the engagement remarks as the line item and the engagement fees as the amount.
  5. The subject line for the email should be "Invoice from [Firm Name] - [Invoice Number]".
  6. The recipient's email is the client's email address.
  
  **INVOICE DETAILS:**
  - **Firm Name:** {{{firm.name}}}
  - **Firm Address:** {{{firm.billingAddressLine1}}}, {{{firm.billingAddressLine2}}}, {{{firm.billingAddressLine3}}}
  - **Firm PAN:** {{{firm.pan}}}
  - **Firm GSTN:** {{{firm.gstn}}}
  
  - **Client Name:** {{{client.Name}}}
  - **Client Address:** {{{client.billingAddressLine1}}}, {{{client.billingAddressLine2}}}, {{{client.billingAddressLine3}}}
  
  - **Invoice Number:** {{{invoiceNumber}}}
  - **Invoice Date:** {{{currentDate}}}
  - **Due Date:** {{{engagement.dueDate}}}
  
  - **Engagement Description:** {{{engagement.remarks}}}
  - **Amount:** {{{engagement.fees}}}

  Now, generate the JSON output for the invoice.
  `,
});


// Main Flow
const generateInvoiceFlow = ai.defineFlow(
  {
    name: 'generateInvoiceFlow',
    inputSchema: GenerateInvoiceInputSchema,
    outputSchema: GenerateInvoiceOutputSchema,
  },
  async ({ engagementId }) => {
    // 1. Fetch data using the tool
    const data = await getInvoiceData({ engagementId });
    if (!data) {
        throw new Error("Could not retrieve necessary data to generate the invoice.");
    }
    const { engagement, client, firm } = data;
    if (!client.mailId || client.mailId === 'unassigned') {
        throw new Error("Client does not have a valid email address.");
    }

    // 2. Generate a simple invoice number
    const invoiceNumber = `INV-${new Date().getFullYear()}-${engagement.id.slice(0, 5).toUpperCase()}`;

    // 3. Call the LLM to generate the HTML
    const llmResponse = await invoiceGeneratorPrompt({
        engagement,
        client,
        firm,
        currentDate: format(new Date(), "dd MMM, yyyy"),
        invoiceNumber,
    });
    
    const output = llmResponse.output();
    if (!output) {
      throw new Error("The AI model failed to produce a valid invoice.");
    }

    // Ensure the recipient email is correctly set from the client data
    output.recipientEmail = client.mailId;
    
    return output;
  }
);


export async function generateInvoice(input: GenerateInvoiceInput): Promise<GenerateInvoiceOutput> {
  return generateInvoiceFlow(input);
}
