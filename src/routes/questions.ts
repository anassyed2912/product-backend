import express from 'express';
const router = express.Router();


router.post('/generate-questions', (req, res) => {
  const { category, answers } = req.body || {};
  const followUps = [];

  if (!category) return res.status(400).json({ error: 'category required' });

  if (category === 'cosmetics') {
    if (!answers?.ingredients) followUps.push({ id: 'ingredients', question: 'List the full ingredient list' });
    if (!answers?.allergens) followUps.push({ id: 'allergens', question: 'Are there any known allergens?' });
    if (!answers?.crueltyFree) followUps.push({ id: 'crueltyFree', question: 'Is the product cruelty-free? (yes/no)' });
  } else if (category === 'food') {
    if (!answers?.ingredients) followUps.push({ id: 'ingredients', question: 'List the ingredient list' });
    if (!answers?.nutrition) followUps.push({ id: 'nutrition', question: 'Provide nutrition facts (calories, fats, sugars)' });
    if (!answers?.allergens) followUps.push({ id: 'allergens', question: 'Any allergens present?' });
  } else {

    if (!answers?.materials) followUps.push({ id: 'materials', question: 'What materials is the product made from?' });
    if (!answers?.origin) followUps.push({ id: 'origin', question: 'Country of origin / manufacturer?' });
  }

  res.json({ followUps });
});

export default router;
