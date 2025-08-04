const express = require("express");
const puppeteer = require("puppeteer");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post("/check", async (req, res) => {
  const { cnic } = req.body;

  if (!/^[0-9]{13}$/.test(cnic)) {
    return res.status(400).json({ error: "Invalid CNIC" });
  }

  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();
    await page.goto("https://hunarmand.bisp.gov.pk/beneficiary.aspx", {
      waitUntil: "networkidle2"
    });

    await page.type("#txtCnic", cnic);

    // Click the submit button
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2" }),
      page.click("#btnSubmit")
    ]);

    const currentURL = page.url();

    if (currentURL.includes("results")) {
      // eligible → redirected to new page
      await browser.close();
      return res.json({
        eligible: true,
        message: "This CNIC is eligible. Redirected to result page."
      });
    }

    // Check for not eligible message in Urdu on same page
    const message = await page.$eval("#lblMessage", el => el.textContent.trim());

    await browser.close();

    if (message.includes("اہل نہیں ہیں")) {
      return res.json({
        eligible: false,
        message: "This CNIC is not eligible."
      });
    }

    return res.json({
      eligible: false,
      message: "Unable to determine eligibility."
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Scraper error" });
  }
});

app.listen(3000, () => console.log("Running on port 3000"));
