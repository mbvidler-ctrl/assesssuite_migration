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
    ? 'Account Suspended'
    : isRejected
      ? 'Account Not Approved'
      : 'Awaiting Approval';

  const statusMessage = isSuspended ? (
    <>
      Your account has been suspended. Please contact us at{' '}
      <a href="mailto:admin@assesssuite.com" className="text-blue-600 underline">admin@assesssuite.com</a>
      {' '}or call{' '}
      <a href="tel:1800317553" className="text-blue-600 underline">1800 317 553</a>
      {' '}to resolve this.
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
      Your account is awaiting administrator approval. You will be able to
      access client and assessment features once your account has been
      approved. Questions? Contact{' '}
      <a href="mailto:admin@assesssuite.com" className="text-blue-600 underline">admin@assesssuite.com</a>.
    </>
  );

  const handleCompletePayment = async () => {
    setIsRedirecting(true);
    try {
      const currentUser = await base44.auth.me();
      // Parameter names and response envelope aligned with the function's
      // actual contract (plan/userId/userEmail in; { url } out under .data)
      // — the previous snake_case parameters were never read and
      // result.sessionUrl never existed, so this button could not work.
      const result = await base44.functions.invoke("createCheckoutSession", {
        plan: "monthly",
        userId: currentUser.id,
        userEmail: currentUser.email,
        userName: currentUser.full_name,
      });
      const payload = result?.data ?? result;
      const url = payload?.url;
      if (url) {
        window.location.href = url;
      }
    } catch (e) {
      console.error("Checkout error", e);
    } finally {
      setIsRedirecting(false);
    }
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
            {!isSuspended && !isRejected && (
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