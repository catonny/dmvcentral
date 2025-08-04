
import { CheckCircle, CircleDashed, FileClock, CircleX, UserCheck, FileQuestion } from "lucide-react";

export const engagementStatuses = ["Pending", "Awaiting Documents", "In Process", "Partner Review", "Completed", "Cancelled"];

export const engagementStatusIcons = [
    {
        value: "Pending",
        label: "Pending",
        icon: FileClock,
    },
    {
        value: "Awaiting Documents",
        label: "Awaiting Documents",
        icon: FileQuestion,
    },
    {
        value: "In Process",
        label: "In Process",
        icon: CircleDashed,
    },
    {
        value: "Partner Review",
        label: "Partner Review",
        icon: UserCheck,
    },
    {
        value: "Completed",
        label: "Completed",
        icon: CheckCircle,
    },
    {
        value: "Cancelled",
        label: "Cancelled",
        icon: CircleX,
    },
];

    