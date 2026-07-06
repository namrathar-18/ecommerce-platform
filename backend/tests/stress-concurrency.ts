/**
 * Concurrency stress test — proves the checkout transaction cannot oversell.
 *
 * Scenario: a product with EXACTLY 1 unit in stock; N customers fire checkout
 * simultaneously. Expected: exactly 1 success, N-1 conflict (409) failures,
 * and inventory never goes negative.
 *
 * Run (API must be up): npx tsx tests/stress-concurrency.ts
 */
const B = "http://localhost:4000/api/v1";
const N = 8;

async function json(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${B}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function main() {
  // 1) vendor creates a 1-unit product with a unique SKU
  const vendor = await json("POST", "/auth/login", { email: "ravi@shop.dev", password: "Password123" });
  const sku = `STRESS-${Date.now()}`;
  const product = await json(
    "POST",
    "/products",
    { name: "Last Unit Item", price: 500, sku, quantity: 1 },
    vendor.body.accessToken
  );
  const productId = Number(product.body.id);
  console.log(`Created product ${productId} (sku ${sku}) with quantity=1`);

  // 2) register N throwaway customers, each with the product in their cart
  const tokens: string[] = [];
  for (let i = 0; i < N; i++) {
    const email = `stress_${Date.now()}_${i}@test.dev`;
    const reg = await json("POST", "/auth/register", {
      name: `Stress ${i}`,
      email,
      password: "Password123",
    });
    if (reg.status === 429) {
      console.error("Rate limiter kicked in — raise the /auth limit for stress runs or reuse accounts.");
      process.exit(1);
    }
    tokens.push(reg.body.accessToken);
    await json("POST", "/cart/items", { productId, quantity: 1 }, reg.body.accessToken);
  }
  console.log(`${N} customers ready, all carts contain the last unit. Firing simultaneously...`);

  // 3) fire all checkouts at once
  const results = await Promise.all(tokens.map((t) => json("POST", "/orders/checkout", {}, t)));
  const wins = results.filter((r) => r.status === 201);
  const conflicts = results.filter((r) => r.status === 409);

  console.log(`\nResults: ${wins.length} success, ${conflicts.length} conflict, ${results.length - wins.length - conflicts.length} other`);

  // 4) verify invariant
  if (wins.length === 1 && conflicts.length === N - 1) {
    console.log("PASS ✅  exactly one checkout won the last unit; no overselling.");
    process.exit(0);
  } else {
    console.error("FAIL ❌  invariant violated!", results.map((r) => r.status));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
