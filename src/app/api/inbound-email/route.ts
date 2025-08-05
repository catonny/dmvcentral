
import { processEmail } from '@/ai/flows/process-email-flow';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { from, subject, body } = await request.json();

    if (!from || !subject || !body) {
      return NextResponse.json({ message: 'Missing required fields: from, subject, body' }, { status: 400 });
    }

    // Do not await this. We want to send a success response back to the webhook provider immediately
    // and let the AI process the email in the background.
    processEmail({ from, subject, body }).catch(console.error);

    // Return a 200 OK response to acknowledge receipt of the webhook
    return NextResponse.json({ message: 'Email received and is being processed.' }, { status: 200 });

  } catch (error) {
    console.error('Error in inbound-email webhook:', error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ message: 'Invalid JSON payload' }, { status: 400 });
    }
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}
