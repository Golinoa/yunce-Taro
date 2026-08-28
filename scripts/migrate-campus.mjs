import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'src/services/campus.ts');
let c = fs.readFileSync(file, 'utf8');

  c = c.replace(/import \{[\s\S]*?\} from '@\/data\/campus';\r?\n/, "import { loadCampusMock } from '@/utils/mock-loaders';\nimport { isUseMock } from '@/utils/build-env';\n");
c = c.replace(/\bmock([A-Z][A-Za-z]*)\(/g, '(await loadCampusMock()).mock$1(');
c = c.replace(/: \(\): Promise</g, ': async (): Promise<');
c = c.replace(/: \(campusId: string\): Promise</g, ': async (campusId: string): Promise<');
c = c.replace(/: \(id: string\): Promise</g, ': async (id: string): Promise<');
c = c.replace(/: \(data: /g, ': async (data: ');
c = c.replace(/: \(id: string, /g, ': async (id: string, ');
c = c.replace(/: \(options\?: /g, ': async (options?: ');
c = c.replace(/: \(holiday: /g, ': async (holiday: ');
c = c.replace(/: \(model: /g, ': async (model: ');
c = c.replace(/: \(updates: /g, ': async (updates: ');
c = c.replace(/: \(itemId: /g, ': async (itemId: ');

fs.writeFileSync(file, c, 'utf8');
console.log('campus migrated');
