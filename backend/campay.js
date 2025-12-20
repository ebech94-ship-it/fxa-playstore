const axios = require("axios");

const testCampay = async (req, res) => {
  try {
    const response = await axios.post(
      `${process.env.CAMPAY_BASE_URL}/token/`,
      {
        username: process.env.CAMPAY_USERNAME,
        password: process.env.CAMPAY_PASSWORD,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("CamPay error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message,
    });
  }
};

module.exports = {
  testCampay,
};
