const fetch = require("node-fetch");

async function getCampayToken() {
  const res = await fetch(
    `${process.env.CAMPAY_BASE_URL}/token/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: process.env.CAMPAY_USERNAME,
        password: process.env.CAMPAY_PASSWORD,
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Token failed");

  return data.token;
}

module.exports = { getCampayToken };
