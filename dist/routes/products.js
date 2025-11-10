"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const Product_1 = __importDefault(require("../models/Product"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const router = express_1.default.Router();
function isAxiosError(error) {
    return error.isAxiosError === true;
}
router.post("/", async (req, res) => {
    try {
        const p = new Product_1.default(req.body);
        await p.save();
        const payload = {
            productName: p.name,
            category: p.category,
            attributes: p.attributes,
            previousAnswers: {},
            askedQuestions: [],
        };
        let aiQuestions = [];
        try {
            const aiResponse = await axios_1.default.post("http://localhost:5000/generate-questions", payload);
            const aiData = aiResponse.data;
            if (aiData.questions && Array.isArray(aiData.questions)) {
                aiQuestions = aiData.questions.filter((q) => typeof q === "string" && q.trim().length > 0);
                if (aiQuestions.length === 0) {
                    console.warn("⚠️ AI returned empty questions. Using fallback.");
                    aiQuestions = [
                        "What are the main materials and their source/origin?",
                        "What is the company's policy on labor ethics and fair wages?",
                        "How is the product packaged to minimize environmental waste?",
                    ];
                }
            }
            else {
                throw new Error("Malformed AI response");
            }
        }
        catch (aiErr) {
            console.error("❌ Failed to call AI service:", aiErr);
            aiQuestions = [
                "What are the main materials and their source/origin?",
                "What is the company's policy on labor ethics and fair wages?",
                "How is the product packaged to minimize environmental waste?",
            ];
        }
        p.questions = aiQuestions;
        await p.save();
        res.status(201).json(p);
    }
    catch (err) {
        console.error("❌ Product creation error:", err);
        res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
router.get("/:id", async (req, res) => {
    try {
        const p = await Product_1.default.findById(req.params.id);
        if (!p)
            return res.status(404).json({ error: "Not found" });
        res.json(p);
    }
    catch (err) {
        console.error("❌ Product fetch error:", err);
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
router.post("/:id/score", async (req, res) => {
    try {
        const p = await Product_1.default.findById(req.params.id);
        if (!p)
            return res.status(404).json({ error: "Product not found" });
        const answers = req.body;
        const aiResponse = await axios_1.default.post("http://localhost:5000/transparency-score", {
            productName: p.name,
            category: p.category,
            answers,
        });
        const scoreData = aiResponse.data;
        const finalScore = scoreData.score || 50;
        const reasoningSummary = scoreData.summary || "No reasoning summary provided.";
        p.transparencyScore = finalScore;
        p.attributes = { ...p.attributes, ...answers, reasoningSummary };
        await p.save();
        res.json({ score: finalScore, product: p });
    }
    catch (err) {
        console.error("❌ Product scoring error:", err);
        if (isAxiosError(err))
            console.error("Axios Scoring Error:", err.response?.data || err.message);
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
router.get("/:id/report", async (req, res) => {
    try {
        const p = await Product_1.default.findById(req.params.id);
        if (!p)
            return res.status(404).json({ error: "Not found" });
        const doc = new pdfkit_1.default({ margin: 50 });
        const fontPath = path_1.default.resolve("assets/fonts/DejaVuSans.ttf");
        if (fs_1.default.existsSync(fontPath)) {
            doc.registerFont("DejaVu", fontPath);
            doc.font("DejaVu");
        }
        else {
            console.warn("⚠️ Font not found. Using default Helvetica.");
        }
        const filename = `${p.name.replace(/\s/g, "_")}_Transparency_Report.pdf`;
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Type", "application/pdf");
        doc.pipe(res);
        doc
            .fontSize(22)
            .fillColor("#2563eb")
            .text("🌿 Product Transparency Report", { align: "center" })
            .moveDown(1.5);
        doc
            .fontSize(14)
            .fillColor("#000")
            .text(`🧾 Product Name: ${p.name}`)
            .text(`📂 Category: ${p.category}`)
            .moveDown(1);
        doc.strokeColor("#ccc").moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(1);
        doc
            .fontSize(16)
            .fillColor("#16a34a")
            .text("📝 Transparency Data (User Answers)", { underline: true })
            .moveDown(0.5);
        const { reasoningSummary, ...displayAnswers } = p.attributes || {};
        if (displayAnswers && Object.keys(displayAnswers).length > 0) {
            Object.entries(displayAnswers).forEach(([key, value]) => {
                const cleanValue = String(value).replace(/\*\*(.*?)\*\*/g, "$1");
                doc.font("Helvetica-Bold").fontSize(12).fillColor("#000").text(`${key}:`);
                doc.font("Helvetica").fillColor("#333").text(cleanValue, { indent: 20 });
                doc.moveDown(0.4);
            });
        }
        else {
            doc.fontSize(12).text("No recorded answers available.");
        }
        doc.moveDown(1);
        doc.strokeColor("#ccc").moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(1);
        if (p.questions?.length) {
            doc
                .fontSize(16)
                .fillColor("#9333ea")
                .text("🤖 AI-Generated Transparency Questions", { underline: true })
                .moveDown(0.5);
            p.questions.forEach((q, i) => doc.fontSize(12).fillColor("#333").text(`${i + 1}. ${q}`).moveDown(0.3));
        }
        doc.moveDown(1);
        doc.strokeColor("#ccc").moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(1);
        if (p.transparencyScore !== undefined) {
            doc
                .fontSize(16)
                .fillColor("#f59e0b")
                .text("📈 Transparency Score", { underline: true })
                .moveDown(0.5)
                .fontSize(14)
                .fillColor("#0a7d32")
                .text(`${p.transparencyScore}/100`, { align: "left" });
            if (reasoningSummary) {
                doc
                    .moveDown(0.5)
                    .fontSize(12)
                    .fillColor("#374151")
                    .text(`🧠 AI Reasoning Summary: ${reasoningSummary}`);
            }
        }
        doc
            .moveDown(2)
            .fontSize(10)
            .fillColor("gray")
            .text("Generated by the Product Transparency System — Promoting Ethical Manufacturing and Sustainability.", { align: "center" });
        doc.end();
    }
    catch (err) {
        console.error("❌ PDF generation error:", err);
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
router.delete("/:id", async (req, res) => {
    try {
        const p = await Product_1.default.findByIdAndDelete(req.params.id);
        if (!p)
            return res.status(404).json({ error: "Not found" });
        res.status(204).send();
    }
    catch (err) {
        console.error("❌ Product deletion error:", err);
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
exports.default = router;
