module.exports = {
  BASE_CURRENCY: "USD",
XAF_TO_USD: 600, 
  rates: {
    USD: 1,
    XAF: 600,
    EUR: 0.9,
  },

  // helper: convert any amount
 convert(amount, from, to) {
  if (!this.rates[from] || !this.rates[to]) {
    throw new Error("Unsupported currency");
  }

  const usdValue = amount / this.rates[from];
  return usdValue * this.rates[to];
}
};