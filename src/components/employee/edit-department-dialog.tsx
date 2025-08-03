
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Department } from "@/lib/data";

interface EditDepartmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { id?: string; name: string }) => Promise<void>;
  department: Department | null;
}

export function EditDepartmentDialog({ isOpen, onClose, onSave, department }: EditDepartmentDialogProps) {
  const [name, setName] = React.useState("");

  React.useEffect(() => {
    if (isOpen) {
      setName(department?.name || "");
    }
  }, [department, isOpen]);

  const handleSave = () => {
    if (name) {
      onSave({ id: department?.id, name });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{department ? "Edit Department" : "Add Department"}</DialogTitle>
          <DialogDescription>
            {department ? "Rename the department." : "Create a new department for your employees."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
