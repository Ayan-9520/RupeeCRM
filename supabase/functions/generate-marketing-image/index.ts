import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Curated prompt library — product → professional ad-banner prompt
const PRODUCT_PROMPTS: Record<string, string[]> = {
  personal_loan: [
    "Modern Indian banking ad: smiling young professional holding smartphone with cash app, soft blue gradient background, financial freedom theme, premium photography, 1080x1080, copy space on left",
    "Clean fintech banner: stack of Indian rupee notes with golden glow, dark navy background, instant approval theme, ultra premium look",
    "Lifestyle photo: happy Indian middle-class family celebrating with house keys and money, warm sunset light, aspirational mood",
  ],
  home_loan: [
    "Premium real estate ad banner: beautiful modern Indian house with garden at golden hour, family at door, soft warm tones, copy space on right, ultra realistic",
    "Architectural shot of new urban Indian apartment building with palm trees, blue sky, dream home concept, magazine quality",
    "Cozy living room interior with sunlight, plants, and a small house key on table, warm welcoming atmosphere",
  ],
  lap: [
    "Commercial real estate banner: modern multi-story property with for-sale sign, professional businessman standing in front, blue corporate tone, premium ad style",
    "Aerial drone view of premium Indian residential property with garden, gold key icon overlay area, luxury financing theme",
    "Property documents with golden pen on marble desk, soft natural light, mortgage and equity loan concept, ultra clean",
  ],
  business_loan: [
    "Indian shop owner smiling outside thriving small business, vibrant storefront, growth and success theme, warm cinematic lighting, copy space top",
    "Modern Indian office workspace with entrepreneur reviewing growth charts on laptop, plants and coffee, clean minimal",
    "Bustling commercial street in India with thriving stores, optimistic morning light, business growth concept",
  ],
  msme: [
    "Small Indian factory floor with workers operating machinery, bright industrial lighting, MSME manufacturing growth theme, premium documentary style",
    "Female Indian textile entrepreneur in her workshop surrounded by colorful fabrics, empowerment theme, warm light",
    "Auto-rickshaw repair shop owner with tools, working capital concept, real Indian street setting, golden hour",
  ],
  credit_card: [
    "Sleek metallic credit card floating on dark gradient background with gold particles, premium luxury look, hero product shot",
    "Stylish young Indian professional tapping credit card at modern cafe POS, lifestyle banking ad, soft bokeh",
    "Premium credit card with rewards icons and shopping bags concept, clean white background, advertising quality",
  ],
  insurance: [
    "Protective shield icon over an Indian family of four, soft turquoise and white background, security and peace concept, modern flat illustration mixed with photo",
    "Doctor holding stethoscope with happy senior couple, hospital background, health insurance trust theme, warm light",
    "Hands holding paper-cut family with umbrella above, symbolic life insurance protection concept, soft pastel colors",
  ],
  investment: [
    "Growing financial chart with green upward arrow, golden coins stacked in growth pattern, mutual fund and SIP wealth theme, premium dark blue background",
    "Indian couple reviewing investment portfolio on tablet at home, comfortable bright living room, financial planning theme",
    "Plant growing from pile of coins with sun rays, wealth growth metaphor, clean studio shot",
  ],
  generic: [
    "Modern Indian fintech ad banner: abstract financial growth concept with rupee symbol, blue and gold gradient, professional and trustworthy",
  ],
};

function pickPrompt(product: string): string {
  const list = PRODUCT_PROMPTS[product] ?? PRODUCT_PROMPTS.generic;
  return list[Math.floor(Math.random() * list.length)];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { product = "generic", customPrompt } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = customPrompt && customPrompt.length > 10 ? customPrompt : pickPrompt(product);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Top up workspace to continue." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI image generation failed");
    }

    const data = await aiRes.json();
    const dataUrl: string | undefined = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!dataUrl) throw new Error("No image returned");

    // Decode and upload to storage
    const m = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!m) throw new Error("Bad image format");
    const mime = m[1];
    const ext = mime.split("/")[1] || "png";
    const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const filename = `${product}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("marketing-images")
      .upload(filename, bytes, { contentType: mime, upsert: false });
    if (upErr) throw upErr;

    const { data: pub } = supabase.storage.from("marketing-images").getPublicUrl(filename);
    const imageUrl = pub.publicUrl;

    // Identify caller (from JWT) for created_by
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    let createdBy: string | null = null;
    if (token) {
      const { data: userData } = await supabase.auth.getUser(token);
      createdBy = userData.user?.id ?? null;
    }

    // Insert into product_images (best effort — succeeds when caller is admin)
    await supabase.from("product_images").insert({
      product, image_url: imageUrl, prompt, source: "ai", created_by: createdBy,
    });

    return new Response(JSON.stringify({ image_url: imageUrl, prompt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-marketing-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
