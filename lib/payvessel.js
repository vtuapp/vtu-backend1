const axios = require("axios");

const api = axios.create({
  baseURL: process.env.PAYVESSEL_BASE_URL || "https://api.payvessel.com",
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  config.headers["api-key"] = process.env.PAYVESSEL_API_KEY;
  config.headers["api-secret"] = `Bearer ${process.env.PAYVESSEL_API_SECRET}`;
  config.headers["Content-Type"] = "application/json";
  return config;
});

module.exports = api;
