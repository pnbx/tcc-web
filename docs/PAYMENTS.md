# Payments

## Flow

```
member → basket → checkout (re-price from DB) → provider session
       → redirect to provider → provider calls back
       → server-to-server verify → order PAID → product commands queued
       → redirect to /store/result/{orderNumber}
```

The browser is never trusted to say an order was paid. Only a verified callback
flips `Payment.status` and `Order.status`, and only then are the product commands
dispatched.

## Prices

- Stored as **Toman** (IRT) in `Product` / `ProductDuration`.
- Sent to Zibal in **Rial** (×10).
- A checkout request carries product ids and durations only. The server re-reads
  prices from the database, so a tampered client cannot change what is charged.

## Zibal

`src/lib/payments.ts` implements `ZibalProvider` behind the `PaymentProvider`
interface:

| Step | Call |
|---|---|
| create | `POST https://gateway.zibal.ir/v1/request` → `trackId` |
| redirect | `https://gateway.zibal.ir/start/{trackId}` |
| verify | `POST https://gateway.zibal.ir/v1/verify` with `success: 1` |

Set `PAYMENT_PROVIDER_MERCHANT_ID` to the merchant from the panel of the domain
the gateway was registered under, or the literal `zibal` for the sandbox.

## The callback-domain problem

Zibal rejects a `callbackUrl` whose domain is not the registered merchant domain
(`کد 106`). If the store lives on one domain and the merchant on another, the
callback cannot point at the store directly.

Two things solve it:

1. **`azuraai.ir`-style hop** — a page on the merchant domain starts the payment,
   so the referrer the gateway sees matches the merchant. `src/app/pay/start`
   does this, and the middleware deliberately drops the site-wide `no-referrer`
   policy for that one route so a real referrer is sent.
2. **A relay** — `deploy/zibal-relay/relay.php`, a small PHP endpoint on ordinary
   cPanel hosting that receives the provider's callback and forwards it to the
   site's `/api/store/callback`, signing with `ZIBAL_RELAY_SECRET`.

Both are in place in production; you only need the part that matches your
merchant setup.

## Adding a provider

Implement `PaymentProvider`:

- `create(order): Promise<{ redirectUrl, providerRef }>`
- `verify(callbackPayload): Promise<{ paid, providerRef, amount }>`

Then select it with `PAYMENT_PROVIDER`. Keep verification server-to-server; never
accept a browser-supplied "success" flag.

## Refunds, codes, expiry

- Redeem codes (rank, duration, seats, discount) are created in the owner/dev panel.
- Rank expiry is handled by `/api/cron/expiry`, which marks `UserProduct` rows
  expired and lets the Telegram integration warn the member beforehand.
