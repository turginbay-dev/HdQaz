import { mediaRequest } from '@/features/telegram/media';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export function POST(request:Request){return mediaRequest(request);}
