module.exports = {


  deposit: {

    // Provider fee (CamPay)
    providerFeePercentage: 0.025, // 2.5%

    minimumDepositXAF: 1500,

  },
  withdrawal: {

    // User cannot withdraw below this
    minimumWithdrawalUSD: 5,

    // FX Arena fee
    minimumFeeXAF: 600, // ≈ $1

    // When percentage starts
    percentageThresholdXAF: 30000,

    // FX Arena percentage above threshold
    percentageFee: 0.02, // 2%

  }

};