import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3000);

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "طلبات كتير في وقت قصير. استنى دقيقة وجرب تاني." }
});

const systemPrompt = `
أنت مساعد خدمة العملاء لمتجر ${process.env.BUSINESS_NAME || "For You Kitchens"} المتخصص في تصميم المطابخ.
تحدث باللغة العربية المصرية المهذبة وبشكل واضح ومختصر.
ساعد العميل في اختيار ستايل المطبخ، والأسئلة الأولية عن الخامات، والأبعاد، والتخزين، وتجهيز طلب استشارة.
مهم جدًا:
- لا تخترع أسعارًا أو عروضًا أو مواعيد تسليم أو ضمانات أو توافر خامات. إذا لم توجد بيانات مؤكدة، قل إن فريق العمل سيؤكدها.
- لا تدّعِ أنك موظف بشري. أنت مساعد افتراضي.
- اسأل أسئلة توضيحية عند الحاجة مثل طول وعرض المطبخ، شكل المطبخ (مستقيم/L/U)، والستايل المفضل والميزانية التقريبية.
- لا تطلب بيانات دفع أو كلمات مرور أو بيانات حساسة.
- لا تقدم وعودًا بتنفيذ أو حجز مؤكد.
`;

const openai = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes("ضع_مفتاح")
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

app.get("/api/config", (_req, res) => {
  res.json({
    businessName: process.env.BUSINESS_NAME || "For You Kitchens",
    phone: process.env.SITE_PHONE || "201274527099",
    whatsapp: process.env.WHATSAPP_PHONE || "201272296934"
  });
});

app.post("/api/chat", chatLimiter, async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({
        error: "مساعد الذكاء الاصطناعي لم يتم تفعيله بعد. أضف OPENAI_API_KEY في إعدادات الخادم."
      });
    }

    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const safeMessages = messages
      .filter(m => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
      .slice(-12)
      .map(m => ({ role: m.role, content: m.content.slice(0, 1500) }));

    if (!safeMessages.length || safeMessages[safeMessages.length - 1].role !== "user") {
      return res.status(400).json({ error: "اكتب سؤالك الأول." });
    }

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...safeMessages],
      temperature: 0.5,
      max_tokens: 500
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();
    if (!reply) return res.status(502).json({ error: "ماقدرتش أجهز رد دلوقتي. جرّب تاني." });
    res.json({ reply });
  } catch (error) {
    console.error("AI chat error:", error?.status || error?.message || "unknown");
    res.status(500).json({ error: "حصلت مشكلة مؤقتة في المساعد. حاول مرة تانية." });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`For You Kitchens is running on http://localhost:${port}`);
});
