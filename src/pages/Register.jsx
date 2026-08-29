import React from "react";
import { Link } from "react-router-dom";
import { LockKeyhole } from "lucide-react";

import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { buildTimeProfession } from "@/lib/profession";

export default function Register() {
  return (
    <AuthLayout
      icon={LockKeyhole}
      title="Invitation-only access"
      subtitle={`${buildTimeProfession.productName} is a restricted production platform`}
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          Return to authorised sign in
        </Link>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-950">
          Public registration is not available. A practice owner must invite your exact email address before you can create a password and access the platform.
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          If you have been authorised, use the single-use link in your invitation email. Existing members can sign in or reset their password below.
        </p>
        <Button asChild className="h-12 w-full">
          <Link to="/login">Sign in</Link>
        </Button>
        <Button asChild variant="outline" className="h-12 w-full">
          <Link to="/forgot-password">Reset an existing password</Link>
        </Button>
      </div>
    </AuthLayout>
  );
}
