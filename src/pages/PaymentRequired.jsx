import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, CheckCircle } from "lucide-react";

export default function PaymentRequired() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async (plan) => {
    setIsLoading(true);
    try {
      const user = await base44.auth.me();
      // Send `plan` ("monthly" | "annual") rather than a hard-coded priceId.
      // The captured price ids belong to the client's original Stripe
      // account and do not exist in the live account; a body-supplied
      // priceId wins in the backend and would 500 with "No such price".
      // The backend resolves the price from STRIPE_PRICE_ID_* by plan.
      const response = await base44.functions.invoke("createCheckoutSession", {
        plan,
        userEmail: user.email,
        userId: user.id,
        successUrl: window.location.origin + "/Dashboard",
        cancelUrl: window.location.origin + "/PaymentRequired",
      });
      const data = response.data;
      const url = data?.url;
      if (url) {
        setTimeout(() => {
          window.location.href = url;
        }, 100);
      } else {
        console.error("No URL in response:", JSON.stringify(data));
        alert("Could not start checkout. Please try again.");
        setIsLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
          <CreditCard className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Activate Your Subscription</h1>
        <p className="text-slate-600 text-lg">Choose a plan to access AssessSuite.</p>

        <div className="grid gap-4">
          {/* Monthly */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-left shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-bold text-slate-900">Monthly</h2>
              <span className="text-2xl font-bold text-blue-600">$55<span className="text-base font-normal text-slate-500">/mo</span></span>
            </div>
            <ul className="text-slate-600 text-sm space-y-1 mb-4">
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> 295+ standardised assessments</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Automated SOAP notes & reports</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Cancel anytime</li>
            </ul>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => handleSubscribe("monthly")}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Get Started Monthly
            </Button>
          </div>

          {/* Annual */}
          <div className="bg-white rounded-2xl border border-blue-300 p-6 text-left shadow-sm relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">BEST VALUE</span>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-bold text-slate-900">Annual</h2>
              <span className="text-2xl font-bold text-blue-600">$45<span className="text-base font-normal text-slate-500">/mo</span></span>
            </div>
            <ul className="text-slate-600 text-sm space-y-1 mb-4">
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Everything in Monthly</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Save $120/year</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Billed as $540/year</li>
            </ul>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => handleSubscribe("annual")}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Get Started Annually
            </Button>
          </div>
        </div>

        <p className="text-xs text-slate-400">Secured by Stripe. Cancel anytime from your account settings.</p>
      </div>
    </div>
  );
}