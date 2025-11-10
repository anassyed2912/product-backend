import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema({

  name: { type: String, required: true },
  category: { type: String, required: true },


  attributes: { type: Object, default: {} }, 
  questions: { type: [String], default: [] }, 
  askedQuestions: { type: [String], default: [] }, 
  previousAnswers: { type: Object, default: {} },


  transparencyScore: { type: Number, default: null },
  reasoningSummary: { type: String, default: "" }, 

  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },


  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Product", ProductSchema);
