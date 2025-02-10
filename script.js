const express = require("express");
const bodyParser = require("body-parser");
const puppeteer = require("puppeteer");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

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

// Function to find the installed Chrome path dynamically
function getChromePath() {
    const baseDir = "/opt/render/.cache/puppeteer/chrome/";
    
    if (!fs.existsSync(baseDir)) {
        console.error("❌ Puppeteer cache directory does not exist.");
        return null;
    }

    const chromeDirs = fs.readdirSync(baseDir).filter(dir => dir.startsWith("linux-"));

    if (chromeDirs.length === 0) {
        console.error("❌ No Chrome installation found.");
        return null;
    }

    // Get the latest installed Chrome version
    const latestChromeDir = chromeDirs.sort().reverse()[0]; 
    return path.join(baseDir, latestChromeDir, "chrome-linux64", "chrome");
}

// Function to install Chrome if needed
function ensureChromeInstalled() {
    console.log("🔍 Checking for Chrome installation...");
    let chromePath = getChromePath();

    if (!chromePath || !fs.existsSync(chromePath)) {
        console.log("⚠️ Chrome not found! Installing...");
        try {
            execSync("npx puppeteer browsers install chrome", { stdio: "inherit" });
        } catch (error) {
            console.error("❌ Chrome installation failed:", error);
            process.exit(1);
        }

        // Re-check installation
        chromePath = getChromePath();
        if (!chromePath || !fs.existsSync(chromePath)) {
            console.error("❌ Chrome installation failed completely.");
            process.exit(1);
        }

        console.log("✅ Chrome installed successfully at:", chromePath);
    } else {
        console.log("✅ Chrome already installed at:", chromePath);
    }

    return chromePath;
}

// Function to open the link in Puppeteer and click the "Accept" button
async function findAndClickButton(url) {
    try {
        const chromePath = ensureChromeInstalled();

        const browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });

        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded" });

        console.log("✅ Page loaded successfully.");

        await page.waitForSelector("button", { timeout: 5000 });

        const buttonClicked = await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll("*")); // Select all elements
          
          const acceptElement = elements.find(el => el.textContent.trim().includes("Accept") && el.click);
      
          if (acceptElement) {
              acceptElement.click();
              return true;
          }
          return false;
      });

        if (buttonClicked) {
            console.log("✅ Accept button clicked successfully.");
        } else {
            console.log("⚠️ No Accept button found.");
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

        if (!emailHtml) {
            return res.status(400).send("❌ No HTML content provided.");
        }

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