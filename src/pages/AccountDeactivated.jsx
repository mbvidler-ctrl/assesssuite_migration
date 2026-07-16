import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Archive, LogOut } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Landing state for a self-deactivated account (Layout routes
// account_status === 'deactivated' here). Distinct from PendingApproval:
// this state is user-chosen, carries the retention explanation, and offers
// no payment path — reactivation is an administrator action.
export default function AccountDeactivated() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center p-6">
      <Card className="max-w-md w-full bg-white/90 shadow-lg">
        <CardHeader className="text-center">
          <div className="w-14 h-14 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-2">
            <Archive className="w-7 h-7 text-slate-500" />
          </div>
          <CardTitle>Account deactivated</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-600">
          <p>
            Your account has been closed. You no longer have access to the AssessSuite platform, or to the treatment records, patient details, policies, and consents associated with that account. Any records that Assess Suite Pty Ltd is required to retain under law and professional obligation are held securely and are not accessible through your account.
          </p>
          <p>
            To reactivate your account, contact{" "}
            <a href="mailto:admin@assesssuite.com" className="text-blue-600 underline">admin@assesssuite.com</a>{" "}
            or call <a href="tel:1800317553" className="text-blue-600 underline">1800 317 553</a>.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => base44.auth.logout(window.location.origin + "/")}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
