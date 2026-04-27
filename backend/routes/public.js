const express = require("express");
const router = express.Router();

const { db } = require("../firebaseAdmin");



// =====================================================
// 2️⃣ INVITE DEEP LINK HANDLER
// =====================================================
router.get("/invite", (req, res) => {
  const ref = req.query.ref;

  if (!ref) {
    return res.status(400).send("Missing referral code");
  }

  const deepLink = `forextournamentsarena://welcome?ref=${ref}`;
  const fallbackUrl = `https://forexarena.vercel.app/download?ref=${ref}`;

  res.send(`
    <html>
      <head>
        <meta http-equiv="refresh" content="2;url=${fallbackUrl}" />
      </head>
      <body>
        <script>
          window.location = "${deepLink}";
          setTimeout(() => {
            window.location = "${fallbackUrl}";
          }, 2000);
        </script>

        <p>
          If not redirected,
          <a href="${fallbackUrl}">click here to download the app</a>
        </p>
      </body>
    </html>
  `);
});

// =====================================================
// 3️⃣ CURRENCY RATES (PUBLIC)
// =====================================================
const { rates, BASE_CURRENCY } = require("../config/currency");

router.get("/currency", (req, res) => {
  res.json({
    base: BASE_CURRENCY,
    rates,
  });
});

// =====================================================
// 4️⃣ PUBLIC TOURNAMENT LIST (optional but useful)
// =====================================================
router.get("/tournaments", async (req, res) => {
  try {
    const snapshot = await db.collection("tournaments").get();

    const tournaments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({
      success: true,
      data: tournaments,
    });

  } catch (err) {
    console.error("PUBLIC TOURNAMENT ERROR:", err.message);
    res.status(500).json({ error: "Failed to fetch tournaments" });
  }
});

module.exports = router;