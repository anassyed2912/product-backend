"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_1 = __importDefault(require("../models/user"));
const router = express_1.default.Router();
router.post("/register", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ error: "Email and password required" });
        const existingUser = await user_1.default.findOne({ email });
        if (existingUser)
            return res.status(400).json({ error: "User already exists" });
        const user = new user_1.default({ email, password });
        await user.save();
        res.status(201).json({ message: "User registered successfully" });
    }
    catch (err) {
        console.error("❌ Registration error:", err);
        res.status(500).json({ error: "Server error during registration" });
    }
});
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await user_1.default.findOne({ email });
        if (!user)
            return res.status(404).json({ error: "User not found" });
        const isMatch = await user.comparePassword(password);
        if (!isMatch)
            return res.status(401).json({ error: "Invalid credentials" });
        const token = jsonwebtoken_1.default.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET || "devsecret", { expiresIn: "2h" });
        res.json({ token, user: { id: user._id, email: user.email } });
    }
    catch (err) {
        console.error("❌ Login error:", err);
        res.status(500).json({ error: "Server error during login" });
    }
});
exports.default = router;
