require("dotenv").config();
const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const API_BASE = "https://api.uropai.in";

function signedHeaders(method, path, query, body) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID();

  const canonical = [
    method,
    path,
    timestamp,
    nonce,
    query,
    body
  ].join("\n");

  const signature = crypto
    .createHmac("sha256", process.env.UROPAY_API_SECRET)
    .update(canonical)
    .digest("hex");

  return {
    "X-Api-Key": process.env.UROPAY_API_KEY,
    "X-Timestamp": timestamp,
    "X-Nonce": nonce,
    "X-Signature": signature,
    "Content-Type": "application/json"
  };
}

app.post("/api/create-order", async (req, res) => {
  try {
    const body = JSON.stringify({
      tenantOrderRef: req.body.tenantOrderRef,
      amount: Number(req.body.amount),
      currency: "INR",
      returnUrl: "shreya://payment"
    });

    const path = "/v1/orders";

    const response = await fetch(API_BASE + path, {
      method: "POST",
      headers: signedHeaders("POST", path, "", body),
      body
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json({
      orderId: data.data.id,
      openUrl: data.data.openUrl,
      status: data.data.status
    });

  } catch (error) {
    res.status(500).json({
      error: "backend_error"
    });
  }
});

app.get("/api/order-status", async (req, res) => {
  try {
    const orderId = String(req.query.orderId || "");
    const path = "/v1/orders/" + encodeURIComponent(orderId);

    const response = await fetch(API_BASE + path, {
      method: "GET",
      headers: signedHeaders("GET", path, "", "")
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json({
      orderId: data.data.id,
      status: data.data.status
    });

  } catch (error) {
    res.status(500).json({
      error: "backend_error"
    });
  }
});

app.get("/", (req, res) => {
  res.send("Shreya UroPay Backend OK");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("UroPay backend running");
});
