import React from "react";
import { Link } from "react-router-dom";
import { LockKeyhole } from "lucide-react";

import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";

export default function Register() {
  return (
    <AuthLayout
      icon={LockKeyhole}
      title="Restricted comparison access"
      subtitle="AssessSuite Physio Revision 1"
      footer={
        <>
          Already authorised?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
          This preserved Revision 1 environment is available only to authorised comparison users.
          Public account creation is disabled.
        </div>
        <Button asChild className="h-12 w-full font-medium">
          <Link to="/login">Return to sign in</Link>
        </Button>
      </div>
    </AuthLayout>
  );
}
