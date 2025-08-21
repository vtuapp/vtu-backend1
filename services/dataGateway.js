const axios = require("axios");
const crypto = require("crypto");

const BASE = process.env.DATA_GATEWAY_BASE;
const API_KEY = process.env.DATA_GATEWAY_API_KEY;
const SECRET = process.env.DATA_GATEWAY_SECRET;
const VENDOR_ID = process.env.DATA_GATEWAY_VENDOR_ID;
const GATEWAY_NAME = process.env.DATA_GATEWAY_NAME || "UnknownGateway";

if (!BASE || !API_KEY || !SECRET) {
  console.warn("⚠️ DATA GATEWAY envs missing. Set DATA_GATEWAY_* values in .env");
}

// Example: some gateways require HMAC of request body.
// If your provider doesn't, you can remove the hashing bits below.
function signPayload(payloadStr) {
  return crypto.createHmac("sha256", SECRET).update(payloadStr).digest("hex");
}

const client = axios.create({
  baseURL: BASE,
  timeout: 30000,
});

// Helper to call gateway with common headers
async function gatewayPost(path, body) {
  const raw = JSON.stringify(body);
  const signature = signPayload(raw); // remove if your provider doesn't use HMAC

  const headers = {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,              // adjust header names per provider
    "x-signature": signature,          // remove if not needed
    "x-vendor-id": VENDOR_ID || "",
  };

  const { data } = await client.post(path, body, { headers });
  return data;
}

// ---- Public API for our server ----

// Option A: Some gateways expose service variations (plans) — you can fetch and map to DB
async function fetchGatewayVariationsFor(network) {
  // Example path; adjust to your provider:
  // e.g. /v1/service-variations?serviceID=mtn-data
  const serviceID = ({
    MTN: "mtn-data",
    AIRTEL: "airtel-data",
    GLO: "glo-data",
    "9MOBILE": "9mobile-data",
  })[network];

  if (!serviceID) throw new Error("Unsupported network");
  const res = await client.get(`/v1/service-variations`, {
    params: { serviceID },
    headers: { "x-api-key": API_KEY },
  });
  return res.data; // you’ll map this if you want to sync plans
}

// Purchase data bundle
async function purchaseData({ network, phone, gatewayPlanId, requestId }) {
  // Example body for a VTPass-like provider:
  const body = {
    request_id: requestId,          // must be unique per order
    serviceID: ({
      MTN: "mtn-data",
      AIRTEL: "airtel-data",
      GLO: "glo-data",
      "9MOBILE": "9mobile-data",
    })[network],
    billersCode: phone,             // beneficiary phone
    variation_code: gatewayPlanId,  // plan id from your DataPlan.gatewayPlanId
    amount: 0                       // optional; many gateways ignore and charge by variation_code
  };

  // Adjust path & headers to your provider:
  const resp = await gatewayPost("/v1/pay", body);
  return resp;
}

module.exports = {
  GATEWAY_NAME,
  fetchGatewayVariationsFor,
  purchaseData,
};
