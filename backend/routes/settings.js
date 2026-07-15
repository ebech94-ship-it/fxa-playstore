const express = require("express");
const router = express.Router();

const { deposit, withdrawal } = require("../config/fees");

router.get("/fees", (req, res) => {
  try {

    res.json({

      deposit: {
        providerFeePercentage: deposit.providerFeePercentage,
        minimumDepositXAF: deposit.minimumDepositXAF,
      },

      withdrawal: {
        minimumWithdrawalUSD: withdrawal.minimumWithdrawalUSD,
        minimumFeeXAF: withdrawal.minimumFeeXAF,
        percentageThresholdXAF: withdrawal.percentageThresholdXAF,
        percentageFee: withdrawal.percentageFee,
      }

    });

  } catch (error) {

    console.error("Settings error:", error);

    res.status(500).json({
      error: "Unable to load settings",
    });

  }
});

module.exports = router;