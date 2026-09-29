import { telegramRequest } from '@/features/telegram/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function POST(request:Request){return telegramRequest(request);}
