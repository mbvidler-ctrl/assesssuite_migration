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

  const handleCompletePayment = async () => {
    setIsRedirecting(true);
    try {
      const currentUser = await base44.auth.me();
      const result = await base44.functions.invoke("createCheckoutSession", {
        price_id: "price_1TaUtnQ515tU8HKQjGJQeBqw",
        customer_email: currentUser.email,
      });
      if (result?.sessionUrl) {
        window.location.href = result.sessionUrl;
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
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isSuspended || isRejected ? 'bg-red-100' : 'bg-yellow-100'}`}>
            {isSuspended || isRejected
              ? <XCircle className="w-8 h-8 text-red-600" />
              : <Clock className="w-8 h-8 text-yellow-600" />
            }
          </div>
          <CardTitle className="text-center text-2xl">
            Account Suspended
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-slate-600">
            Your account has been suspended. Please contact us at{' '}
            <a href="https://demo.unimatter.com.au" className="text-blue-600 underline">Cadence Bio-Clinics demonstration</a>
            {' '}or call{' '}
            <a href="https://demo.unimatter.com.au" className="text-blue-600 underline">the demonstration page</a>
            {' '}to resolve this.
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
