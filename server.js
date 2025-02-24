require('dotenv').config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs-extra");
const { exec } = require("child_process");
const path = require("path");
const util = require("util");

const execAsync = util.promisify(exec); // Convert exec to a promise-based function

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Parse form data

const upload = multer({ dest: "uploads/" });

// API Route to Generate App
app.post("/generate-app", upload.single("icon"), async (req, res) => {
    const { websiteUrl, appName, packageName } = req.body;
    const iconPath = req.file ? req.file.path : null;
    const outputFolder = path.resolve(__dirname, "generated_apps", packageName);

    try {
        // Ensure the output directory exists
        fs.ensureDirSync(outputFolder);

        // Create Cordova App
        await execAsync(`cordova create "${outputFolder}" "${packageName}" "${appName}"`);

        // Change directory and add platform
        await execAsync(`cd "${outputFolder}" && cordova platform add android`);

        // Modify config.xml to include webview settings
        const configPath = path.join(outputFolder, "config.xml");
        let configXml = fs.readFileSync(configPath, "utf8");
        configXml = configXml.replace("</widget>", `
            <allow-navigation href="${websiteUrl}" />
            <content src="${websiteUrl}" />
        </widget>`);
        fs.writeFileSync(configPath, configXml);

        // Build APK
        await execAsync(`cd "${outputFolder}" && cordova build android`);

        // Send download link
        res.json({ downloadUrl: `/download/${packageName}` });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});

// API to Download APK
app.get("/download/:packageName", (req, res) => {
    const { packageName } = req.params;
    const apkPath = path.resolve(__dirname, `generated_apps/${packageName}/platforms/android/app/build/outputs/apk/debug/app-debug.apk`);

    if (!fs.existsSync(apkPath)) {
        return res.status(404).json({ error: "APK not found" });
    }

    res.download(apkPath);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

