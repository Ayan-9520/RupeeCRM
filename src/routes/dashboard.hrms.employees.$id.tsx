import { createFileRoute } from "@tanstack/react-router";
import { CrmPageHub } from "@/components/dashboard/CrmPageHub";

export const Route = createFileRoute("/dashboard/hrms/employees/$id")({
  head: () => ({ meta: [{ title: "Employee — RupeeDial One" }] }),
  component: EmployeeDetail,
});

function EmployeeDetail() {
  return (
    <CrmPageHub
      title="Employee profile"
      description="Seat members are managed from Billing. Detailed employee files land with full HRMS APIs."
      links={[
        { label: "Team roster", to: "/dashboard/hrms", desc: "Active seats" },
        { label: "Billing / invite", to: "/dashboard/billing", desc: "Add seats" },
      ]}
      tip="Use Attendance and Leaves tabs for soft HRMS day-to-day."
    />
  );
}
