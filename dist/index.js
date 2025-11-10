"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const products_1 = __importDefault(require("./routes/products"));
const questions_1 = __importDefault(require("./routes/questions"));
const auth_1 = __importDefault(require("./routes/auth"));
dotenv_1.default.config();
function authenticate(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token)
        return res.status(401).json({ error: "No token provided" });
    try {
        req.user = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        next();
    }
    catch {
        res.status(403).json({ error: "Invalid or expired token" });
    }
}
async function start() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(body_parser_1.default.json());
    const mongoURI = process.env.MONGO_URI || "";
    if (!mongoURI) {
        console.error("❌ MONGO_URI not found in .env");
        process.exit(1);
    }
    try {
        await mongoose_1.default.connect(mongoURI);
        console.log("✅ Connected to MongoDB Atlas");
    }
    catch (err) {
        console.error("❌ MongoDB connection failed:", err);
        process.exit(1);
    }
    app.use("/api/auth", auth_1.default);
    app.use("/api/products", authenticate, products_1.default);
    app.use("/api", questions_1.default);
    const port = process.env.PORT || 4000;
    app.listen(port, () => console.log(`🚀 Backend listening on http://localhost:${port}`));
}
start().catch((err) => {
    console.error("❌ Fatal error starting server:", err);
    process.exit(1);
});
