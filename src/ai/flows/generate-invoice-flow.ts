
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
  1.  **Strictly adhere to the provided HTML template.** Do not change the structure, classes, or styles.
  2.  Use the provided Firm, Client, and Engagement details to populate the invoice placeholders.
  3.  The main service line item will be the engagement remarks and the rate will be the engagement fees. Quantity is 1.
  4.  Assume a placeholder HSN/SAC code of "998314" for professional services.
  5.  Assume a CGST and SGST rate of 9% each (total 18% GST). Calculate the CGST and SGST amounts based on the engagement fees.
  6.  Calculate the Sub Total, CGST, SGST, and Total amount.
  7.  The recipient's email is the client's email address.
  8.  The subject line for the email should be "Invoice from [Firm Name] - [Invoice Number]".
  9.  For the "Total in Words", convert the total amount into Indian English words (e.g., "Indian Rupee Seven Hundred Five and Sixty Paise Only").
  10. "Payment Made" and "Balance Due" should be "0.00" unless specified otherwise.

  **DATA:**
  - **Firm Name:** {{{firm.name}}}
  - **Firm Address:** {{{firm.billingAddressLine1}}}, {{{firm.billingAddressLine2}}}, {{{firm.billingAddressLine3}}}
  - **Firm GSTN:** {{{firm.gstn}}}
  - **Client Name:** {{{client.Name}}}
  - **Client Address:** {{{client.billingAddressLine1}}}, {{{client.billingAddressLine2}}}, {{{client.billingAddressLine3}}}
  - **Client GSTN:** {{{client.gstin}}}
  - **Client State:** {{{client.State}}}
  - **Invoice Number:** {{{invoiceNumber}}}
  - **Invoice Date:** {{{currentDate}}}
  - **Due Date:** {{{currentDate}}}
  - **Engagement Description:** {{{engagement.remarks}}}
  - **Amount:** {{{engagement.fees}}}

  **HTML TEMPLATE:**
  \`\`\`html
  <!DOCTYPE html>
  <html>
  <head>
      <title>Invoice</title>
      <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333; }
          .container { max-width: 800px; margin: auto; padding: 20px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, 0.15); }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
          .header .firm-details { text-align: left; }
          .header .invoice-title { text-align: right; }
          .addresses { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .addresses .address-block { width: 48%; }
          .address-block h4 { border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 5px; font-size: 14px; color: #555; }
          .invoice-info { display: flex; justify-content: space-between; border-top: 1px solid #eee; border-bottom: 1px solid #eee; padding: 10px 0; margin-bottom: 20px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #eee; padding: 8px; text-align: left; }
          th { background-color: #f9f9f9; font-size: 12px; }
          .totals { display: flex; justify-content: flex-end; margin-top: 20px; }
          .totals table { width: 40%; }
          .totals td { border: none; }
          .totals tr.total-row td { border-top: 2px solid #eee; font-weight: bold; }
          .footer { margin-top: 30px; font-size: 12px; }
      </style>
  </head>
  <body>
      <div class="container">
          <div class="header">
              <div class="firm-details">
                  <h3>{{{firm.name}}}</h3>
                  <p>{{{firm.billingAddressLine1}}}<br>{{{firm.billingAddressLine2}}}<br>{{{firm.billingAddressLine3}}}</p>
                  <p>GSTIN: {{{firm.gstn}}}</p>
              </div>
              <div class="invoice-title">
                  <h2>TAX INVOICE</h2>
                  <p><strong>Invoice#:</strong> {{{invoiceNumber}}}</p>
              </div>
          </div>
          <div class="addresses">
              <div class="address-block">
                  <h4>Bill To</h4>
                  <p><strong>{{{client.Name}}}</strong><br>{{{client.billingAddressLine1}}}<br>{{{client.billingAddressLine2}}}<br>{{{client.billingAddressLine3}}}</p>
                  <p>GSTIN: {{{client.gstin}}}</p>
              </div>
              <div class="address-block">
                  <h4>Ship To</h4>
                   <p><strong>{{{client.Name}}}</strong><br>{{{client.billingAddressLine1}}}<br>{{{client.billingAddressLine2}}}<br>{{{client.billingAddressLine3}}}</p>
                  <p>GSTIN: {{{client.gstin}}}</p>
              </div>
          </div>
           <p style="font-size: 12px; margin-bottom: 20px;"><strong>Place Of Supply:</strong> {{{client.State}}}</p>
          <div class="invoice-info">
              <div><strong>Invoice Date:</strong> {{{currentDate}}}</div>
              <div><strong>Terms:</strong> Due on Receipt</div>
              <div><strong>Due Date:</strong> {{{currentDate}}}</div>
          </div>
          <table>
              <thead>
                  <tr>
                      <th>#</th>
                      <th>Item & Description</th>
                      <th>HSN/SAC</th>
                      <th>Qty</th>
                      <th>Rate</th>
                      <th>CGST</th>
                      <th>SGST</th>
                      <th>Amount</th>
                  </tr>
              </thead>
              <tbody>
                  <tr>
                      <td>1</td>
                      <td>
                          <strong>{{{engagement.remarks}}}</strong>
                          <br>
                          <small>Professional services rendered.</small>
                      </td>
                      <td>998314</td>
                      <td>1.00</td>
                      <td>{{engagement.fees}}</td>
                      <td>{{#with (multiply (divide engagement.fees 100) 9)}}~{{this}}{{/with}}</td>
                      <td>{{#with (multiply (divide engagement.fees 100) 9)}}~{{this}}{{/with}}</td>
                      <td>{{engagement.fees}}</td>
                  </tr>
              </tbody>
          </table>
          <div class="totals">
              <table>
                  <tr>
                      <td>Sub Total</td>
                      <td style="text-align: right;">{{engagement.fees}}</td>
                  </tr>
                  <tr>
                      <td>CGST (9.00%)</td>
                      <td style="text-align: right;">{{#with (multiply (divide engagement.fees 100) 9)}}~{{this}}{{/with}}</td>
                  </tr>
                   <tr>
                      <td>SGST (9.00%)</td>
                      <td style="text-align: right;">{{#with (multiply (divide engagement.fees 100) 9)}}~{{this}}{{/with}}</td>
                  </tr>
                  <tr class="total-row">
                      <td>Total</td>
                      <td style="text-align: right;">₹{{#with (add engagement.fees (multiply (divide engagement.fees 100) 18))}}~{{this}}{{/with}}</td>
                  </tr>
                  <tr>
                      <td>Payment Made</td>
                      <td style="text-align: right;">(-) 0.00</td>
                  </tr>
                   <tr class="total-row">
                      <td>Balance Due</td>
                      <td style="text-align: right;">₹{{#with (add engagement.fees (multiply (divide engagement.fees 100) 18))}}~{{this}}{{/with}}</td>
                  </tr>
              </table>
          </div>
          <div class="footer">
              <p><strong>Total In Words:</strong> {{#toWords (add engagement.fees (multiply (divide engagement.fees 100) 18))}}{{/toWords}}</p>
              <br>
              <p><strong>Notes:</strong> Thanks for your business.</p>
              <br><br><br>
              <p><strong>CA {{{firm.name}}}</strong><br>Authorized Signature</p>
          </div>
      </div>
  </body>
  </html>
  \`\`\`

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
        currentDate: format(new Date(), "dd/MM/yyyy"),
        invoiceNumber,
    });
    
    const output = llmResponse.output;
    if (!output) {
      throw new Error("The AI model failed to produce a valid invoice.");
    }

    // Ensure the recipient email is correctly set from the client data
    output.recipientEmail = client.mailId;
    
    // Replace ~{{...}}~ with calculated values
    let finalHtml = output.htmlContent;
    const fee = engagement.fees || 0;
    const gst = fee * 0.09;
    const total = fee + gst * 2;
    
    finalHtml = finalHtml.replace(/~{{#with \(multiply \(divide engagement.fees 100\) 9\)}}~{{this}}{{\/with}}~/g, gst.toFixed(2));
    finalHtml = finalHtml.replace(/~{{#with \(add engagement.fees \(multiply \(divide engagement.fees 100\) 18\)\)}}~{{this}}{{\/with}}~/g, total.toFixed(2));
    finalHtml = finalHtml.replace(/{{#toWords \S+}}{{/toWords}}/, `Indian Rupee ${numberToWords(total)} Only`);


    output.htmlContent = finalHtml;

    return output;
  }
);

// Basic number to words converter
function numberToWords(num: number): string {
    const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

    const inWords = (n: number): string => {
        let str = '';
        if (n > 99) {
            str += a[Math.floor(n / 100)] + 'hundred ';
            n %= 100;
        }
        if (n > 19) {
            str += b[Math.floor(n / 10)] + ' ' + a[n % 10];
        } else {
            str += a[n];
        }
        return str;
    };
    
    const [integerPart, decimalPart] = num.toFixed(2).split('.').map(s => parseInt(s));
    let words = inWords(integerPart);
    if (decimalPart > 0) {
        words += 'and ' + inWords(decimalPart) + 'paise ';
    }
    return words.replace(/\s+/g, ' ').trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}


export async function generateInvoice(input: GenerateInvoiceInput): Promise<GenerateInvoiceOutput> {
  return generateInvoiceFlow(input);
}
