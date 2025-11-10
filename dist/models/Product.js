"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const ProductSchema = new mongoose_1.default.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true },
    attributes: { type: Object, default: {} },
    questions: { type: [String], default: [] },
    askedQuestions: { type: [String], default: [] },
    previousAnswers: { type: Object, default: {} },
    transparencyScore: { type: Number, default: null },
    reasoningSummary: { type: String, default: "" },
    userId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User", required: false },
    createdAt: { type: Date, default: Date.now },
});
exports.default = mongoose_1.default.model("Product", ProductSchema);
