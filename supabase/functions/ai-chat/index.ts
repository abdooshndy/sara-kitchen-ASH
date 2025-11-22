// supabase/functions/ai-chat/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { message } = await req.json();

        if (!GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is not set');
        }

        // 1. Initialize Supabase Client
        const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

        // 2. Fetch Menu Items (Context)
        // We fetch only necessary fields to keep context small
        const { data: products, error: dbError } = await supabase
            .from('products')
            .select('name, price, description, category, is_available')
            .eq('is_available', true);

        if (dbError) throw dbError;

        // 3. Construct System Prompt
        const menuContext = products.map(p =>
            `- ${p.name} (${p.category}): ${p.price} EGP. ${p.description || ''}`
        ).join('\n');

        const systemPrompt = `
    أنتِ "سارة"، شيف ماهرة ومساعدة ذكية في منصة "مطبخ سارة للأكل البيتي".
    دورك هو مساعدة العملاء في اختيار وجبات لذيذة، الإجابة عن استفساراتهم حول المنيو، وتقديم اقتراحات.
    
    قواعدك:
    1. تحدثي باللهجة المصرية الودودة والمحترمة (مثل: "يا فندم"، "من عيوني"، "أحلى أكل بيتي").
    2. اعتمدي فقط على قائمة الطعام المرفقة أدناه في إجاباتك. لا تخترعي أصناف غير موجودة.
    3. إذا سأل العميل عن شيء غير موجود، اعتذري بلطف واقترحي بديلاً متاحاً.
    4. حاولي دائماً تشجيع العميل على الطلب ("تحب أضيفه للسلة؟").
    5. اجعلي إجاباتك قصيرة ومفيدة (لا تتجاوزي 3-4 جمل إلا عند الضرورة).

    قائمة الطعام المتاحة اليوم:
    ${menuContext}
    `;

        // 4. Call Gemini API (Gemini 1.5 Flash)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: systemPrompt + "\n\nسؤال العميل: " + message }]
                    }
                ]
            })
        });

        const data = await response.json();

        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('No response from Gemini');
        }

        const reply = data.candidates[0].content.parts[0].text;

        return new Response(JSON.stringify({ reply }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
