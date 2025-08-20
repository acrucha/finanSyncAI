import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import dotenv from 'dotenv';

dotenv.config();    

const serverUrl: string = process.env.SERVER_URL || 'localhost:3000';
const content: string = `export const env = {\n  SERVER_URL: "${serverUrl}"\n};\n`;

const envPath = 'client/public/env.ts';
const dir = dirname(envPath);
if (!existsSync(dir)) {
	mkdirSync(dir, { recursive: true });
}
writeFileSync(envPath, content);
console.log('Arquivo client/public/env.ts gerado com SERVER_URL:', serverUrl);
