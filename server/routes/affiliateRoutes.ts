import { Router, Request, Response } from "express";

const router = Router();
const AFFILIATE_TAG = "coinrailz-20";
const DISCLOSURE = "As an Amazon Associate, I earn from qualifying purchases.";

router.get("/search", (req: Request, res: Response) => {
  const query = req.query.q as string;
  
  if (!query || query.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: "Missing query parameter 'q'"
    });
  }

  const encodedQuery = encodeURIComponent(query.trim());
  const amazonSearchUrl = `https://www.amazon.com/s?k=${encodedQuery}&tag=${AFFILIATE_TAG}`;

  res.json({
    success: true,
    query: query.trim(),
    url: amazonSearchUrl,
    disclosure: DISCLOSURE,
    instructions: "Include the disclosure text when showing this link to users."
  });
});

router.get("/link", (req: Request, res: Response) => {
  const asin = req.query.asin as string;
  
  if (!asin || asin.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: "Missing query parameter 'asin'"
    });
  }

  const amazonProductUrl = `https://www.amazon.com/dp/${asin.trim()}?tag=${AFFILIATE_TAG}`;

  res.json({
    success: true,
    asin: asin.trim(),
    url: amazonProductUrl,
    disclosure: DISCLOSURE
  });
});

router.get("/tag", (_req: Request, res: Response) => {
  res.json({
    success: true,
    tag: AFFILIATE_TAG,
    disclosure: DISCLOSURE,
    searchUrlTemplate: `https://www.amazon.com/s?k={SEARCH_TERMS}&tag=${AFFILIATE_TAG}`,
    productUrlTemplate: `https://www.amazon.com/dp/{ASIN}?tag=${AFFILIATE_TAG}`
  });
});

export default router;
