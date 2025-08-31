
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { processEmail } from "@/ai/flows/process-email-flow";
import type { ProcessEmailOutput } from "@/ai/flows/process-email-flow";

export default function ManualEmailProcessorPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [from, setFrom] = React.useState("");
    const [subject, setSubject] = React.useState("");
    const [body, setBody] = React.useState("");
    const [result, setResult] = React.useState<ProcessEmailOutput | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);

    const handleProcessEmail = async () => {
        if (!from || !subject || !body) {
            toast({
                title: "Missing Information",
                description: "Please fill out all fields.",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);
        setResult(null);

        try {
            // const output = await processEmail({ from, subject, body });
            // setResult(output);
            toast({
                title: "AI Processing Disabled",
                description: "The AI email processor is temporarily disabled.",
                variant: "destructive"
            });
        } catch (error) {
            console.error("Error processing email:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({
                title: "Processing Failed",
                description: errorMessage,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleReset = () => {
        setFrom("");
        setSubject("");
        setBody("");
        setResult(null);
    }

    return (
        <div className="space-y-6">
            <Button variant="outline" size="sm" onClick={() => router.push('/administration')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Administration
            </Button>
            <Card>
                <CardHeader>
                    <CardTitle>Manual Email Processor</CardTitle>
                    <CardDescription>
                        Paste the raw details of an email to have the AI analyze, summarize, and categorize it.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="from">From Email</Label>
                            <Input id="from" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="sender@example.com"/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="subject">Subject</Label>
                            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject line"/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="body">Body</Label>
                            <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Paste the full email body here." rows={10}/>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleProcessEmail} disabled={isLoading || true}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    "Process Email (Disabled)"
                                )}
                            </Button>
                            <Button variant="outline" onClick={handleReset}>
                                Reset
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <Label>AI Analysis Result</Label>
                        <div className="h-full w-full rounded-md border bg-muted p-4 overflow-auto">
                            {result ? (
                                <pre className="text-sm whitespace-pre-wrap">
                                    {JSON.stringify(result, null, 2)}
                                </pre>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    <p>AI processing is disabled.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
