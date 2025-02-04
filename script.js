const express = require("express");
const bodyParser = require("body-parser");
const puppeteer = require("puppeteer");

const app = express();
const port = 3030;

// Middleware to parse JSON and HTML content
app.use(bodyParser.text({ type: "text/html" }));

// Function to extract the "Job Manager" link from the HTML
function extractJobManagerLink(htmlContent) {
  const regex = /<a href="([^"]+)"[^>]*> Job Manager<\/a>/;
  const match = regex.exec(htmlContent);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

// Function to open the link in Puppeteer and click the "Accept" button
async function findAndClickButton(url) {
  try {
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: "domcontentloaded" });

    console.log("Page loaded successfully.");

    await page.waitForSelector("button", { timeout: 5000 });

    const buttonClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const acceptButton = buttons.find((btn) => btn.textContent.includes("Accept"));

      if (acceptButton) {
        acceptButton.click();
        return true;
      }

      return false;
    });

    if (buttonClicked) {
      console.log("Accept button clicked successfully.");
    } else {
      console.log("No Accept button found.");
    }

    await browser.close();
  } catch (error) {
    console.error("Error occurred while processing:", error);
  }
}

// POST endpoint to process HTML content
app.post("/process-email", async (req, res) => {
  try {
    const emailHtml = req.body;

    if (!emailHtml) {
      return res.status(400).send("No HTML content provided.");
    }

    const jobManagerLink = extractJobManagerLink(emailHtml);

    if (jobManagerLink) {
      console.log("Job Manager link found:", jobManagerLink);
      await findAndClickButton(jobManagerLink);
      res.status(200).send("Job Manager link processed successfully.");
    } else {
      res.status(400).send("No Job Manager link found in the provided HTML.");
    }
  } catch (error) {
    console.error("Error processing email:", error);
    res.status(500).send("An error occurred while processing the email.");
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
