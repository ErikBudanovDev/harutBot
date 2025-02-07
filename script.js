const express = require("express");
const bodyParser = require("body-parser");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const { execSync } = require("child_process");
const fs = require("fs");

const app = express();
const port = 3030;

// Middleware to parse JSON and HTML content
app.use(bodyParser.text({ type: "text/html" }));

// Function to extract the "Job Manager" link from the HTML
function extractJobManagerLink(htmlContent) {
  const regex = /<a href="([^"]+)"[^>]*> Job Manager<\/a>/;
  const match = regex.exec(htmlContent);
  return match ? match[1] : null;
}

// Function to open the link in Puppeteer and click the "Accept" button
async function findAndClickButton(url) {
  try {
    const chromePath = "/opt/render/.cache/puppeteer/chrome/linux-132.0.6834.83/chrome-linux64/chrome";

    // Install Chrome if it's missing
    if (!fs.existsSync(chromePath)) {
      console.log("⚠️ Chrome not found! Installing...");
      execSync("npx puppeteer browsers install chrome", { stdio: "inherit" });
    }

    if (!fs.existsSync(chromePath)) {
      console.error("❌ Chrome installation failed.");
      process.exit(1);
    }

    console.log("✅ Chrome found at:", chromePath);

    const browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: false, // Set to false for debugging
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(0);

    // Load the page and wait for all network requests to finish
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    console.log("✅ Page loaded successfully.");

    // Wait for Angular SPA rendering completion
    await page.waitForFunction(() => window.getAllAngularTestabilities && window.getAllAngularTestabilities().every(t => t.isStable), { timeout: 10000 });

    // Take a screenshot for debugging
    await page.screenshot({ path: "debug.png", fullPage: true });

    // Wait for button to appear
    await page.waitForSelector("button", { visible: true, timeout: 15000 });

    // Try clicking within an iframe first
    const frames = await page.frames();
    let buttonClicked = false;
    for (const frame of frames) {
      const acceptButton = await frame.$("button");
      if (acceptButton) {
        await acceptButton.click();
        buttonClicked = true;
        console.log("✅ Accept button clicked inside iframe.");
        break;
      }
    }

    // If not in iframe, find the button normally
    if (!buttonClicked) {
      buttonClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const acceptButton = buttons.find((btn) => btn.textContent.includes("Accept"));
        if (acceptButton) {
          acceptButton.click();
          return true;
        }
        return false;
      });

      if (buttonClicked) {
        console.log("✅ Accept button clicked successfully.");
      } else {
        console.log("⚠️ No Accept button found.");
      }
    }

    await browser.close();
  } catch (error) {
    console.error("❌ Error occurred while processing:", error);
  }
}

// POST endpoint to process HTML content
app.post("/process-email", async (req, res) => {
  try {
    const emailHtml = req.body;
    if (!emailHtml) return res.status(400).send("No HTML content provided.");

    const jobManagerLink = extractJobManagerLink(emailHtml);
    if (jobManagerLink) {
      console.log("🔗 Job Manager link found:", jobManagerLink);
      await findAndClickButton(jobManagerLink);
      res.status(200).send("✅ Job Manager link processed successfully.");
    } else {
      res.status(400).send("⚠️ No Job Manager link found in the provided HTML.");
    }
  } catch (error) {
    console.error("❌ Error processing email:", error);
    res.status(500).send("An error occurred while processing the email.");
  }
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Server is running on http://localhost:${port}`);
});
