
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Workshop, Employee, LearningLog } from "@/lib/data";
import { format, isPast } from "date-fns";
import { Calendar, Clock, PlusCircle, User, Users } from "lucide-react";
import { CreateWorkshopDialog } from "./create-workshop-dialog";
import { doc, updateDoc, arrayUnion, collection, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

interface WorkshopListProps {
  workshops: Workshop[];
  allEmployees: Employee[];
  currentUser: Employee | null;
}

export function WorkshopList({ workshops, allEmployees, currentUser }: WorkshopListProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const { toast } = useToast();

  const handleAttend = async (workshop: Workshop) => {
      if (!currentUser) return;
      
      const workshopRef = doc(db, "workshops", workshop.id);
      const learningLogRef = doc(collection(db, "learningLogs"));
      
      try {
          const batch = db.batch();
          
          // Add user to attendee list
          batch.update(workshopRef, {
              attendeeIds: arrayUnion(currentUser.id)
          });
          
          // Create corresponding learning log
          const newLog: LearningLog = {
              id: learningLogRef.id,
              userId: currentUser.id,
              date: workshop.scheduledAt,
              durationHours: workshop.durationHours,
              area: workshop.area,
              topic: workshop.topic,
              description: `Attended workshop by ${workshop.speaker}.`,
              workshopId: workshop.id,
          };
          batch.set(learningLogRef, newLog);

          await batch.commit();

          toast({ title: "Success", description: `You have been marked as attending and your learning log has been updated.`});
      } catch (error) {
          console.error("Error marking attendance:", error);
          toast({ title: "Error", description: "Could not mark attendance.", variant: "destructive"});
      }
  }

  const upcomingWorkshops = workshops.filter(w => !isPast(new Date(w.scheduledAt))).sort((a,b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const pastWorkshops = workshops.filter(w => isPast(new Date(w.scheduledAt))).sort((a,b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

  const canCreate = currentUser?.role.includes("Admin") || currentUser?.role.includes("Partner");

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Workshops</CardTitle>
            <CardDescription>Upcoming and past learning sessions.</CardDescription>
          </div>
          {canCreate && (
            <Button onClick={() => setIsDialogOpen(true)}>
                <PlusCircle className="mr-2"/>
                Create Workshop
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-4">Upcoming Workshops</h3>
                {upcomingWorkshops.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {upcomingWorkshops.map(workshop => {
                            const isInvited = workshop.invitedIds.includes(currentUser?.id || '');
                            const isAttending = workshop.attendeeIds.includes(currentUser?.id || '');
                            return (
                                <Card key={workshop.id} className="flex flex-col">
                                    <CardHeader>
                                        <CardTitle className="text-base">{workshop.topic}</CardTitle>
                                        <CardDescription>{workshop.area}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm text-muted-foreground flex-grow">
                                        <div className="flex items-center gap-2"><User/><span>{workshop.speaker}</span></div>
                                        <div className="flex items-center gap-2"><Calendar/><span>{format(new Date(workshop.scheduledAt), "eee, dd MMM yyyy 'at' p")}</span></div>
                                        <div className="flex items-center gap-2"><Clock/><span>{workshop.durationHours} hour(s)</span></div>
                                        <div className="flex items-center gap-2"><Users/><span>{workshop.attendeeIds.length} attending</span></div>
                                    </CardContent>
                                    <CardContent className="p-4">
                                        {isInvited && (
                                            <Button className="w-full" onClick={() => handleAttend(workshop)} disabled={isAttending}>
                                                {isAttending ? "Attending" : "Mark Attendance"}
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                ) : (
                    <p className="text-muted-foreground text-sm">No upcoming workshops scheduled.</p>
                )}
            </div>
             <div>
                <h3 className="text-lg font-semibold mb-4">Past Workshops</h3>
                {pastWorkshops.length > 0 ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pastWorkshops.map(workshop => (
                             <Card key={workshop.id} className="opacity-70">
                                <CardHeader>
                                    <CardTitle className="text-base">{workshop.topic}</CardTitle>
                                    <CardDescription>{workshop.area}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2"><User/><span>{workshop.speaker}</span></div>
                                    <div className="flex items-center gap-2"><Calendar/><span>{format(new Date(workshop.scheduledAt), "dd MMM yyyy")}</span></div>
                                    <div className="flex items-center gap-2"><Users/><span>{workshop.attendeeIds.length} attended</span></div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                     <p className="text-muted-foreground text-sm">No past workshops to show.</p>
                )}
            </div>
        </CardContent>
      </Card>
      {canCreate && (
         <CreateWorkshopDialog
            isOpen={isDialogOpen}
            onClose={() => setIsDialogOpen(false)}
            allEmployees={allEmployees}
            currentUser={currentUser}
        />
      )}
    </>
  );
}
