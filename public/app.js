const $ = (selector) => document.querySelector(selector);
const state = { messages: [], config: { phone: "", whatsapp: "" } };

$("#year").textContent = new Date().getFullYear();

$("#menuToggle").addEventListener("click", () => $("#nav").classList.toggle("open"));
$("#nav").querySelectorAll("a").forEach(a => a.addEventListener("click", () => $("#nav").classList.remove("open")));

async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) return;
    const config = await response.json();
    state.config = config;
    if (config.phone) {
      $("#phoneLink").href = `tel:+${config.phone.replace(/\D/g, "")}`;
      $("#phoneLink").textContent = formatPhone(config.phone);
    }
  } catch (error) {
    console.warn("Config could not be loaded.");
  }
}
function formatPhone(value) {
  const digits = String(value).replace(/\D/g, "");
  if (digits.startsWith("20") && digits.length >= 12) return `+${digits.slice(0,2)} ${digits.slice(2,4)} ${digits.slice(4)}`;
  return value;
}
loadConfig();

document.querySelectorAll("[data-style]").forEach(button => button.addEventListener("click", () => {
  const style = button.dataset.style;
  $("#leadForm").elements.style.value = style;
  $("#contact").scrollIntoView({ behavior: "smooth" });
}));

$("#leadForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const whatsapp = String(state.config.whatsapp || "").replace(/\D/g, "");
  if (!whatsapp) {
    alert("رقم واتساب غير مضبوط بعد. أضف WHATSAPP_PHONE في ملف .env ثم أعد تشغيل الموقع.");
    return;
  }
  const message = [
    "طلب جديد من موقع For You Kitchens",
    `الاسم: ${data.get("name")}`,
    `رقم العميل: ${data.get("phone")}`,
    `الستايل: ${data.get("style")}`,
    `التفاصيل: ${data.get("details") || "لم يذكر"}`
  ].join("\n");
  window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
});

const chatBox = $("#chatBox");
$("#chatLaunch").addEventListener("click", () => { chatBox.hidden = false; $("#chatInput").focus(); });
$("#chatClose").addEventListener("click", () => { chatBox.hidden = true; });

function addBubble(content, role, extraClass = "") {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role} ${extraClass}`.trim();
  bubble.textContent = content;
  $("#chatLog").appendChild(bubble);
  $("#chatLog").scrollTop = $("#chatLog").scrollHeight;
  return bubble;
}
$("#chatForm").addEventListener("submit", async event => {
  event.preventDefault();
  const input = $("#chatInput");
  const content = input.value.trim();
  if (!content) return;
  input.value = "";
  addBubble(content, "user");
  state.messages.push({ role: "user", content });
  const loading = addBubble("بفكر في أنسب رد…", "assistant");
  const sendButton = $("#chatForm button");
  sendButton.disabled = true;
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: state.messages.slice(-12) })
    });
    const data = await response.json();
    loading.remove();
    if (!response.ok) {
      addBubble(data.error || "المساعد مش متاح دلوقتي.", "assistant", "error");
      state.messages.pop();
      return;
    }
    state.messages.push({ role: "assistant", content: data.reply });
    addBubble(data.reply, "assistant");
  } catch (error) {
    loading.remove();
    addBubble("مش قادر أوصل للخادم حاليًا. تأكد من اتصال الإنترنت وجرب تاني.", "assistant", "error");
    state.messages.pop();
  } finally {
    sendButton.disabled = false;
    input.focus();
  }
});