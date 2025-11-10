import { Router, Request, Response } from "express";
import Product from "../models/Product"; // Assumed Mongoose Model import
import PDFDocument from "pdfkit";
import axios from "axios";
import path from "path"; // Still unused, but kept for fidelity

// --- Type Definitions (Usually in "../models/Product" or a separate types file) ---

// Define the shape of the data on the Product document
interface IProductAttributes extends Record<string, any> {
  reasoningSummary?: string;
}

export interface IProduct {
  _id: string;
  name: string;
  category: string;
  attributes: IProductAttributes;
  questions: string[];
  transparencyScore: number;
}

// Extend the Request body type for specific routes
interface ProductCreateRequest extends Request {
  body: {
    name: string;
    category: string;
    attributes: Record<string, any>;
  };
}

interface ProductScoreRequest extends Request {
  body: Record<string, string>; // Answers object
}

// --- Router and Type Guards ---

const router = Router();

// Type guard for Axios errors, refined to include 'message'
function isAxiosError(error: any): error is { isAxiosError: true; response?: any; message: string } {
  // Check if the error object has the characteristic property of an Axios error
  return (error as any)?.isAxiosError === true;
}

// Helper function for PDF generation using PDFKit types
function addSection(doc: PDFKit.PDFDocument, title: string, content: string, color: string): void {
  doc.fontSize(14).fillColor(color).text(title, { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor("#374151").text(content, { align: "justify" });
  doc.moveDown(1.5);
}

// --- Route Handlers ---

// POST /products - Create a new product and generate initial questions
router.post("/", async (req: ProductCreateRequest, res: Response) => {
  try {
    // Product type is assumed to be a Mongoose Model that returns IProduct documents
    const p = new Product(req.body) as unknown as IProduct;
    await (p as any).save(); // Use Mongoose save method

    const payload = {
      productName: p.name,
      category: p.category,
      attributes: p.attributes,
      previousAnswers: {},
      askedQuestions: [],
    };

    let aiQuestions: string[] = [];
    try {
      // Axios response data is typed as 'any' or more specifically if known
      const aiResponse = await axios.post<{ questions: string[] }>("http://localhost:5000/generate-questions", payload);
      const aiData = aiResponse.data;

      if (aiData.questions && Array.isArray(aiData.questions)) {
        aiQuestions = aiData.questions.filter((q: any): q is string => typeof q === "string" && q.trim().length > 0);

        if (aiQuestions.length === 0) {
          console.warn("AI returned empty questions. Using fallback.");
          aiQuestions = [
            "What are the main materials and their source/origin?",
            "What is the company's policy on labor ethics and fair wages?",
            "How is the product packaged to minimize environmental waste?",
          ];
        }
      } else {
        throw new Error("Malformed AI response: 'questions' property missing or incorrect.");
      }
    } catch (aiErr) {
      console.error("Failed to call AI service for questions:", aiErr);
      // Fallback questions
      aiQuestions = [
        "What are the main materials and their source/origin?",
        "What is the company's policy on labor ethics and fair wages?",
        "How is the product packaged to minimize environmental waste?",
      ];
    }

    p.questions = aiQuestions;
    await (p as any).save();
    res.status(201).json(p);
  } catch (err) {
    console.error("Product creation error:", err);
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /products/:id - Fetch a single product
router.get("/:id", async (req: Request<{ id: string }>, res: Response) => {
  try {
    // Assuming findById returns a promise of IProduct | null
    const p = await Product.findById(req.params.id) as IProduct | null;
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json(p);
  } catch (err) {
    console.error("Product fetch error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /products/:id/score - Submit answers and calculate score via AI
router.post("/:id/score", async (req: ProductScoreRequest & Request<{ id: string }>, res: Response) => {
  try {
    const p = await Product.findById(req.params.id) as IProduct | null;
    if (!p) return res.status(404).json({ error: "Product not found" });

    const answers = req.body;
    
    // Type for the AI scoring response
    interface AIScoreResponse {
        score: number;
        summary: string;
    }

    const aiResponse = await axios.post<AIScoreResponse>("http://localhost:5000/transparency-score", {
      productName: p.name,
      category: p.category,
      answers,
    });

    const scoreData = aiResponse.data;
    const finalScore = scoreData.score ?? 50;
    const reasoningSummary = scoreData.summary ?? "No reasoning summary provided.";

    p.transparencyScore = finalScore;
    // Merge existing attributes with new answers and the reasoning summary
    p.attributes = { ...p.attributes, ...answers, reasoningSummary };
    await (p as any).save();

    res.json({ score: finalScore, product: p });
  } catch (err) {
    console.error("Product scoring error:", err);
    if (isAxiosError(err)) console.error("Axios Scoring Error:", err.response?.data || err.message);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /products/:id/report - Generate and serve the PDF report
router.get("/:id/report", async (req: Request<{ id: string }>, res: Response) => {
  try {
    const p = await Product.findById(req.params.id) as IProduct | null;
    if (!p) return res.status(404).json({ error: "Not found" });

    // Type for the detailed AI analysis response
    interface AIDetailedAnalysis {
        executiveSummary: string;
        strengths: string[];
        concerns: string[];
        recommendations: string[];
        categoryAnalysis: Record<string, string>;
    }
    
    let detailedAnalysis: AIDetailedAnalysis;
    
    try {
      const analysisResponse = await axios.post<AIDetailedAnalysis>("http://localhost:5000/generate-report-analysis", {
        productName: p.name,
        category: p.category,
        answers: p.attributes,
        transparencyScore: p.transparencyScore,
      });
      detailedAnalysis = analysisResponse.data;
    } catch (aiErr) {
      console.error("Failed to generate detailed analysis:", aiErr);
      // Fallback structure for detailed analysis
      detailedAnalysis = {
        executiveSummary: "Analysis unavailable. Failed to connect to AI service.",
        strengths: ["Internal AI service is down."],
        concerns: ["Report is not fully generated."],
        recommendations: ["Restore AI service functionality."],
        categoryAnalysis: { Error: "Data could not be fetched from AI service." },
      };
    }

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const filename = `${p.name.replace(/\s/g, "_")}_Transparency_Report.pdf`;
    
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/pdf");
    doc.pipe(res);

    // Header
    doc.fontSize(28).fillColor("#1e40af").text("PRODUCT TRANSPARENCY REPORT", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#6b7280").text("Comprehensive Supply Chain & Ethics Analysis", { align: "center" });
    doc.moveDown(2);

    // Product Information Box
    doc.rect(50, doc.y, 495, 80).fillAndStroke("#f0f9ff", "#3b82f6");
    const boxY = doc.y + 15;
    doc.fillColor("#1e3a8a").fontSize(12).text("PRODUCT DETAILS", 70, boxY);
    doc.fillColor("#374151").fontSize(10);
    doc.text(`Name: ${p.name}`, 70, boxY + 20);
    doc.text(`Category: ${p.category}`, 70, boxY + 35);
    doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 70, boxY + 50);
    doc.moveDown(6);

    // Transparency Score
    const scoreColor = p.transparencyScore >= 75 ? "#059669" : p.transparencyScore >= 50 ? "#d97706" : "#dc2626";
    doc.fontSize(14).fillColor("#111827").text("TRANSPARENCY SCORE", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(36).fillColor(scoreColor).text(`${p.transparencyScore || "N/A"}/100`, { align: "center" });
    doc.moveDown(0.5);
    
    const scoreLabel = p.transparencyScore >= 75 ? "Excellent Transparency" : 
                       p.transparencyScore >= 50 ? "Moderate Transparency" : "Limited Transparency";
    doc.fontSize(12).fillColor("#6b7280").text(scoreLabel, { align: "center" });
    doc.moveDown(2);

    // Executive Summary
    if (detailedAnalysis.executiveSummary) {
      addSection(doc, "EXECUTIVE SUMMARY", detailedAnalysis.executiveSummary, "#7c3aed");
    }

    // Key Findings
    if (detailedAnalysis.strengths?.length > 0 || detailedAnalysis.concerns?.length > 0) {
      doc.addPage();
      doc.fontSize(16).fillColor("#1e40af").text("KEY FINDINGS", { underline: true });
      doc.moveDown(1);

      if (detailedAnalysis.strengths?.length > 0) {
        doc.fontSize(14).fillColor("#059669").text("Strengths:");
        doc.moveDown(0.3);
        detailedAnalysis.strengths.forEach((strength: string, i: number) => {
          doc.fontSize(10).fillColor("#374151").text(`${i + 1}. ${strength}`, { indent: 20 });
          doc.moveDown(0.3);
        });
        doc.moveDown(1);
      }

      if (detailedAnalysis.concerns?.length > 0) {
        doc.fontSize(14).fillColor("#dc2626").text("Areas of Concern:");
        doc.moveDown(0.3);
        detailedAnalysis.concerns.forEach((concern: string, i: number) => {
          doc.fontSize(10).fillColor("#374151").text(`${i + 1}. ${concern}`, { indent: 20 });
          doc.moveDown(0.3);
        });
        doc.moveDown(1);
      }
    }

    // Category-Specific Analysis
    if (detailedAnalysis.categoryAnalysis && Object.keys(detailedAnalysis.categoryAnalysis).length > 0) {
      doc.addPage();
      doc.fontSize(16).fillColor("#1e40af").text("DETAILED CATEGORY ANALYSIS", { underline: true });
      doc.moveDown(1);

      Object.entries(detailedAnalysis.categoryAnalysis).forEach(([category, analysis]: [string, string]) => {
        doc.fontSize(13).fillColor("#7c3aed").text(category.toUpperCase());
        doc.moveDown(0.3);
        doc.fontSize(10).fillColor("#374151").text(analysis, { align: "justify" });
        doc.moveDown(1);
      });
    }

    // Disclosed Information
    doc.addPage();
    doc.fontSize(16).fillColor("#1e40af").text("DISCLOSED INFORMATION", { underline: true });
    doc.moveDown(1);

    const { reasoningSummary, ...displayAnswers } = p.attributes || {};
    if (displayAnswers && Object.keys(displayAnswers).length > 0) {
      Object.entries(displayAnswers).forEach(([key, value]) => {
        // Strip markdown bolding for cleaner PDF text
        const cleanValue = String(value).replace(/\*\*(.*?)\*\*/g, "$1");
        doc.fontSize(11).fillColor("#1e40af").text(`${key}:`, { continued: false });
        doc.fontSize(10).fillColor("#374151").text(cleanValue, { indent: 20, align: "justify" });
        doc.moveDown(0.8);
      });
    }

    // Recommendations
    if (detailedAnalysis.recommendations?.length > 0) {
      doc.addPage();
      doc.fontSize(16).fillColor("#1e40af").text("RECOMMENDATIONS", { underline: true });
      doc.moveDown(1);
      detailedAnalysis.recommendations.forEach((rec: string, i: number) => {
        doc.fontSize(10).fillColor("#374151").text(`${i + 1}. ${rec}`, { align: "justify" });
        doc.moveDown(0.5);
      });
    }

    // Footer
    doc.moveDown(3);
    doc.fontSize(8).fillColor("#9ca3af").text(
      "This report was generated by an AI-powered Product Transparency System. " +
      "While we strive for accuracy, this analysis should be considered alongside other verification methods.",
      { align: "center" }
    );

    doc.end();
  } catch (err) {
    console.error("PDF generation error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// DELETE /products/:id - Delete a product
router.delete("/:id", async (req: Request<{ id: string }>, res: Response) => {
  try {
    const p = await Product.findByIdAndDelete(req.params.id) as IProduct | null;
    if (!p) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (err) {
    console.error("Product deletion error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;