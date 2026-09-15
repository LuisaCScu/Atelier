export function aiKey(){return process.env.AI_GATEWAY_API_KEY?.trim()||process.env.OPENAI_API_KEY?.trim();}
export function responsesUrl(){return process.env.AI_GATEWAY_API_KEY?.trim()?'https://ai-gateway.vercel.sh/v1/responses':'https://api.openai.com/v1/responses';}
export function visionModel(){const model=process.env.CLOSET_VISION_MODEL||'gpt-4.1-mini';return process.env.AI_GATEWAY_API_KEY?.trim()&&!model.includes('/')?'openai/'+model:model;}
