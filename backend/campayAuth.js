const fetch = require("node-fetch");

let cachedToken = null;
let tokenExpiry = null;

const getCampayToken = async () => {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const response = await fetch(
    `${process.env.CAMPAY_BASE_URL}/token/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: process.env.CAMPAY_USERNAME,
        password: process.env.CAMPAY_PASSWORD,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error("Failed to authenticate with CamPay");
  }

  cachedToken = data.token;
  tokenExpiry = Date.now() + 55 * 60 * 1000; // 55 minutes

  return cachedToken;
};

module.exports = { getCampayToken };
