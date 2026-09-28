require("dotenv").config();
const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const API_BASE = "https://api.uropai.in";
const PORT = process.env.PORT || 3000;

// IMPORTANT: set RETURN_URL in Render to an HTTPS URL, e.g.
// https://YOUR-SERVICE.onrender.com/api/payment-return
const RETURN_URL = process.env.RETURN_URL || "";

function signedHeaders(method, path, query, body) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID();
  const canonical = [method, path, timestamp, nonce, query, body].join("\n");

  const signature = crypto
    .createHmac("sha256", process.env.UROPAY_API_SECRET || "")
    .update(canonical)
    .digest("hex");

  return {
    "X-Api-Key": process.env.UROPAY_API_KEY || "",
    "X-Timestamp": timestamp,
    "X-Nonce": nonce,
    "X-Signature": signature,
    "Content-Type": "application/json"
  };
}

app.post("/api/create-order", async (req, res) => {
  try {
    if (!process.env.UROPAY_API_KEY || !process.env.UROPAY_API_SECRET) {
      return res.status(500).json({ error: "backend_config_error", message: "UroPay credentials are not configured." });
    }
    if (!RETURN_URL || !RETURN_URL.startsWith("https://")) {
      return res.status(500).json({ error: "backend_config_error", message: "RETURN_URL must be an HTTPS URL." });
    }

    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "invalid_amount" });
    }

    const body = JSON.stringify({
      tenantOrderRef: String(req.body.tenantOrderRef || ""),
      amount,
      currency: "INR",
      returnUrl: RETURN_URL
    });

    const path = "/v1/orders";
    const response = await fetch(API_BASE + path, {
      method: "POST",
      headers: signedHeaders("POST", path, "", body),
      body
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!response.ok) return res.status(response.status).json(data);

    res.json({
      orderId: data?.data?.id,
      openUrl: data?.data?.openUrl,
      status: data?.data?.status
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "backend_error", message: error.message });
  }
});

app.get("/api/order-status", async (req, res) => {
  try {
    const orderId = String(req.query.orderId || "");
    if (!orderId) return res.status(400).json({ error: "missing_order_id" });

    const path = "/v1/orders/" + encodeURIComponent(orderId);
    const response = await fetch(API_BASE + path, {
      method: "GET",
      headers: signedHeaders("GET", path, "", "")
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!response.ok) return res.status(response.status).json(data);

    res.json({ orderId: data?.data?.id, status: data?.data?.status });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "backend_error", message: error.message });
  }
});

// HTTPS return endpoint required by UroPay. It forwards the browser back to the app.
// All query parameters supplied by UroPay are preserved.
app.get("/api/payment-return", (req, res) => {
  const params = new URLSearchParams(req.query);
  const target = "shreya://payment" + (params.toString() ? "?" + params.toString() : "");
  res.redirect(302, target);
});

app.get("/", (req, res) => res.send("Shreya UroPay Backend OK"));

app.listen(PORT, () => console.log(`UroPay backend running on ${PORT}`));
