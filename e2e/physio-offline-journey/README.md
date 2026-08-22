# Physio deterministic offline journey

This Playwright suite drives the normal Physio application shell and local server through public account registration, OTP verification, subscription activation, practitioner onboarding, client and care-episode work, the 236-row assessment library, a persisted zero-valued score, SOAP/report authoring and a real server restart.

It is deliberately an **offline loopback proof**. Stripe completion and OpenAI-compatible chat responses come from repository-owned deterministic fixtures. It is not evidence of real provider egress and must not be described as a production-provider canary.

Run it directly with:

```powershell
node --test e2e/physio-offline-journey/soap-ui-contract.test.mjs
npx playwright test --config e2e/physio-offline-journey/playwright.config.mjs
```

The Playwright matrix runs serially at a 1440 px desktop viewport and with the
Playwright Pixel 7 descriptor. Mobile controls must pass an in-viewport
centre-point hit test before semantic activation, so an overlay or horizontal
overflow fails the journey without a forced click.

Failure traces, screenshots and videos are written beneath `output/playwright/physio-offline-journey/`.
