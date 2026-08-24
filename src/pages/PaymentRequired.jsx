import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, CheckCircle } from "lucide-react";
import { useProfession } from "@/lib/profession";
import { confirmCheckoutReturn } from "@/lib/checkoutReturn";

function abortableWait(delayMs, signal) {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = window.setTimeout(resolve, delayMs);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

export default function PaymentRequired() {
  const profession = useProfession();
  const isPhysio = profession.id === "physio";
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [returnAttempt, setReturnAttempt] = useState(0);
  const [returnState, setReturnState] = useState("idle");
  const isCheckoutReturn = isPhysio
    && new URLSearchParams(window.location.search).get("checkout_return") === "1";

  useEffect(() => {
    if (!isCheckoutReturn) return undefined;
    const controller = new AbortController();
    setReturnState("confirming");
    confirmCheckoutReturn({
      readUser: () => base44.auth.me(),
      syncSubscription: () => base44.functions.invoke("syncStripeSubscription", {}),
      wait: abortableWait,
      signal: controller.signal,
    }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.status === "confirmed") {
        window.location.replace("/ProfileSetup");
        return;
      }
      if (result.status === "timeout") setReturnState("error");
    }).catch(() => {
      if (!controller.signal.aborted) setReturnState("error");
    });
    return () => controller.abort();
  }, [isCheckoutReturn, returnAttempt]);

  const handleSubscribe = async (plan) => {
    setLoadingPlan(plan);
    try {
      // The backend resolves the authenticated identity, deployment-owned
      // price and same-origin return targets. The client selects only a plan.
      const response = await base44.functions.invoke("createCheckoutSession", {
        plan,
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
        setLoadingPlan(null);
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
      setLoadingPlan(null);
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 ${isPhysio ? "to-teal-50/40" : "to-blue-50/30"} flex items-center justify-center p-6`}>
      <div className="max-w-lg w-full space-y-6 text-center">
        <div className={`w-16 h-16 ${isPhysio ? "bg-teal-100" : "bg-blue-100"} rounded-full flex items-center justify-center mx-auto`}>
          <CreditCard className={`w-8 h-8 ${isPhysio ? "text-teal-700" : "text-blue-600"}`} />
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Activate Your Subscription</h1>
        <p className="text-slate-600 text-lg">Choose a plan to access {profession.productName}.</p>
        {isPhysio && (
          <p className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
            Your free trial is applied at Stripe Checkout before recurring billing begins.
          </p>
        )}

        {isCheckoutReturn && (
          <div
            className={`rounded-lg border px-4 py-4 text-left ${returnState === "error" ? "border-red-200 bg-red-50" : "border-teal-200 bg-teal-50"}`}
            role="status"
            aria-live="polite"
          >
            {returnState === "error" ? (
              <>
                <p className="font-semibold text-red-900">We could not confirm your trial yet.</p>
                <p className="mt-1 text-sm text-red-800">
                  Your Checkout return did not activate access. No second checkout was started.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  onClick={() => setReturnAttempt((attempt) => attempt + 1)}
                >
                  Retry confirmation
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-3 text-teal-900">
                <Loader2 className="h-5 w-5 animate-spin" />
                <div>
                  <p className="font-semibold">Confirming your trial</p>
                  <p className="text-sm">Waiting for Stripe entitlement confirmation…</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className={`grid gap-4 ${isCheckoutReturn ? "opacity-50 pointer-events-none" : ""}`} aria-hidden={isCheckoutReturn ? "true" : undefined}>
          {/* Monthly */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-left shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-bold text-slate-900">Monthly</h2>
              <span className={`text-2xl font-bold ${isPhysio ? "text-teal-700" : "text-blue-600"}`}>AUD $55<span className="text-base font-normal text-slate-500">/mo</span></span>
            </div>
            <ul className="text-slate-600 text-sm space-y-1 mb-4">
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> {isPhysio ? "236 canonical outcome measures and assessments" : "295+ standardised assessments"}</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> {isPhysio ? "Physio AI drafts, SOAP notes and reports" : "Automated SOAP notes & reports"}</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Cancel anytime</li>
            </ul>
            <Button
              className={`w-full ${isPhysio ? "bg-teal-700 hover:bg-teal-800" : "bg-blue-600 hover:bg-blue-700"}`}
              onClick={() => handleSubscribe("monthly")}
              disabled={loadingPlan !== null || isCheckoutReturn}
            >
              {loadingPlan === "monthly" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isPhysio ? "Start Monthly Trial" : "Get Started Monthly"}
            </Button>
          </div>

          {/* Annual */}
          <div className={`bg-white rounded-2xl border ${isPhysio ? "border-teal-300" : "border-blue-300"} p-6 text-left shadow-sm relative`}>
            <span className={`absolute -top-3 left-1/2 -translate-x-1/2 ${isPhysio ? "bg-teal-700" : "bg-blue-600"} text-white text-xs font-bold px-3 py-1 rounded-full`}>BEST VALUE</span>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-bold text-slate-900">Annual</h2>
              <span className={`text-2xl font-bold ${isPhysio ? "text-teal-700" : "text-blue-600"}`}>AUD $45<span className="text-base font-normal text-slate-500">/mo</span></span>
            </div>
            <ul className="text-slate-600 text-sm space-y-1 mb-4">
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Everything in Monthly</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Save AUD $120/year</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Billed as AUD $540/year</li>
            </ul>
            <Button
              className={`w-full ${isPhysio ? "bg-teal-700 hover:bg-teal-800" : "bg-blue-600 hover:bg-blue-700"}`}
              onClick={() => handleSubscribe("annual")}
              disabled={loadingPlan !== null || isCheckoutReturn}
            >
              {loadingPlan === "annual" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isPhysio ? "Start Annual Trial" : "Get Started Annually"}
            </Button>
          </div>
        </div>

        <p className="text-xs text-slate-400">Secured by Stripe. Cancel anytime from your account settings.</p>
      </div>
    </div>
  );
}
