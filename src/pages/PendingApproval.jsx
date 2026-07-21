import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, LogOut, Mail, XCircle, CreditCard } from "lucide-react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function PendingApproval() {
  const [accountStatus, setAccountStatus] = useState(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    base44.auth.me().then(user => {
      setAccountStatus(user?.account_status || 'pending');
    }).catch(() => {});
  }, []);

  const isSuspended = accountStatus === 'suspended';
  const isRejected = accountStatus === 'rejected';
  const isBlocked = isSuspended || isRejected;

  const statusTitle = isSuspended
    ? 'Reactivate Your Subscription'
    : isRejected
      ? 'Account Not Approved'
      : 'Awaiting Approval';

  const statusMessage = isSuspended ? (
    <>
      Your subscription has lapsed or been cancelled, so access is paused.
      Completing payment reactivates your account immediately. Need help?
      Contact{' '}
      <a href="mailto:admin@assesssuite.com" className="text-blue-600 underline">admin@assesssuite.com</a>
      {' '}or call{' '}
      <a href="tel:1800317553" className="text-blue-600 underline">1800 317 553</a>.
    </>
  ) : isRejected ? (
    <>
      Your account application was not approved. If you believe this is an
      error, please contact us at{' '}
      <a href="mailto:admin@assesssuite.com" className="text-blue-600 underline">admin@assesssuite.com</a>
      {' '}or call{' '}
      <a href="tel:1800317553" className="text-blue-600 underline">1800 317 553</a>.
    </>
  ) : (
    <>
      {/* Launch model: payment activates the account, so a pending user's
          next step is checkout, not waiting on an administrator. */}
      Your account is nearly ready — completing your subscription activates
      it immediately. Questions? Contact{' '}
      <a href="mailto:admin@assesssuite.com" className="text-blue-600 underline">admin@assesssuite.com</a>.
    </>
  );

  const handleCompletePayment = () => {
    // Route to PaymentRequired so the user chooses monthly or annual — the
    // previous direct checkout call hardcoded the monthly plan.
    setIsRedirecting(true);
    window.location.href = "/PaymentRequired";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isBlocked ? 'bg-red-100' : 'bg-yellow-100'}`}>
            {isBlocked
              ? <XCircle className="w-8 h-8 text-red-600" />
              : <Clock className="w-8 h-8 text-yellow-600" />
            }
          </div>
          <CardTitle className="text-center text-2xl">
            {statusTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-slate-600">
            {statusMessage}
          </p>
          <div className="pt-4 border-t">
            {/* Suspended users (lapsed/cancelled subscription) get the payment
                path — the webhook auto-reactivates on checkout. Only a
                rejected account is denied it (webhook NEVER_ACTIVATE). */}
            {!isRejected && (
              <Button
                onClick={handleCompletePayment}
                disabled={isRedirecting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white mb-3"
              >
                {isRedirecting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirecting...</>
                ) : (
                  <><CreditCard className="w-4 h-4 mr-2" /> Complete Payment</>
                )}
              </Button>
            )}
            <Button 
              onClick={() => base44.auth.logout()}
              variant="outline"
              className="w-full"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}